import { useState } from "react";
import { Alert, Box, Button, Container, Link, Paper, TextField, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { PersonAdd, VerifiedUser } from "@mui/icons-material";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Register() {
  const { sendOtp, verifyOtp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [type, setType] = useState("phone");
  const [step, setStep] = useState("details");
  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [otpSessionId, setOtpSessionId] = useState("");
  const [otp, setOtp] = useState("");
  const [demoOtp, setDemoOtp] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const requestCode = async (event) => {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const result = await sendOtp(identifier.trim(), type);
      setOtpSessionId(result.otpSessionId);
      const mockCode = result.otpMode === "development_mock" ? result.demoOtp || "" : "";
      setDemoOtp(mockCode); setOtp(mockCode); setStep("verify");
    } catch (err) {
      setError(err.response?.data?.message || "Could not send the verification code. Check the details and try again.");
    } finally { setBusy(false); }
  };

  const finishSignup = async (event) => {
    event.preventDefault();
    if (otp.trim().length !== 6) { setError("Enter the 6-digit verification code."); return; }
    setBusy(true); setError("");
    try {
      await verifyOtp(otpSessionId, otp.trim(), name.trim());
      navigate(location.state?.from?.pathname || "/", { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || "Verification failed. Request a new code and try again.");
    } finally { setBusy(false); }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 7 }}>
      <Paper className="auth-card">
        <Box className="auth-icon"><PersonAdd /></Box>
        <Typography variant="h4">Create your account</Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>Verify your phone or email to save trips, bookings and price alerts.</Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {step === "details" ? (
          <Box component="form" onSubmit={requestCode} sx={{ display: "grid", gap: 2 }}>
            <TextField label="Full name" required value={name} autoComplete="name" inputProps={{ maxLength: 80 }} onChange={(e) => setName(e.target.value)} />
            <ToggleButtonGroup exclusive fullWidth value={type} onChange={(_, value) => value && setType(value)} aria-label="Choose verification method">
              <ToggleButton value="phone">Phone OTP</ToggleButton>
              <ToggleButton value="email">Email OTP</ToggleButton>
            </ToggleButtonGroup>
            <TextField label={type === "phone" ? "Phone number" : "Email address (Gmail supported)"} type={type === "phone" ? "tel" : "email"} required value={identifier} autoComplete={type === "phone" ? "tel" : "email"} placeholder={type === "phone" ? "+91 98765 43210" : "you@gmail.com"} onChange={(e) => setIdentifier(e.target.value)} />
            <Button type="submit" variant="contained" size="large" disabled={busy}>{busy ? "Sending code…" : "Send verification code"}</Button>
          </Box>
        ) : (
          <Box component="form" onSubmit={finishSignup} sx={{ display: "grid", gap: 2 }}>
            <Alert severity="info">Enter the code sent to <b>{identifier}</b>. You can use a Gmail address for email verification.</Alert>
            {demoOtp && <Alert severity="success">Demo verification code: <b>{demoOtp}</b></Alert>}
            <TextField label="6-digit verification code" required value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} inputProps={{ inputMode: "numeric", maxLength: 6, autoComplete: "one-time-code" }} />
            <Button type="submit" variant="contained" size="large" startIcon={<VerifiedUser />} disabled={busy || otp.length !== 6}>{busy ? "Verifying…" : "Verify and create account"}</Button>
            <Button type="button" onClick={() => { setStep("details"); setOtpSessionId(""); setOtp(""); setDemoOtp(""); setError(""); }}>Change phone or email</Button>
          </Box>
        )}
        <Typography sx={{ mt: 3 }} color="text.secondary">Already have an account? <Link component={RouterLink} to="/login">Sign in</Link></Typography>
      </Paper>
    </Container>
  );
}
