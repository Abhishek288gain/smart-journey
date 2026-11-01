const router = require("express").Router();
const searchController = require("../controllers/searchController");

router.get("/search", searchController.searchLocations);

module.exports = router;
