const mongoose = require("mongoose");

// One leg of a journey, e.g. "Train from Jabalpur to Bhopal"
const LegSchema = new mongoose.Schema(
  {
    mode: {
      type: String,
      enum: ["train", "flight", "bus", "cab"],
      required: true,
    },
    provider: { type: String, required: true }, // e.g. "Garib Rath Express (12189)"
    fromStation: { type: String, required: true },
    toStation: { type: String, required: true },
    departTime: { type: String, required: true }, // display string e.g. "06:30 AM"
    arriveTime: { type: String, required: true },
    duration: { type: String, required: true }, // e.g. "2h 50m"
    platformOrGate: { type: String, default: "--" },
    note: { type: String, default: "" },
  },
  { _id: false },
);

const JourneySchema = new mongoose.Schema(
  {
    fromCity: { type: String, required: true }, // "Jabalpur"
    fromCode: { type: String, required: true }, // "JBP"
    toCity: { type: String, required: true }, // "Mumbai"
    toCode: { type: String, required: true }, // "BOM"
    travelDate: { type: String, required: true }, // "2026-09-15"

    modeSummary: { type: String, required: true }, // "Train + Flight", "Direct Flight", etc.
    legs: { type: [LegSchema], default: [] },

    totalDurationMinutes: { type: Number, required: true },
    totalDurationLabel: { type: String, required: true }, // "08h 15m"
    totalPrice: { type: Number, required: true },
    reliabilityScore: { type: Number, min: 0, max: 100, required: true },

    tag: {
      type: String,
      enum: ["best-overall", "fastest", "cheapest", "bus-option", "standard"],
      default: "standard",
    },
    tagNote: { type: String, default: "" }, // e.g. "Save ₹570 • 2.5 hrs faster"
    aiRecommended: { type: Boolean, default: false },

    route: {
      // simplified coordinates used to draw the mock route line on the map panel
      origin: { lat: Number, lng: Number, label: String },
      waypoints: [{ lat: Number, lng: Number, label: String }],
      destination: { lat: Number, lng: Number, label: String },
    },
  },
  { timestamps: true },
);

JourneySchema.index({ fromCity: "text", toCity: "text" });

module.exports = mongoose.model("Journey", JourneySchema);
