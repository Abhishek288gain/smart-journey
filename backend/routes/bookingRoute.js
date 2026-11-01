const router = require("express").Router();

const protect =
  require("../middleware/auth");

const {
  createBooking,
  getBookings,
  getBooking,
  cancelBooking
} = require("../controllers/bookingController");

router.use(protect);

router.post("/", createBooking);
router.get("/", getBookings);
router.get("/:id", getBooking);
router.put("/:id/cancel", cancelBooking);

module.exports = router;