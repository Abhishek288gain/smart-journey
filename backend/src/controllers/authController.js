const authService = require("../services/authService");

exports.sendOtp = async (req, res, next) => {
  try {
    const { identifier, type } = req.body;
    if (!identifier) {
      return res.status(400).json({ success: false, message: "Please provide a valid phone or email" });
    }
    const result = await authService.sendOtp(identifier, type || "phone", req.ip || req.socket.remoteAddress);
    res.json({
      success: true,
      message: `Verification code sent to ${type === "phone" ? "the mobile number" : "the email address"}`,
      ...result,
    });
  } catch (err) {
    next(err);
  }
};

exports.verifyOtp = async (req, res, next) => {
  try {
    const { otpSessionId, otpCode, fullName } = req.body;
    if (!otpSessionId || !otpCode) {
      return res.status(400).json({ success: false, message: "Missing OTP session or code" });
    }
    const result = await authService.verifyOtp(otpSessionId, otpCode, fullName);
    res.json({
      success: true,
      message: "Authentication successful",
      ...result,
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.getMe = async (req, res, next) => {
  try {
    res.json({
      success: true,
      user: req.user,
    });
  } catch (err) {
    next(err);
  }
};
