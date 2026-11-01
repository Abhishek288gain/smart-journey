const prisma = require("../config/prisma");

exports.listTrips = async (req, res, next) => {
  try {
    const rows = await prisma.savedRoute.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: "desc" } });
    res.json({ success: true, trips: rows.map((r) => ({
      _id: r.id, tripName: `${r.originName} → ${r.destName}`, passengers: 1, notes: "",
      journey: { from: r.originName, to: r.destName, transportMode: r.transportMode, travelDate: r.travelDate || null },
      createdAt: r.createdAt,
    })) });
  } catch (err) { next(err); }
};

exports.createTrip = async (req, res, next) => {
  try {
    const { from, to, date, transportMode = "all" } = req.body;
    if (!from?.trim() || !to?.trim()) return res.status(400).json({ success: false, message: "Origin and destination are required" });
    if (!["all", "train", "bus", "flight", "cab"].includes(transportMode)) return res.status(400).json({ success: false, message: "Choose a valid transport mode" });
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ success: false, message: "Travel date must use YYYY-MM-DD format" });
    const originName = from.trim();
    const destName = to.trim();
    const existing = await prisma.savedRoute.findFirst({ where: {
      userId: req.user.id, originName, destName, transportMode, travelDate: date || null,
    } });
    if (existing) return res.json({ success: true, alreadySaved: true, trip: { _id: existing.id, journey: { from: existing.originName, to: existing.destName, transportMode, travelDate: existing.travelDate } } });
    const row = await prisma.savedRoute.create({ data: {
      userId: req.user.id, transportMode, originCode: originName.toUpperCase(), originName,
      destCode: destName.toUpperCase(), destName, travelDate: date || null,
    } });
    res.status(201).json({ success: true, trip: { _id: row.id, journey: { from: row.originName, to: row.destName, transportMode, travelDate: date || null } } });
  } catch (err) { next(err); }
};

exports.deleteTrip = async (req, res, next) => {
  try {
    const result = await prisma.savedRoute.deleteMany({ where: { id: req.params.id, userId: req.user.id } });
    if (!result.count) return res.status(404).json({ success: false, message: "Saved trip not found" });
    res.json({ success: true, message: "Saved trip removed" });
  } catch (err) { next(err); }
};

exports.listAlerts = async (req, res, next) => {
  try {
    const alerts = await prisma.priceAlert.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: "desc" } });
    res.json({ success: true, alerts: alerts.map((a) => ({ ...a, _id: a.id, from: a.origin, to: a.destination })) });
  }
  catch (err) { next(err); }
};

exports.createAlert = async (req, res, next) => {
  try {
    const { from, to, travelDate, transportMode = "any", targetPrice } = req.body;
    const target = Number(targetPrice);
    if (!from?.trim() || !to?.trim() || !Number.isFinite(target) || target <= 0) {
      return res.status(400).json({ success: false, message: "Origin, destination and a positive target price are required" });
    }
    const alert = await prisma.priceAlert.create({ data: {
      userId: req.user.id, origin: from.trim(), destination: to.trim(), travelDate: travelDate || null,
      transportMode, targetPrice: target,
    } });
    res.status(201).json({ success: true, alert: { ...alert, _id: alert.id, from: alert.origin, to: alert.destination } });
  } catch (err) { next(err); }
};

exports.toggleAlert = async (req, res, next) => {
  try {
    const alert = await prisma.priceAlert.findFirst({ where: { id: req.params.id, userId: req.user.id } });
    if (!alert) return res.status(404).json({ success: false, message: "Price alert not found" });
    const updated = await prisma.priceAlert.update({ where: { id: alert.id }, data: { isActive: !alert.isActive } });
    res.json({ success: true, alert: { ...updated, _id: updated.id, from: updated.origin, to: updated.destination } });
  } catch (err) { next(err); }
};

exports.deleteAlert = async (req, res, next) => {
  try {
    const result = await prisma.priceAlert.deleteMany({ where: { id: req.params.id, userId: req.user.id } });
    if (!result.count) return res.status(404).json({ success: false, message: "Price alert not found" });
    res.json({ success: true, message: "Price alert deleted" });
  } catch (err) { next(err); }
};

exports.listNotifications = async (req, res, next) => {
  try {
    const notifications = await prisma.notification.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: "desc" }, take: 50 });
    res.json({ success: true, notifications: notifications.map((n) => ({ ...n, _id: n.id })) });
  } catch (err) { next(err); }
};

exports.markNotificationRead = async (req, res, next) => {
  try {
    const result = await prisma.notification.updateMany({ where: { id: req.params.id, userId: req.user.id }, data: { isRead: true } });
    if (!result.count) return res.status(404).json({ success: false, message: "Notification not found" });
    res.json({ success: true });
  } catch (err) { next(err); }
};

exports.markAllNotificationsRead = async (req, res, next) => {
  try {
    await prisma.notification.updateMany({ where: { userId: req.user.id, isRead: false }, data: { isRead: true } });
    res.json({ success: true });
  } catch (err) { next(err); }
};

exports.evaluatePriceAlerts = async ({ userId, from, to, date, mode, results }) => {
  if (!userId || !results?.length) return;
  const alerts = await prisma.priceAlert.findMany({ where: { userId, isActive: true } });
  for (const alert of alerts) {
    const matchesRoute = alert.origin.toLowerCase() === from.toLowerCase() && alert.destination.toLowerCase() === to.toLowerCase();
    const matchesDate = !alert.travelDate || alert.travelDate === date;
    const matching = results.filter((item) => matchesRoute && matchesDate &&
      (alert.transportMode === "any" || alert.transportMode === "all" || item.type === alert.transportMode) &&
      Number.isFinite(item.minFare) && item.minFare <= alert.targetPrice);
    if (!matching.length) continue;
    const triggerKey = `${date}:${matching.map((item) => item.minFare).sort((a,b) => a-b)[0]}`;
    if (alert.lastTriggeredKey === triggerKey) continue;
    await prisma.notification.create({ data: {
      userId, type: "PRICE_ALERT", title: "Your route hit the target price",
      message: `${from} → ${to} is now available from ₹${Math.min(...matching.map((item) => item.minFare))} (your target: ₹${alert.targetPrice}).`,
    } });
    await prisma.priceAlert.update({ where: { id: alert.id }, data: { lastTriggeredKey: triggerKey } });
  }
};
