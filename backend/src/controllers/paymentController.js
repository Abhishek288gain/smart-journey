const paymentService = require("../services/paymentService");

exports.createOrder = async (req, res, next) => {
  try {
    const { lockToken, amount, currency } = req.body;
    const order = await paymentService.createOrder({ lockToken, amount, currency, userId: req.user.id });
    res.json({
      success: true,
      ...order,
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.verifyPayment = async (req, res, next) => {
  try {
    const result = await paymentService.verifyPayment({ ...req.body, userId: req.user.id });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

exports.simulatePayment = async (req, res, next) => {
  try {
    if (req.body.outcome === "success") {
      const result = await paymentService.verifyPayment({ ...req.body, mock: true, userId: req.user.id });
      return res.json({ success: true, ...result });
    }
    const result = await paymentService.simulateOutcome({ orderId: req.body.razorpayOrderId, outcome: req.body.outcome, userId: req.user.id });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.handleWebhook = async (req, res, next) => {
  try {
    const signature = req.headers["x-razorpay-signature"];
    const payload = req.rawBody;
    if (!payload) return res.status(400).json({ success: false, message: "Raw webhook request body is required for signature verification" });
    const isValid = paymentService.verifyWebhookSignature(payload, signature);
    console.log(`📡 [RAZORPAY WEBHOOK] Event: ${req.body.event}, Signature Valid: ${isValid}`);
    if (!isValid) return res.status(400).json({ success: false, message: "Invalid webhook signature" });
    const result = await paymentService.handleWebhook(req.body);
    res.json({ success: true, status: "acknowledged", ...result });
  } catch (err) {
    next(err);
  }
};
