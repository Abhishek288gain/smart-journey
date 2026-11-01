const express = require("express");

const router = express.Router();

const {
  getJourneys,
  getRecommendations
} = require("../controllers/journeyController");

// Get all journeys
router.get("/", getJourneys);

// AI recommendations
router.get("/recommendations", getRecommendations);

module.exports = router;