const User = require("../models/User");

// ==========================================
// REGISTER
// ==========================================

const register = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    // Validate fields
    if (!name || !email || !phone || !password) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    // Check password length
    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters",
      });
    }

    // Check existing user
    const existingUser = await User.findOne({
      email: email.toLowerCase(),
    });

    if (existingUser) {
      return res.status(409).json({
        message: "Email already registered",
      });
    }

    // Create user
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      phone,
      password,
    });

    // Automatically login after registration
    req.login(user, (err) => {
      if (err) {
        console.error(err);

        return res.status(500).json({
          message: "Registration successful but login failed",
        });
      }

      res.status(201).json({
        message: "Registration successful",

        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
        },
      });
    });
  } catch (error) {
    console.error("Register error:", error);

    res.status(500).json({
      message: "Registration failed",
      error: error.message,
    });
  }
};

// ==========================================
// LOGIN
// ==========================================

const login = (req, res) => {
  res.json({
    message: "Login successful",
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      phone: req.user.phone,
    },
  });
};

// ==========================================
// GET CURRENT USER
// ==========================================

const getMe = (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      phone: req.user.phone,
    },
  });
};

// ==========================================
// LOGOUT
// ==========================================

const logout = (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({
        message: "Logout failed",
      });
    }

    req.session.destroy((sessionError) => {
      if (sessionError) {
        return res.status(500).json({
          message: "Session destruction failed",
        });
      }

      res.clearCookie("connect.sid");

      res.json({
        message: "Logged out successfully",
      });
    });
  });
};

module.exports = {
  register,
  login,
  getMe,
  logout,
};
