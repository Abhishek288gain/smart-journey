import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Alert, Box, Button, CircularProgress, Container, Typography } from "@mui/material";
import { ArrowLeft, Bus, Check, CreditCard, LockKeyhole, ShieldCheck, Train, WalletCards, Landmark, Sparkles, TicketCheck } from "lucide-react";
import { bookingApi, paymentApi } from "../services/api";
import "../styles/checkout.css";

const loadRazorpay = () => new Promise((resolve) => {
  if (window.Razorpay) return resolve(true);
  const script = document.createElement("script");
  script.src = "https://checkout.razorpay.com/v1/checkout.js";
  script.onload = () => resolve(true);
  script.onerror = () => resolve(false);
  document.body.appendChild(script);
});

export default function Checkout() {
  const location = useLocation();
  const previewMode = new URLSearchParams(location.search).get("preview") === "1";
  const state = location.state || (previewMode ? {
    lockToken: "preview-seat-hold",
    scheduleId: "preview-schedule",
    transportMode: "train",
    passengers: [{ fullName: "Aarav Sharma", seatOrBerthNumber: "B3-42" }, { fullName: "Meera Sharma", seatOrBerthNumber: "B3-43" }],
    fareBreakdown: { baseFare: 2160, taxes: 108, convenienceFee: 40, discount: 50, couponApplied: "SMART50", totalPayable: 2258 },
    scheduleDetails: { routeName: "Mahakoshal Express · 12189", origin: "Jabalpur Junction", destination: "Mumbai CSMT" },
  } : null);
  const navigate = useNavigate();
  const [method, setMethod] = useState("upi");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [booking, setBooking] = useState(null);
  const [paymentRef, setPaymentRef] = useState("");
  const [mockOrder, setMockOrder] = useState(null);
  const payable = Number(state?.fareBreakdown?.totalPayable || 0);

  const bookingPayload = useMemo(() => state ? ({
    lockToken: state.lockToken,
    scheduleId: state.scheduleId,
    transportMode: state.transportMode,
    passengers: state.passengers,
    boardingPoint: state.boardingPoint,
    droppingPoint: state.droppingPoint,
    contactPhone: state.contactPhone,
    contactEmail: state.contactEmail,
  }) : null, [state]);

  if (!state?.lockToken) return <Container sx={{ py: 8 }}><Alert severity="warning">Checkout session missing. Please select seats again.</Alert><Button onClick={() => navigate("/search")}>Back to search</Button></Container>;

  const finishBooking = async (verified) => {
    const result = await bookingApi.create({ ...bookingPayload,
      razorpayOrderId: verified.orderId,
      razorpayPaymentId: verified.paymentId,
      paymentMethod: method.toUpperCase(),
      idempotencyKey: `sj_${verified.paymentId}`,
    });
    setBooking(result.data.booking);
    setPaymentRef(verified.paymentId);
  };

  const beginPayment = async () => {
    if (previewMode) { setError("Preview mode: payment is disabled."); return; }
    setBusy(true); setError("");
    try {
      const orderResponse = await paymentApi.createOrder({ lockToken: state.lockToken, amount: payable, currency: "INR" });
      const order = orderResponse.data;
      if (order.isMockSandbox) {
        setMockOrder(order);
        return;
      }
      const loaded = await loadRazorpay();
      if (!loaded) throw new Error("Could not load Razorpay Checkout. Check your connection and try again.");
      setBusy(false);
      const checkout = new window.Razorpay({
        key: order.keyId, amount: order.amount, currency: order.currency,
        name: "Smart Journey", description: "Journey booking", order_id: order.orderId,
        prefill: { name: state.passengers?.[0]?.fullName, email: state.contactEmail, contact: state.contactPhone },
        theme: { color: "#2563eb" },
        handler: async (response) => {
          setBusy(true);
          try {
            const verified = await paymentApi.verify({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              paymentMethod: method.toUpperCase(),
            });
            await finishBooking(verified.data);
          } catch (e) { setError(e.response?.data?.message || e.message || "Payment verification failed"); }
          finally { setBusy(false); }
        },
        modal: { ondismiss: () => { setBusy(false); setError("Payment was cancelled. You can safely retry checkout."); } },
      });
      checkout.on("payment.failed", (event) => { setBusy(false); setError(event.error?.description || "Payment failed. You can safely retry checkout."); });
      checkout.open();
    } catch (e) {
      setError(e.response?.data?.message || e.message || "Payment could not be started");
    } finally { setBusy(false); }
  };

  const simulatePaymentOutcome = async (outcome) => {
    if (!mockOrder) return;
    setBusy(true);
    setError("");
    try {
      const result = await paymentApi.simulate({
        razorpayOrderId: mockOrder.orderId,
        razorpayPaymentId: outcome === "success" ? `pay_mock_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}` : undefined,
        paymentMethod: method.toUpperCase(),
        outcome,
      });
      setMockOrder(null);
      if (outcome === "success") await finishBooking(result.data);
      else setError(result.data.message || "Test payment ended without a charge. Retry when ready.");
    } catch (e) {
      setError(e.response?.data?.message || e.message || "Could not complete the test payment");
    } finally { setBusy(false); }
  };

  const trip = state.scheduleDetails || {};
  const transportIcon = state.transportMode === "bus" ? <Bus size={19} /> : <Train size={19} />;
  const methods = [
    { id: "upi", label: "UPI", detail: "GPay, PhonePe, Paytm", icon: <WalletCards size={20} /> },
    { id: "card", label: "Cards", detail: "Credit or debit card", icon: <CreditCard size={20} /> },
    { id: "netbanking", label: "Netbanking", detail: "All major banks", icon: <Landmark size={20} /> },
  ];

  return <main className="checkout-page">
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
      {booking ? <section className="checkout-success">
        <div className="success-orbit"><TicketCheck size={34} /></div>
        <span className="checkout-eyebrow">TEST PAYMENT VERIFIED</span>
        <h1>Sample booking recorded<span>.</span></h1>
        <p className="success-route">{booking.origin} <span>→</span> {booking.destination}</p>
        <div className="success-pnr"><small>SMART JOURNEY BOOKING REFERENCE</small><strong>{booking.bookingReference || booking.pnr}</strong><span>Internal booking reference · Payment ref {paymentRef}</span></div>
        <Button className="ticket-download" variant="contained" href={bookingApi.ticketUrl(booking.id)} target="_blank" rel="noreferrer">Download sample travel record PDF</Button>
        <button className="checkout-back" onClick={() => navigate("/bookings")}>View my bookings <ArrowLeft size={15} /></button>
      </section> : <>
        <button className="checkout-back checkout-back-top" onClick={() => navigate(-1)}><ArrowLeft size={15} /> Back to passenger details</button>
        <div className="checkout-heading">
          <div><span className="checkout-eyebrow">ALMOST THERE</span><h1>Secure <span>checkout</span></h1><p>One final step before your journey begins.</p></div>
          <div className="checkout-secure"><LockKeyhole size={15} /> Encrypted & secure</div>
        </div>
        <div className="checkout-steps"><div className="checkout-step done"><i><Check size={13} /></i><span>Journey</span></div><b /><div className="checkout-step done"><i><Check size={13} /></i><span>Passengers</span></div><b /><div className="checkout-step active"><i>3</i><span>Payment</span></div></div>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <div className="checkout-grid">
          <section className="checkout-panel payment-panel">
            <div className="checkout-panel-head"><div className="panel-icon"><LockKeyhole size={18} /></div><div><h2>Choose payment method</h2><p>Your payment details stay protected</p></div></div>
            <div className="payment-options">{methods.map((option) => <button type="button" key={option.id} onClick={() => setMethod(option.id)} className={`payment-option ${method === option.id ? "selected" : ""}`}>
              <span className="payment-option-icon">{option.icon}</span><span className="payment-option-copy"><strong>{option.label}</strong><small>{option.detail}</small></span><span className="payment-radio">{method === option.id && <i />}</span>
            </button>)}</div>
            <div className="mock-note"><Sparkles size={17} /><div><strong>{previewMode ? "Design preview" : "Test payment"}</strong><p>{previewMode ? "Sample journey details are shown. Payment is disabled in preview mode." : "A test payment simulates checkout; no real charge is made."}</p></div><span>{previewMode ? "PREVIEW" : "TEST"}</span></div>
            <Button className="checkout-pay-button" fullWidth size="large" variant="contained" disabled={busy || previewMode} onClick={beginPayment}>
              {busy ? <CircularProgress size={22} color="inherit" /> : <>{previewMode ? "Preview only" : `Pay ₹${payable.toLocaleString("en-IN")}`} <span>{previewMode ? "Payment disabled" : "Continue securely"}</span></>}
            </Button>
            <div className="checkout-trust"><ShieldCheck size={15} /> Protected payment <span>·</span> No card data stored</div>
          </section>
          <aside className="checkout-panel journey-summary">
            <div className="summary-topline"><span>JOURNEY SUMMARY</span><span className="summary-mode">{transportIcon}{state.transportMode || "travel"}</span></div>
            <h2>{trip.routeName || "Your selected journey"}</h2>
            <div className="summary-route"><div><i className="route-dot origin" /><span><small>FROM</small><strong>{trip.origin || "Origin"}</strong></span></div><div className="route-connector" /><div><i className="route-dot destination" /><span><small>TO</small><strong>{trip.destination || "Destination"}</strong></span></div></div>
            <div className="summary-seats"><span>Selected seats</span><strong>{state.passengers?.map((p) => p.seatOrBerthNumber).join(", ") || "—"}</strong></div>
            <div className="summary-divider" />
            <h3>Fare breakdown</h3>
            <div className="fare-line"><span>Base fare</span><strong>₹{state.fareBreakdown?.baseFare ?? payable}</strong></div>
            <div className="fare-line"><span>Taxes & service fees</span><strong>₹{state.fareBreakdown?.taxes ?? 0}</strong></div>
            <div className="fare-line"><span>Convenience fee</span><strong>₹{state.fareBreakdown?.convenienceFee ?? 0}</strong></div>
            {state.fareBreakdown?.discount > 0 && <div className="fare-line fare-discount"><span>Coupon · {state.fareBreakdown.couponApplied}</span><strong>−₹{state.fareBreakdown.discount}</strong></div>}
            <div className="summary-divider" />
            <div className="fare-total"><span>Total payable</span><strong>₹{payable.toLocaleString("en-IN")}</strong></div>
            <div className="hold-reminder"><LockKeyhole size={15} /><span>Your seats are temporarily reserved while you complete payment.</span></div>
          </aside>
        </div>
      </>}
      {mockOrder && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="mock-payment-title">
        <section className="w-full max-w-md rounded-3xl border border-cyan-300/20 bg-slate-900 p-6 text-slate-100 shadow-2xl">
          <div className="mb-3 inline-flex rounded-xl bg-cyan-300/10 p-3 text-cyan-200"><Sparkles size={22} /></div>
          <h2 id="mock-payment-title" className="text-xl font-black">Test payment simulator</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">This test order is for {mockOrder.amountInRupees?.toLocaleString("en-IN", { style: "currency", currency: "INR" })}. Choose an outcome to test the checkout flow; no real payment will be made.</p>
          <div className="mt-5 grid gap-2"><Button disabled={busy} variant="contained" onClick={() => simulatePaymentOutcome("success")}>Simulate successful payment</Button><Button disabled={busy} color="error" variant="outlined" onClick={() => simulatePaymentOutcome("failed")}>Simulate payment failure</Button><Button disabled={busy} color="inherit" onClick={() => simulatePaymentOutcome("cancelled")}>Cancel payment</Button></div>
        </section>
      </div>}
    </Container>
  </main>;
}
