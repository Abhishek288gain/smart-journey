import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  CircularProgress,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import { BookmarkBorder, DeleteOutline, Luggage, Refresh } from "@mui/icons-material";
import { accountApi } from "../services/api";

export default function Trips() {
  const [trips, setTrips] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await accountApi.trips();
      setTrips(Array.isArray(response.data.trips) ? response.data.trips : []);
    } catch (err) {
      setError(err.response?.data?.message || "Could not load your saved trips. Check your connection and try again.");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const del = async (id) => {
    if (!confirm("Delete this trip?")) return;
    setDeletingId(id);
    setError("");
    try {
      await accountApi.deleteTrip(id);
      setTrips((items) => items.filter((item) => item._id !== id));
    } catch (err) {
      setError(err.response?.data?.message || "Could not delete this trip. Please try again.");
    } finally { setDeletingId(""); }
  };
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box className="page-head">
        <Box>
          <Typography variant="h4">My Trips</Typography>
          <Typography color="text.secondary">
            Your saved journey plans in one place.
          </Typography>
        </Box>
        <Button variant="contained" href="/">
          Plan New Trip
        </Button>
      </Box>
      {error && <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" size="small" startIcon={<Refresh />} onClick={load}>Retry</Button>}>{error}</Alert>}
      {loading ? <Box className="empty-state" sx={{ display: "grid", placeItems: "center", gap: 1 }}><CircularProgress size={30} /><Typography color="text.secondary">Loading your saved trips…</Typography></Box> : <Grid container spacing={2}>
        {trips.map((t) => {
          const j = t.journey || {};
          const query = new URLSearchParams({ from: j.from || "", to: j.to || "", mode: j.transportMode || "all" });
          if (j.travelDate) query.set("date", j.travelDate);
          return (
            <Grid item xs={12} md={6} key={t._id}>
              <Card className="list-card">
                <CardContent>
                  <Box
                    sx={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <Box>
                      <Typography variant="h6" fontWeight={800}>
                        {j.from} → {j.to}
                      </Typography>
                      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 0.7 }}>
                        <Chip size="small" label={j.transportMode || "all modes"} />
                        {j.travelDate && <Chip size="small" variant="outlined" label={new Date(`${j.travelDate}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} />}
                      </Stack>
                    </Box>
                    <Luggage color="primary" />
                  </Box>
                  <Box sx={{ display: "flex", gap: 1, mt: 2 }}>
                    <Button size="small" variant="outlined" href={`/search?${query.toString()}`}>
                      Search this route
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      startIcon={<DeleteOutline />}
                      disabled={deletingId === t._id}
                      onClick={() => del(t._id)}
                    >
                      {deletingId === t._id ? "Deleting…" : "Delete"}
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>}
      {!loading && !trips.length && !error && (
        <Box className="empty-state">
          <BookmarkBorder sx={{ fontSize: 50 }} />
          <Typography variant="h6">No saved trips yet</Typography>
          <Typography color="text.secondary">
            Search a journey and use the bookmark button to save it.
          </Typography>
          <Button variant="contained" href="/">Plan a trip</Button>
        </Box>
      )}
    </Container>
  );
}
