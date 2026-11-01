import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Grid,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import { ConfirmationNumber, Cancel, Download } from "@mui/icons-material";
import api, { bookingApi } from "../services/api";
import "../styles/checkout.css";

export default function Bookings() {
  const [bookings, setBookings] = useState([]);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const load = () =>
    api
      .get("/bookings")
      .then((r) => setBookings(r.data.bookings || []))
      .catch((e) =>
        setError(e.response?.data?.message || "Could not load bookings"),
      );
  useEffect(load, []);
  const showCancelPreview = async (id) => {
    setError("");
    try {
      const response = await bookingApi.cancelPreview(id);
      setPreview(response.data);
      setSelectedId(id);
    } catch (e) { setError(e.response?.data?.message || "Could not calculate refund"); }
  };
  const cancel = async () => {
    try {
      await bookingApi.cancel(selectedId, "Customer request");
      setPreview(null); setSelectedId(null); load();
    } catch (e) { setError(e.response?.data?.message || "Cancellation failed"); }
  };
  return (
    <Container maxWidth="lg" className="booking-page" sx={{ py: 4 }}>
      <div className="booking-page-heading">
        <span className="checkout-eyebrow">YOUR TRAVEL, ALL IN ONE PLACE</span>
        <Typography variant="h4" sx={{ mt: 1 }}>My bookings</Typography>
        <Typography color="text.secondary">Tickets, journey details and cancellation options.</Typography>
      </div>
      {error && <Alert sx={{ mb: 2 }}>{error}</Alert>}
      <Grid container spacing={2}>
        {bookings.map((b) => {
          return (
            <Grid item xs={12} md={6} key={b.id}>
              <Card className="list-card">
                <CardContent>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div className="booking-card-top"><ConfirmationNumber fontSize="small" /> {b.transportMode} journey</div>
                    <Chip size="small" label={b.status} color={b.status === "CONFIRMED" ? "success" : b.status === "CANCELLED" ? "error" : "default"} />
                  </Box>
                  <div className="booking-card-route">{b.originName}<span>→</span>{b.destinationName}</div>
                  <div className="booking-card-meta"><span>Booking reference</span><strong>{b.bookingPnr}</strong><span>·</span><span>{b.schedule?.departureTime ? new Date(b.schedule.departureTime).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Date unavailable"}</span></div>
                  <div className="booking-card-footer"><div><Typography variant="caption" color="text.secondary">Total paid</Typography><strong>₹{Number(b.totalAmount || 0).toLocaleString("en-IN")}</strong></div><Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <Button
                    size="small"
                    disabled={b.status !== "CONFIRMED"}
                    color="error"
                    startIcon={<Cancel />}
                    onClick={() => showCancelPreview(b.id)}
                  >
                    Cancel Booking
                  </Button>
                  <Button size="small" variant="outlined" startIcon={<Download />} href={bookingApi.ticketUrl(b.id)} target="_blank">Ticket</Button>
                  </Box></div>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>
      {!bookings.length && !error && (
        <Box className="empty-state">
          <ConfirmationNumber sx={{ fontSize: 50 }} />
          <Typography variant="h6">No bookings yet</Typography>
          <Button href="/search" variant="contained">
            Find a Journey
          </Button>
        </Box>
      )}
      <Dialog className="cancel-dialog" open={Boolean(preview)} onClose={() => setPreview(null)}>
        <DialogTitle>Cancellation and refund estimate</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 1 }}>{preview?.policyExplanation}</Typography>
          <Typography>Cancellation fee: ₹{Number(preview?.cancellationFee || 0).toLocaleString("en-IN")}</Typography>
          <Typography fontWeight={800}>Estimated refund: ₹{Number(preview?.refundableAmount || 0).toLocaleString("en-IN")}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreview(null)}>Keep booking</Button>
          <Button color="error" variant="contained" disabled={!preview?.canCancel} onClick={cancel}>Confirm cancellation</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
