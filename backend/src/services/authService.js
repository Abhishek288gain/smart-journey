const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");
const prisma = require("../config/prisma");
const cacheService = require("../config/cache");

const OTP_EXPIRY_SECONDS = 300; // 5 minutes
const MAX_OTP_ATTEMPTS = 5;

function normalizePhone(phone) {
  const digits = String(phone || "").replace(/[\s()-]/g, "");
  if (/^[6-9]\d{9}$/.test(digits)) return `+91${digits}`;
  if (/^\+91[6-9]\d{9}$/.test(digits)) return digits;
  throw new Error("Enter a valid Indian mobile number, for example +91 98765 43210");
}

function otpMode() {
  if (process.env.OTP_MODE) return process.env.OTP_MODE;
  const hasSms = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER;
  return process.env.NODE_ENV === "production" || hasSms ? "sms" : "mock";
}

function otpDigest(code) {
  return crypto.createHmac("sha256", process.env.JWT_SECRET || "development-only-smart-journey-jwt-secret").update(code).digest("hex");
}

const jwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") throw new Error("JWT_SECRET must be configured in production");
  return "development-only-smart-journey-jwt-secret";
};

class AuthService {
  async sendOtp(identifier, type = "phone", clientIp = "unknown") {
    if (!identifier || identifier.trim().length === 0) {
      throw new Error("Phone or email is required");
    }

    if (!['phone', 'email'].includes(type)) throw new Error("OTP type must be phone or email");
    const cleanIdentifier = type === "phone" ? normalizePhone(identifier) : identifier.trim().toLowerCase();
    if (type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanIdentifier)) throw new Error("Enter a valid email address");
    const ipKey = `otp-ip-cooldown:${clientIp}`;
    if (await cacheService.get(ipKey)) throw new Error("Too many OTP requests from this network. Please wait 30 seconds.");
    if (await cacheService.get(`otp-cooldown:${cleanIdentifier}`)) throw new Error("Wait 60 seconds before requesting another OTP");
    const otpSessionId = `otp_sess_${uuidv4().replace(/-/g, "").substring(0, 12)}`;
    
    // For fast deterministic testing in development, 123456 or random 6-digit OTP
    const otpCode = String(crypto.randomInt(100000, 1000000));

    // Store in cache with 5-minute expiry
    const otpPayload = {
      identifier: cleanIdentifier,
      type,
      otpDigest: otpDigest(otpCode),
      createdAt: Date.now(),
      expiresAt: Date.now() + OTP_EXPIRY_SECONDS * 1000,
      attempts: 0,
    };

    await cacheService.set(`otp:${otpSessionId}`, otpPayload, OTP_EXPIRY_SECONDS);
    await cacheService.set(`otp-cooldown:${cleanIdentifier}`, true, 60);
    await cacheService.set(ipKey, true, 30);
    const mode = otpMode();
    if (mode === "mock" && process.env.NODE_ENV === "production") throw new Error("Development OTP mode cannot be used in production");
    if (type === "phone" && mode !== "mock" && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER) {
      const body = new URLSearchParams({ To: cleanIdentifier, From: process.env.TWILIO_FROM_NUMBER, Body: `Your Smart Journey verification code is ${otpCode}. It expires in 5 minutes.` });
      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, {
        method: "POST", headers: { Authorization: `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" }, body,
      });
      if (!response.ok) { await cacheService.del(`otp:${otpSessionId}`); await cacheService.del(`otp-cooldown:${cleanIdentifier}`); throw new Error("SMS provider could not deliver the OTP"); }
    } else if (type === "email" && mode !== "mock" && process.env.RESEND_API_KEY && process.env.OTP_FROM_EMAIL) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: process.env.OTP_FROM_EMAIL, to: [cleanIdentifier], subject: "Your Smart Journey verification code", text: `Your verification code is ${otpCode}. It expires in 5 minutes.` }),
      });
      if (!response.ok) { await cacheService.del(`otp:${otpSessionId}`); await cacheService.del(`otp-cooldown:${cleanIdentifier}`); throw new Error("Email provider could not deliver the OTP"); }
    } else if (mode !== "mock") {
      await cacheService.del(`otp:${otpSessionId}`);
      await cacheService.del(`otp-cooldown:${cleanIdentifier}`);
      throw new Error(type === "phone" ? "Configure Twilio SMS credentials before enabling phone sign-in" : "Configure Resend email credentials before enabling email sign-in");
    }

    return {
      otpSessionId,
      expiresInSeconds: OTP_EXPIRY_SECONDS,
      ...(mode === "mock" && process.env.NODE_ENV !== "production" ? { demoOtp: otpCode, otpMode: "development_mock" } : { otpMode: "provider" }),
    };
  }

  async verifyOtp(otpSessionId, otpCode, fullName) {
    if (!otpSessionId || !otpCode) {
      throw new Error("OTP session ID and code are required");
    }

    const cached = await cacheService.get(`otp:${otpSessionId}`);
    if (!cached) {
      throw new Error("OTP expired or invalid session. Please request a new one.");
    }

    if (cached.expiresAt <= Date.now()) {
      await cacheService.del(`otp:${otpSessionId}`);
      throw new Error("OTP expired. Please request a new code.");
    }
    const candidate = Buffer.from(otpDigest(String(otpCode).trim()));
    const expected = Buffer.from(cached.otpDigest || "");
    const codeMatches = candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
    if (!codeMatches) {
      cached.attempts = (cached.attempts || 0) + 1;
      const remainingSeconds = Math.max(1, Math.ceil((cached.expiresAt - Date.now()) / 1000));
      if (cached.attempts >= MAX_OTP_ATTEMPTS) await cacheService.del(`otp:${otpSessionId}`);
      else await cacheService.set(`otp:${otpSessionId}`, cached, remainingSeconds);
      throw new Error(cached.attempts >= MAX_OTP_ATTEMPTS ? "Too many incorrect attempts. Request a new OTP." : "Incorrect OTP entered. Please try again.");
    }

    // OTP is valid! Invalidate session
    await cacheService.del(`otp:${otpSessionId}`);

    const { identifier, type } = cached;

    // Find or create user
    let user = await prisma.user.findFirst({
      where: type === "phone" ? { phone: identifier } : { email: identifier },
    });

    if (!user) {
      const generatedName = String(fullName || "").trim();
      if (type === "phone" && generatedName.length < 2) throw new Error("Enter your name to create a phone account");
      if (generatedName.length > 80) throw new Error("Name must be 80 characters or fewer");
      const safeName = generatedName || identifier.split("@")[0];
      user = await prisma.user.create({
        data: {
          phone: type === "phone" ? identifier : null,
          email: type === "email" ? identifier : null,
          fullName: safeName,
          role: "user",
        },
      });
    }

    // Generate JWT token (expires in 7 days)
    const token = jwt.sign(
      {
        userId: user.id,
        phone: user.phone,
        email: user.email,
        role: user.role,
      },
      jwtSecret(),
      { expiresIn: "7d" }
    );

    return {
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        phone: user.phone,
        email: user.email,
        role: user.role,
      },
    };
  }

  async getCurrentUser(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        passengers: true,
        savedRoutes: true,
      },
    });

    if (!user) throw new Error("User not found");
    return user;
  }
}

module.exports = new AuthService();
