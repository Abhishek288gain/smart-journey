const express = require("express");
const router = express.Router();
const bookingController = require("../controllers/bookingController");
const { authMiddleware } = require("../middleware/authMiddleware");

// Seat Locking
router.post("/lock-seats", authMiddleware, bookingController.lockSeats);
router.post("/apply-coupon", authMiddleware, bookingController.applyCoupon);
router.get("/verify-lock/:lockToken", authMiddleware, bookingController.verifyLock);
router.post("/release-seats", authMiddleware, bookingController.releaseSeats);

// Booking Creation & Management
router.post("/create", authMiddleware, bookingController.createBooking);
router.get("/:id", authMiddleware, bookingController.getBookingById);
router.get("/:id/ticket.pdf", authMiddleware, bookingController.downloadTicketPdf);
router.get("/", authMiddleware, bookingController.listBookings);

// Cancellation & Refund Flow
router.get("/:id/cancel-preview", authMiddleware, bookingController.cancelPreview);
router.post("/:id/cancel", authMiddleware, bookingController.cancelBooking);

module.exports = router;
