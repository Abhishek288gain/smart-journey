const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { authMiddleware } = require("../middleware/authMiddleware");
const authRateLimit = require("../middleware/authRateLimit");

router.post("/send-otp", authRateLimit({ action: "send-otp", maxRequests: 5, windowSeconds: 900 }), authController.sendOtp);
router.post("/verify-otp", authRateLimit({ action: "verify-otp", maxRequests: 10, windowSeconds: 900 }), authController.verifyOtp);
router.get("/me", authMiddleware, authController.getMe);

module.exports = router;
