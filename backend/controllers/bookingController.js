const crypto = require("crypto");

const Booking = require("../models/Booking");
const Journey = require("../models/Journey");
const Notification = require("../models/Notification");

// CREATE BOOKING
const createBooking = async (req, res) => {
  try {
    const { journeyId, tripId, passengers, seatNumbers } = req.body;

    if (!journeyId) {
      return res.status(400).json({
        message: "Journey ID is required",
      });
    }

    const journey = await Journey.findById(journeyId);

    if (!journey) {
      return res.status(404).json({
        message: "Journey not found",
      });
    }

    const passengerList = passengers?.length
      ? passengers
      : [{ name: "Primary Passenger" }];

    const totalPrice = journey.price * passengerList.length;

    const bookingReference =
      "SJ-" + crypto.randomBytes(4).toString("hex").toUpperCase();

    const booking = await Booking.create({
      user: req.userId,

      trip: tripId || undefined,

      journey: journey._id,

      bookingReference,

      provider: journey.provider,

      transportMode: journey.transportMode,

      from: journey.from,

      to: journey.to,

      departureTime: journey.departureDate,

      arrivalTime: journey.arrivalDate,

      passengers: passengerList,

      seatNumbers: seatNumbers || [],

      classType: journey.classType,

      price: totalPrice,

      paymentStatus: "paid",

      bookingStatus: "confirmed",
    });

    // CREATE NOTIFICATION
    await Notification.create({
      user: req.userId,

      title: "Booking Confirmed",

      message: `Your booking ${bookingReference} has been confirmed.`,

      type: "booking",
    });

    const result = await booking.populate("journey");

    res.status(201).json({
      message: "Booking confirmed",
      booking: result,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// GET MY BOOKINGS
const getBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({
      user: req.userId,
    })
      .populate("journey")
      .populate("trip")
      .sort({ createdAt: -1 });

    res.json({
      count: bookings.length,
      bookings,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// GET SINGLE BOOKING
const getBooking = async (req, res) => {
  try {
    const booking = await Booking.findOne({
      _id: req.params.id,
      user: req.userId,
    })
      .populate("journey")
      .populate("trip");

    if (!booking) {
      return res.status(404).json({
        message: "Booking not found",
      });
    }

    res.json({ booking });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// CANCEL BOOKING
const cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findOneAndUpdate(
      {
        _id: req.params.id,
        user: req.userId,
      },
      {
        bookingStatus: "cancelled",
        paymentStatus: "refunded",
      },
      {
        new: true,
      },
    );

    if (!booking) {
      return res.status(404).json({
        message: "Booking not found",
      });
    }

    await Notification.create({
      user: req.userId,

      title: "Booking Cancelled",

      message: `Booking ${booking.bookingReference} has been cancelled.`,

      type: "booking",
    });

    res.json({
      message: "Booking cancelled",
      booking,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

module.exports = {
  createBooking,
  getBookings,
  getBooking,
  cancelBooking,
};
