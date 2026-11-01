const express = require("express");
const router = express.Router();
const trainController = require("../controllers/trainController");

router.get("/search", trainController.searchTrains);
router.get("/:trainNo/live", trainController.getLiveStatus);
router.get("/pnr/:pnr", trainController.checkPnr);

module.exports = router;
