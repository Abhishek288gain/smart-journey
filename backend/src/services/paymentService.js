const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");
const seatLockService = require("./seatLockService");
const cacheService = require("../config/cache");
const prisma = require("../config/prisma");

const isMockMode = () => process.env.PAYMENT_MODE === "mock" ||
  (process.env.NODE_ENV !== "production" && !process.env.RAZORPAY_KEY_ID);
const razorpayCredentials = () => {
  const { RAZORPAY_KEY_ID: keyId, RAZORPAY_KEY_SECRET: keySecret } = process.env;
  if (!keyId || !keySecret) throw new Error("Configure RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET for Razorpay checkout");
  return { keyId, keySecret };
};

class PaymentService {
  async createOrder({ lockToken, amount, currency = "INR", userId }) {
    if (!lockToken) {
      throw new Error("Lock token is required to create a payment order");
    }

    const lockData = await seatLockService.verifyLock(lockToken, userId);
    if (!lockData) {
      throw new Error("10-minute seat lock has expired. Please select seats again.");
    }
    const isMockSandbox = isMockMode();
    if (currency !== "INR") throw new Error("Smart Journey checkout currently supports INR only");

    const orderAmount = Number(lockData.fareBreakdown?.totalPayable);
    if (!Number.isFinite(orderAmount) || orderAmount <= 0) throw new Error("The seat lock has no valid payable fare");
    const schedule = await prisma.schedule.findUnique({ where: { id: lockData.scheduleId }, include: { route: true } });
    if (!schedule) throw new Error("The selected service schedule no longer exists");
    if (schedule.route.dataStatus !== "VERIFIED" && !isMockSandbox) {
      throw new Error("This sample service cannot be purchased with live payment credentials");
    }
    const paise = Math.round(orderAmount * 100);
    let orderId;
    if (isMockSandbox) {
      orderId = `order_${uuidv4().replace(/-/g, "").substring(0, 14)}`;
    } else {
      const { keyId, keySecret } = razorpayCredentials();
      const response = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ amount: paise, currency, receipt: `sj_${uuidv4().slice(0, 24)}` }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.description || "Razorpay order creation failed");
      orderId = data.id;
    }
    const order = { orderId, amount: paise, amountInRupees: orderAmount, currency,
      keyId: isMockSandbox ? null : process.env.RAZORPAY_KEY_ID, lockToken, isMockSandbox };
    await cacheService.set(`payment-order:${orderId}`, {
      orderId, lockToken, amount: Math.round(orderAmount * 100), currency,
      status: "CREATED", createdAt: Date.now(),
    }, 600);
    return order;
  }

  async getOrder(orderId) {
    return orderId ? cacheService.get(`payment-order:${orderId}`) : null;
  }

  async simulateOutcome({ orderId, userId, outcome }) {
    if (!isMockMode()) throw new Error("Payment simulation is disabled outside development/test mode");
    if (!["failed", "cancelled"].includes(outcome)) throw new Error("Choose a supported mock payment outcome");
    const order = await this.getOrder(orderId);
    if (!order || order.status !== "CREATED") throw new Error("Mock payment order is missing, expired, or already processed");
    if (!await seatLockService.verifyLock(order.lockToken, userId)) throw new Error("Seat hold expired or belongs to a different account");
    order.status = outcome === "failed" ? "FAILED" : "CANCELLED";
    await cacheService.set(`payment-order:${orderId}`, order, 600);
    return { verified: false, orderId, status: order.status, message: outcome === "failed" ? "Test payment failed. You can retry checkout." : "Test payment was cancelled. You can retry checkout." };
  }

  async createRefund(paymentId, amountRupees) {
    if (!paymentId || amountRupees <= 0) return { refundId: null, status: "ZERO_REFUND" };
    if (isMockMode()) {
      return { refundId: `rfnd_${uuidv4().replace(/-/g, "").slice(0, 14)}`, status: "PROCESSED" };
    }
    const { keyId, keySecret } = razorpayCredentials();
    const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}/refund`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ amount: Math.round(amountRupees * 100) }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.description || "Razorpay refund request failed");
    return { refundId: data.id, status: data.status === "processed" ? "PROCESSED" : "INITIATED" };
  }

  async verifyPayment({ razorpayOrderId, razorpayPaymentId, razorpaySignature, paymentMethod = "UPI", mock = false, userId }) {
    if (!razorpayOrderId || !razorpayPaymentId) {
      throw new Error("Razorpay order and payment IDs are required");
    }
    const order = await cacheService.get(`payment-order:${razorpayOrderId}`);
    if (!order) throw new Error("Payment order was not found or has expired");
    const mockMode = isMockMode();
    const keySecret = mockMode ? (process.env.RAZORPAY_KEY_SECRET || "development-mock-only") : razorpayCredentials().keySecret;
    if (mock) {
      if (!mockMode) throw new Error("Mock payment is disabled outside mock mode");
      razorpaySignature = crypto.createHmac("sha256", keySecret)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`).digest("hex");
    }
    const expected = crypto.createHmac("sha256", keySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`).digest("hex");
    const valid = typeof razorpaySignature === "string" &&
      Buffer.from(expected).length === Buffer.from(razorpaySignature).length &&
      crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(razorpaySignature));
    if (!valid) throw new Error("Cryptographic payment signature verification failed");
    if (!mockMode) {
      const { keyId, keySecret: liveSecret } = razorpayCredentials();
      const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(razorpayPaymentId)}`, {
        headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${liveSecret}`).toString("base64")}` },
      });
      const payment = await response.json();
      if (!response.ok || payment.order_id !== razorpayOrderId || payment.amount !== order.amount ||
          payment.currency !== order.currency || payment.status !== "captured" || payment.captured !== true) {
        throw new Error("Payment provider has not confirmed a captured payment for the expected order and amount");
      }
      paymentMethod = String(payment.method || paymentMethod).toUpperCase();
    }
    const lockData = await seatLockService.verifyLock(order.lockToken, userId);
    if (!lockData) throw new Error("Seat hold expired. Please select seats again.");
    order.status = "VERIFIED";
    order.paymentId = razorpayPaymentId;
    order.paymentMethod = ["UPI", "CARD", "NETBANKING", "WALLET"].includes(String(paymentMethod).toUpperCase())
      ? String(paymentMethod).toUpperCase() : "UPI";
    await cacheService.set(`payment-order:${razorpayOrderId}`, order, 600);
    return { verified: true, message: "Payment successfully verified", paymentId: razorpayPaymentId,
      orderId: razorpayOrderId, lockToken: order.lockToken, amount: order.amount,
      amountInRupees: order.amount / 100, paymentMethod: order.paymentMethod };
  }

  async handleWebhook(payload) {
    const event = payload?.event;
    const payment = payload?.payload?.payment?.entity;
    if (!payment?.order_id) return { processed: false, reason: "No payment order in event" };
    const order = await cacheService.get(`payment-order:${payment.order_id}`);
    if (!order) return { processed: false, reason: "Unknown or expired order" };
    if (event === "payment.captured" && payment.amount === order.amount && payment.currency === order.currency) {
      order.status = "VERIFIED";
      order.paymentId = payment.id;
      order.paymentMethod = String(payment.method || "UPI").toUpperCase();
      await cacheService.set(`payment-order:${payment.order_id}`, order, 600);
    } else if (event === "payment.failed") {
      order.status = "FAILED";
      await cacheService.set(`payment-order:${payment.order_id}`, order, 600);
    }
    return { processed: true, event, orderId: payment.order_id };
  }

  verifyWebhookSignature(payloadString, signatureHeader) {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!signatureHeader || !webhookSecret || !Buffer.isBuffer(payloadString)) return false;
    try {
      const expectedSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(payloadString)
        .digest("hex");
      return Buffer.from(expectedSignature).length === Buffer.from(signatureHeader).length &&
        crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signatureHeader));
    } catch (e) {
      return false;
    }
  }
}

module.exports = new PaymentService();
