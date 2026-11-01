require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Journey = require("../models/Journey");

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/smart-journey";

const journeys = [
  {
    fromCity: "Jabalpur",
    fromCode: "JBP",
    toCity: "Mumbai",
    toCode: "BOM",
    travelDate: "2026-09-15",
    modeSummary: "Train + Flight",
    aiRecommended: true,
    tag: "best-overall",
    tagNote: "Save ₹570 • 2.5 hrs faster",
    totalDurationMinutes: 495,
    totalDurationLabel: "08h 15m",
    totalPrice: 3780,
    reliabilityScore: 91,
    legs: [
      {
        mode: "train",
        provider: "Garib Rath Express (12189)",
        fromStation: "Jabalpur Junction (JBP)",
        toStation: "Bhopal Junction (BPL)",
        departTime: "06:30 AM",
        arriveTime: "09:20 AM",
        duration: "2h 50m",
        platformOrGate: "Platform 2",
      },
      {
        mode: "cab",
        provider: "Transfer by Cab",
        fromStation: "Bhopal Junction (BPL)",
        toStation: "Bhopal Airport (BHO)",
        departTime: "09:20 AM",
        arriveTime: "11:00 AM",
        duration: "1h 40m",
        platformOrGate: "--",
        note: "Reach Bhopal",
      },
      {
        mode: "flight",
        provider: "Flight to Mumbai (6E 203)",
        fromStation: "Bhopal Airport (BHO)",
        toStation: "Mumbai Airport (BOM)",
        departTime: "12:25 PM",
        arriveTime: "01:45 PM",
        duration: "1h 30m",
        platformOrGate: "--",
      },
    ],
    route: {
      origin: { lat: 23.1815, lng: 79.9864, label: "Jabalpur" },
      waypoints: [{ lat: 23.2599, lng: 77.4126, label: "Bhopal" }],
      destination: { lat: 19.076, lng: 72.8777, label: "Mumbai" },
    },
  },
  {
    fromCity: "Jabalpur",
    fromCode: "JBP",
    toCity: "Mumbai",
    toCode: "BOM",
    travelDate: "2026-09-15",
    modeSummary: "Direct Flight",
    tag: "fastest",
    tagNote: "Fastest Option",
    totalDurationMinutes: 400,
    totalDurationLabel: "06h 40m",
    totalPrice: 4350,
    reliabilityScore: 89,
    legs: [
      {
        mode: "flight",
        provider: "Direct Flight",
        fromStation: "Jabalpur Airport (JLR)",
        toStation: "Mumbai Airport (BOM)",
        departTime: "07:10 AM",
        arriveTime: "01:50 PM",
        duration: "6h 40m",
        platformOrGate: "Gate 4",
        note: "Includes 1 layover",
      },
    ],
    route: {
      origin: { lat: 23.1815, lng: 79.9864, label: "Jabalpur" },
      waypoints: [],
      destination: { lat: 19.076, lng: 72.8777, label: "Mumbai" },
    },
  },
  {
    fromCity: "Jabalpur",
    fromCode: "JBP",
    toCity: "Mumbai",
    toCode: "BOM",
    travelDate: "2026-09-15",
    modeSummary: "Direct Train",
    tag: "cheapest",
    tagNote: "Most Economical",
    totalDurationMinutes: 980,
    totalDurationLabel: "16h 20m",
    totalPrice: 1450,
    reliabilityScore: 88,
    legs: [
      {
        mode: "train",
        provider: "Direct Train",
        fromStation: "Jabalpur Junction (JBP)",
        toStation: "Mumbai CST (CSMT)",
        departTime: "05:45 PM",
        arriveTime: "10:05 AM",
        duration: "16h 20m",
        platformOrGate: "Platform 1",
      },
    ],
    route: {
      origin: { lat: 23.1815, lng: 79.9864, label: "Jabalpur" },
      waypoints: [],
      destination: { lat: 19.076, lng: 72.8777, label: "Mumbai" },
    },
  },
  {
    fromCity: "Jabalpur",
    fromCode: "JBP",
    toCity: "Mumbai",
    toCode: "BOM",
    travelDate: "2026-09-15",
    modeSummary: "AC Volvo Bus",
    tag: "bus-option",
    tagNote: "Budget Friendly",
    totalDurationMinutes: 1050,
    totalDurationLabel: "17h 30m",
    totalPrice: 1600,
    reliabilityScore: 76,
    legs: [
      {
        mode: "bus",
        provider: "AC Volvo Bus",
        fromStation: "Jabalpur Bus Stand",
        toStation: "Mumbai Central Bus Stand",
        departTime: "06:00 PM",
        arriveTime: "11:30 AM",
        duration: "17h 30m",
        platformOrGate: "Bay 3",
      },
    ],
    route: {
      origin: { lat: 23.1815, lng: 79.9864, label: "Jabalpur" },
      waypoints: [],
      destination: { lat: 19.076, lng: 72.8777, label: "Mumbai" },
    },
  },
];

async function seed() {
  await connectDB(MONGO_URI);
  await Journey.deleteMany({});
  await Journey.insertMany(journeys);
  console.log(`Seeded ${journeys.length} journeys.`);
  await mongoose.connection.close();
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
