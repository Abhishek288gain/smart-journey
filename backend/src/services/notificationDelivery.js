async function deliver(notification, user) {
  if (user.email && process.env.RESEND_API_KEY && process.env.OTP_FROM_EMAIL) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.OTP_FROM_EMAIL,
        to: [user.email],
        subject: notification.title,
        text: notification.message,
      }),
    });
    if (!response.ok) throw new Error("Email notification delivery failed");
    return "email";
  }
  if (user.phone && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER) {
    const body = new URLSearchParams({ To: user.phone, From: process.env.TWILIO_FROM_NUMBER, Body: `${notification.title}: ${notification.message}` });
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!response.ok) throw new Error("SMS notification delivery failed");
    return "sms";
  }
  return null;
}

module.exports = { deliver };
