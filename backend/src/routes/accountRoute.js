const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middleware/authMiddleware");
const accountController = require("../controllers/accountController");

router.use(authMiddleware);
router.get("/trips", accountController.listTrips);
router.post("/trips", accountController.createTrip);
router.delete("/trips/:id", accountController.deleteTrip);
router.get("/alerts", accountController.listAlerts);
router.post("/alerts", accountController.createAlert);
router.put("/alerts/:id/toggle", accountController.toggleAlert);
router.delete("/alerts/:id", accountController.deleteAlert);
router.get("/notifications", accountController.listNotifications);
router.put("/notifications/:id/read", accountController.markNotificationRead);
router.put("/notifications/read-all", accountController.markAllNotificationsRead);
router.get("/alerts/notifications", accountController.listNotifications);
router.put("/alerts/notifications/:id/read", accountController.markNotificationRead);
router.put("/alerts/notifications/read-all", accountController.markAllNotificationsRead);

module.exports = router;
