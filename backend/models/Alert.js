const mongoose = require("mongoose");

const alertSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    from: {
      type: String,
      required: true,
      trim: true
    },

    to: {
      type: String,
      required: true,
      trim: true
    },

    travelDate: {
      type: Date
    },

    transportMode: {
      type: String,
      enum: ["train", "flight", "bus", "cab", "any"],
      default: "any"
    },

    targetPrice: {
      type: Number,
      required: true
    },

    currentPrice: {
      type: Number
    },

    isActive: {
      type: Boolean,
      default: true
    },

    lastNotifiedAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Alert", alertSchema);