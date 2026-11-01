const Trip = require("../models/Trip");

// CREATE TRIP
const createTrip = async (req, res) => {
  try {
    const { journey, tripName, passengers, notes } = req.body;

    if (!journey) {
      return res.status(400).json({
        message: "Journey ID is required",
      });
    }

    const trip = await Trip.create({
      user: req.userId,
      journey,
      tripName: tripName || "My Trip",
      passengers: passengers || 1,
      notes: notes || "",
    });

    const result = await trip.populate("journey");

    res.status(201).json({
      message: "Trip saved successfully",
      trip: result,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// GET MY TRIPS
const getTrips = async (req, res) => {
  try {
    const trips = await Trip.find({
      user: req.userId,
    })
      .populate("journey")
      .sort({ createdAt: -1 });

    res.json({
      count: trips.length,
      trips,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// GET SINGLE TRIP
const getTrip = async (req, res) => {
  try {
    const trip = await Trip.findOne({
      _id: req.params.id,
      user: req.userId,
    }).populate("journey");

    if (!trip) {
      return res.status(404).json({
        message: "Trip not found",
      });
    }

    res.json({ trip });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// UPDATE TRIP
const updateTrip = async (req, res) => {
  try {
    const trip = await Trip.findOneAndUpdate(
      {
        _id: req.params.id,
        user: req.userId,
      },
      req.body,
      {
        new: true,
        runValidators: true,
      },
    ).populate("journey");

    if (!trip) {
      return res.status(404).json({
        message: "Trip not found",
      });
    }

    res.json({
      message: "Trip updated",
      trip,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// DELETE TRIP
const deleteTrip = async (req, res) => {
  try {
    const trip = await Trip.findOneAndDelete({
      _id: req.params.id,
      user: req.userId,
    });

    if (!trip) {
      return res.status(404).json({
        message: "Trip not found",
      });
    }

    res.json({
      message: "Trip deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

module.exports = {
  createTrip,
  getTrips,
  getTrip,
  updateTrip,
  deleteTrip,
};
