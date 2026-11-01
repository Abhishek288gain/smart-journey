const express = require("express");
const router = express.Router();
const busController = require("../controllers/busController");

router.get("/search", busController.searchBuses);
router.get("/:busId/seatmap", busController.getSeatMap);
router.get("/:busId/live-track", busController.getLiveTracking);

module.exports = router;
