const express = require("express");
const router = express.Router();
const bookingController = require("../controllers/bookingController");
const { authMiddleware } = require("../middleware/authMiddleware");

router.post("/verify-ticket", bookingController.verifyTicket);
router.get("/:id/ticket.pdf", authMiddleware, bookingController.downloadTicketPdf);

module.exports = router;
