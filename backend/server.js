require("dotenv").config();

const express = require("express");
const cors = require("cors");
const http = require("node:http");
const path = require("node:path");
const prisma = require("./src/config/prisma");
const cacheService = require("./src/config/cache");

// Route imports
const authRoutes = require("./src/routes/authRoute");
const searchRoutes = require("./src/routes/searchRoute");
const trainRoutes = require("./src/routes/trainRoute");
const busRoutes = require("./src/routes/busRoute");
const bookingRoutes = require("./src/routes/bookingRoute");
const paymentRoutes = require("./src/routes/paymentRoute");
const tripTicketRoutes = require("./src/routes/tripTicketRoute");
const accountRoutes = require("./src/routes/accountRoute");
const locationRoutes = require("./src/routes/locationRoute");
const notificationMonitor = require("./src/services/notificationMonitor");

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";

// Middleware
const allowedOrigins = new Set([CLIENT_ORIGIN]);
if (process.env.RENDER_EXTERNAL_URL) allowedOrigins.add(process.env.RENDER_EXTERNAL_URL.replace(/\/$/, ""));
if (process.env.NODE_ENV !== "production") {
  ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"].forEach((origin) => allowedOrigins.add(origin));
}
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error("Origin is not allowed by CORS"));
  },
  credentials: true,
}));

app.use(express.json({ verify: (req, res, buf) => {
  if (req.originalUrl === "/api/payments/webhook") req.rawBody = Buffer.from(buf);
} }));
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get("/api/health", async (req, res) => {
  try {
    const stationCount = await prisma.station.count();
    const routeCount = await prisma.route.count();
    const scheduleCount = await prisma.schedule.count();

    res.json({
      status: "healthy",
      service: "smart-journey-api",
      timestamp: new Date().toISOString(),
      database: {
        status: "connected",
        stations: stationCount,
        routes: routeCount,
        schedules: scheduleCount,
      },
      cache: {
        isRedisActive: cacheService.isRedisAvailable,
        type: cacheService.isRedisAvailable ? "redis" : "in-memory-fallback",
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "degraded",
      error: error.message,
    });
  }
});

// Mounted API Routes
app.use("/api/auth", authRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/locations", locationRoutes);
app.use("/api/trains", trainRoutes);
app.use("/api/buses", busRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/trips", tripTicketRoutes);
app.use("/api", accountRoutes);

// Serve the built React app from this same service for single-origin deployments.
const frontendDist = path.resolve(__dirname, "../frontend/dist");
app.use(express.static(frontendDist));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(frontendDist, "index.html"), (error) => { if (error) next(error); });
});

// Global 404
app.use((req, res, next) => {
  if (!res.headersSent) {
    res.status(404).json({
      success: false,
      message: `Endpoint ${req.method} ${req.originalUrl} not found`,
    });
  }
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("Internal Server Error:", err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
  });
});

async function startServer() {
  if (process.env.NODE_ENV === "production") {
    const required = ["DATABASE_URL", "CLIENT_ORIGIN", "JWT_SECRET", "TICKET_SIGNING_SECRET", "REDIS_URL", "RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET"];
    const missing = required.filter((name) => !process.env[name]);
    if (missing.length) throw new Error(`Missing production configuration: ${missing.join(", ")}`);
    if (process.env.PAYMENT_MODE === "mock") throw new Error("PAYMENT_MODE=mock is forbidden in production");
    if (process.env.OTP_MODE === "mock") throw new Error("OTP_MODE=mock is forbidden in production");
    if (process.env.JWT_SECRET.length < 32 || process.env.TICKET_SIGNING_SECRET.length < 32) {
      throw new Error("JWT_SECRET and TICKET_SIGNING_SECRET must each be at least 32 characters in production");
    }
    const hasSms = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER;
    if (!hasSms) throw new Error("Configure Twilio SMS credentials for production Indian phone verification");
    await prisma.$connect();
    await cacheService.assertRedisReady();
  }

  const server = app.listen(PORT, () => {
    console.log(`Smart Journey API listening on port ${PORT}`);
    notificationMonitor.run();
    const monitorTimer = setInterval(() => notificationMonitor.run(), 5 * 60 * 1000);
    monitorTimer.unref();
  });
  server.on("error", async (error) => {
    if (error.code !== "EADDRINUSE") {
      console.error("Smart Journey could not start:", error.message);
      process.exitCode = 1;
      return;
    }

    const sameApiIsRunning = await new Promise((resolve) => {
      const request = http.get({ hostname: "127.0.0.1", port: PORT, path: "/api/health", timeout: 1500 }, (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => { body += chunk; });
        response.on("end", () => {
          try {
            const health = JSON.parse(body);
            resolve(response.statusCode === 200 && health.service === "smart-journey-api");
          } catch {
            resolve(false);
          }
        });
      });
      request.on("timeout", () => request.destroy());
      request.on("error", () => resolve(false));
    });

    if (sameApiIsRunning) {
      console.log(`Smart Journey API is already healthy on port ${PORT}; keeping the existing instance.`);
      // This is a duplicate launch. Exit only this process; leave the server
      // already using the port untouched.
      process.exit(0);
    }

    console.error(`Port ${PORT} is already in use by another process. Stop that process or set PORT to a free port, then update the frontend proxy to match.`);
    process.exitCode = 1;
  });
  return server;
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error("Smart Journey startup failed:", error.message);
    process.exitCode = 1;
  });
}

module.exports = { app, startServer };
