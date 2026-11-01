const router = require("express").Router();

const protect = require("../middleware/auth");

const {
  createAlert,
  getAlerts,
  deleteAlert,
  toggleAlert,
  getNotifications,
  readNotification,
  markAllRead,
} = require("../controllers/alertController");

router.use(protect);

router.post("/", createAlert);
router.get("/", getAlerts);
router.delete("/:id", deleteAlert);
router.put("/:id/toggle", toggleAlert);

router.get("/notifications", getNotifications);

router.put("/notifications/:id/read", readNotification);

router.put("/notifications/read-all", markAllRead);

module.exports = router;
