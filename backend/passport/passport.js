const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;

const User = require("../models/User");

// ==========================================
// LOCAL STRATEGY
// ==========================================

passport.use(
  new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "password",
    },

    async (email, password, done) => {
      try {
        // Find user by email
        const user = await User.findOne({
          email: email.toLowerCase(),
        });

        // User doesn't exist
        if (!user) {
          return done(null, false, {
            message: "Invalid email or password",
          });
        }

        // Check password
        const isMatch = await user.comparePassword(password);

        if (!isMatch) {
          return done(null, false, {
            message: "Invalid email or password",
          });
        }

        // Authentication successful
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    },
  ),
);

// ==========================================
// SERIALIZE USER
// ==========================================

passport.serializeUser((user, done) => {
  done(null, user._id);
});

// ==========================================
// DESERIALIZE USER
// ==========================================

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);

    if (!user) {
      return done(null, false);
    }

    done(null, user);
  } catch (error) {
    done(error);
  }
});

module.exports = passport;
