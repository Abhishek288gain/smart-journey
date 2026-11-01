const prisma = require("../config/prisma");
const searchService = require("./searchService");
const cacheService = require("../config/cache");
const notificationDelivery = require("./notificationDelivery");

let running = false;

async function run() {
  if (running) return;
  running = true;
  const lockToken = `${process.pid}:${Date.now()}`;
  try {
    const acquired = await cacheService.setNX("job:notification-monitor", lockToken, 240);
    if (!acquired) return;
    const alerts = await prisma.priceAlert.findMany({ where: { isActive: true } });
    for (const alert of alerts) {
      try {
        await searchService.search({
          from: alert.origin,
          to: alert.destination,
          date: alert.travelDate || new Date().toISOString().slice(0, 10),
          mode: ["any", "all"].includes(alert.transportMode) ? "all" : alert.transportMode,
          sortBy: "cheapest",
          userId: alert.userId,
        });
      } catch (err) { console.warn("Price alert check failed:", err.message); }
    }

    const now = new Date();
    const upcoming = await prisma.booking.findMany({
      where: { status: "CONFIRMED", departureTime: { gt: now, lte: new Date(now.getTime() + 24 * 60 * 60 * 1000) } },
      select: { id: true, userId: true, bookingPnr: true, departureTime: true, originName: true, destinationName: true },
    });
    for (const booking of upcoming) {
      const hours = (booking.departureTime.getTime() - now.getTime()) / 3600000;
      const type = hours <= 2 ? "REMINDER_2H" : hours <= 24 ? "REMINDER_24H" : null;
      if (!type) continue;
      const existing = await prisma.notification.findFirst({ where: { bookingId: booking.id, type } });
      if (existing) continue;
      await prisma.notification.create({ data: {
        userId: booking.userId, bookingId: booking.id, type,
        title: type === "REMINDER_2H" ? "Your journey starts soon" : "Your journey is tomorrow",
        message: `PNR ${booking.bookingPnr} · ${booking.originName} → ${booking.destinationName}. Departure: ${booking.departureTime.toLocaleString("en-IN")}.`,
      } });
    }

    const emailReady = Boolean(process.env.RESEND_API_KEY && process.env.OTP_FROM_EMAIL);
    const smsReady = Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER);
    if (emailReady || smsReady) {
      const recentCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const pending = await prisma.notification.findMany({
        where: { deliveredAt: null, createdAt: { gte: recentCutoff } },
        include: { user: true }, orderBy: { createdAt: "asc" }, take: 100,
      });
      for (const notification of pending) {
        try {
          const channel = await notificationDelivery.deliver(notification, notification.user);
          if (channel) await prisma.notification.update({ where: { id: notification.id }, data: { deliveredAt: new Date() } });
        } catch (err) { console.warn("Notification delivery failed:", err.message); }
      }
    }
  } catch (err) { console.warn("Notification monitor failed:", err.message); }
  finally { running = false; }
}

module.exports = { run };
