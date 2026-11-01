import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Divider,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import {
  AirplanemodeActive,
  DirectionsBus,
  DirectionsCar,
  EventAvailable,
  Train,
} from "@mui/icons-material";
import { useNavigate, useParams } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

export default function JourneyDetails() {
  const { id } = useParams();
  const [j, setJ] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const nav = useNavigate();
  useEffect(() => {
    api
      .get(`/journeys/${id}`)
      .then((r) => setJ(r.data.journey || r.data))
      .catch((e) => setError(e.response?.data?.message || "Journey not found"));
  }, [id]);
  if (error)
    return (
      <Container sx={{ py: 5 }}>
        <Alert>{error}</Alert>
      </Container>
    );
  if (!j) return <Container sx={{ py: 5 }}>Loading...</Container>;
  const price = j.price || j.totalPrice || 0;
  const mode = (j.transportMode || "train").toLowerCase();
  const icon =
    mode === "flight" ? (
      <AirplanemodeActive />
    ) : mode === "bus" ? (
      <DirectionsBus />
    ) : mode === "cab" ? (
      <DirectionsCar />
    ) : (
      <Train />
    );
  const save = async () => {
    if (!user) return nav("/login");
    setSaving(true);
    try {
      await api.post("/trips", {
        journey: j._id,
        tripName: `${j.from} → ${j.to}`,
      });
      nav("/trips");
    } catch (e) {
      setError(e.response?.data?.message || "Could not save");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Box className="detail-card">
            <Stack direction="row" alignItems="center" spacing={2}>
              <Box className="mode-icon large">{icon}</Box>
              <Box>
                <Typography variant="h4">
                  {j.from} → {j.to}
                </Typography>
                <Typography color="text.secondary">
                  {j.provider} · {mode.toUpperCase()}
                </Typography>
              </Box>
            </Stack>
            <Divider sx={{ my: 3 }} />
            <Grid container spacing={2}>
              {[
                ["Duration", j.duration || j.totalDuration || "—"],
                ["Price", `₹ ${Number(price).toLocaleString()}`],
                ["Reliability", `${j.reliability ?? 90}%`],
                ["Class", j.classType || "Economy"],
              ].map(([a, b]) => (
                <Grid item xs={6} sm={3} key={a}>
                  <Typography variant="caption" color="text.secondary">
                    {a}
                  </Typography>
                  <Typography variant="h6" fontWeight={800}>
                    {b}
                  </Typography>
                </Grid>
              ))}
            </Grid>
            <Box className="timeline">
              <Typography fontWeight={800}>Journey timeline</Typography>
              <Box className="timeline-row">
                <span className="dot green" />
                <Box>
                  <Typography fontWeight={700}>
                    {j.departureTime || j.departureDate || "Departure"}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {j.from}
                  </Typography>
                </Box>
              </Box>
              <Box className="timeline-row">
                <span className="dot blue" />
                <Box>
                  <Typography fontWeight={700}>
                    {j.arrivalTime || j.arrivalDate || "Arrival"}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {j.to}
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Box>
        </Grid>
        <Grid item xs={12} md={4}>
          <Box className="booking-card">
            <Typography variant="h6" fontWeight={800}>
              Ready to travel?
            </Typography>
            <Typography color="text.secondary" sx={{ my: 2 }}>
              Save this journey or continue to secure your booking.
            </Typography>
            <Button
              fullWidth
              variant="outlined"
              sx={{ mb: 1.2 }}
              onClick={save}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Trip"}
            </Button>
            <Button
              fullWidth
              variant="contained"
              startIcon={<EventAvailable />}
              onClick={() => nav(`/bookings?journey=${j._id}`)}
            >
              Book Journey
            </Button>
            <Chip label="Secure confirmation" sx={{ mt: 2 }} />
          </Box>
        </Grid>
      </Grid>
    </Container>
  );
}
