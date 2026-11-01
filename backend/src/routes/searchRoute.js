const express = require("express");
const router = express.Router();
const searchController = require("../controllers/searchController");
const { optionalAuthMiddleware } = require("../middleware/authMiddleware");

router.get("/", optionalAuthMiddleware, searchController.search);
router.get("/plans", searchController.planItinerary);
router.get("/locations", searchController.searchLocations);

module.exports = router;
