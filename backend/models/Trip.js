const mongoose = require("mongoose");

const tripSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    journey: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Journey",
      required: true,
    },

    tripName: {
      type: String,
      default: "My Trip",
      trim: true,
    },

    passengers: {
      type: Number,
      default: 1,
      min: 1,
    },

    status: {
      type: String,
      enum: ["planned", "upcoming", "ongoing", "completed", "cancelled"],
      default: "planned",
    },

    notes: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Trip", tripSchema);
