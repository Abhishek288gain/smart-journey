const cacheService = require("../config/cache");

function authRateLimit({ action, maxRequests, windowSeconds }) {
  return async (req, res, next) => {
    try {
      const ip = String(req.ip || req.socket.remoteAddress || "unknown").replace(/[^a-zA-Z0-9:._-]/g, "_");
      const count = await cacheService.increment(`rate:${action}:${ip}`, windowSeconds);
      if (count > maxRequests) return res.status(429).json({ success: false, message: "Too many requests. Please wait and try again." });
      next();
    } catch (error) { next(error); }
  };
}

module.exports = authRateLimit;
