const express = require("express");

const router = express.Router();

const {
  register,
  login,
  getMe,
  logout,
} = require("../controllers/authController");

const protect = require("../middleware/auth");

const passport = require("../passport/passport");

// ==========================================
// REGISTER
// ==========================================

router.post("/register", register);

// ==========================================
// LOGIN
// ==========================================

router.post(
  "/login",

  passport.authenticate("local"),

  login,
);

// ==========================================
// CURRENT USER
// ==========================================

router.get("/me", protect, getMe);

// ==========================================
// LOGOUT
// ==========================================

router.post("/logout", protect, logout);

module.exports = router;
