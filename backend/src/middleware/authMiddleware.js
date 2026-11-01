const jwt = require("jsonwebtoken");
const prisma = require("../config/prisma");

const jwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") throw new Error("JWT_SECRET must be configured in production");
  return "development-only-smart-journey-jwt-secret";
};

async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication token required",
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, jwtSecret());

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, phone: true, email: true, fullName: true, role: true, createdAt: true },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User session expired or invalid",
      });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
}

// Optional Auth: populates req.user if token exists, but doesn't block guest users
async function optionalAuthMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, jwtSecret());
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
      });
      if (user) req.user = user;
    }
  } catch (err) {
    // Ignore invalid optional tokens
  }
  next();
}

module.exports = { authMiddleware, optionalAuthMiddleware };
