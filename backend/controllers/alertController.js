const Alert = require("../models/Alert");
const Notification = require("../models/Notification");

// CREATE PRICE ALERT
const createAlert = async (req, res) => {
  try {
    const { from, to, travelDate, transportMode, targetPrice } = req.body;

    if (!from || !to || targetPrice === undefined) {
      return res.status(400).json({
        message: "From, to and target price are required",
      });
    }

    const alert = await Alert.create({
      user: req.userId,
      from,
      to,
      travelDate,
      transportMode: transportMode || "any",
      targetPrice,
    });

    res.status(201).json({
      message: "Price alert created",
      alert,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// GET MY ALERTS
const getAlerts = async (req, res) => {
  try {
    const alerts = await Alert.find({
      user: req.userId,
    }).sort({
      createdAt: -1,
    });

    res.json({
      count: alerts.length,
      alerts,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// DELETE ALERT
const deleteAlert = async (req, res) => {
  try {
    const alert = await Alert.findOneAndDelete({
      _id: req.params.id,
      user: req.userId,
    });

    if (!alert) {
      return res.status(404).json({
        message: "Alert not found",
      });
    }

    res.json({
      message: "Alert deleted",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// TOGGLE ALERT
const toggleAlert = async (req, res) => {
  try {
    const alert = await Alert.findOne({
      _id: req.params.id,
      user: req.userId,
    });

    if (!alert) {
      return res.status(404).json({
        message: "Alert not found",
      });
    }

    alert.isActive = !alert.isActive;

    await alert.save();

    res.json({
      message: "Alert status updated",
      alert,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// GET NOTIFICATIONS
const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({
      user: req.userId,
    })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      notifications,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// MARK NOTIFICATION AS READ
const readNotification = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      {
        _id: req.params.id,
        user: req.userId,
      },
      {
        isRead: true,
      },
      {
        new: true,
      },
    );

    if (!notification) {
      return res.status(404).json({
        message: "Notification not found",
      });
    }

    res.json({
      notification,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// MARK ALL AS READ
const markAllRead = async (req, res) => {
  try {
    await Notification.updateMany(
      {
        user: req.userId,
        isRead: false,
      },
      {
        isRead: true,
      },
    );

    res.json({
      message: "All notifications marked as read",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

module.exports = {
  createAlert,
  getAlerts,
  deleteAlert,
  toggleAlert,
  getNotifications,
  readNotification,
  markAllRead,
};
