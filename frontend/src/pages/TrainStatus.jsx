import { useState } from "react";
import { Alert, Box, Button, Chip, CircularProgress, Container, Paper, TextField, Typography } from "@mui/material";
import { Activity, Clock3, MapPin, RefreshCw, Train } from "lucide-react";
import { travelApi } from "../services/api";

export default function TrainStatus() {
  const [trainNo, setTrainNo] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const search = async (event) => {
    event.preventDefault();
    const query = trainNo.trim();
    if (!query) return;
    setLoading(true); setError(""); setData(null);
    try {
      const response = await travelApi.getTrainLiveStatus(query);
      setData(response.data);
    } catch (err) {
      setError(err.response?.data?.message || "No status is available for this train number.");
    } finally { setLoading(false); }
  };

  return (
    <Container maxWidth="md" sx={{ py: { xs: 3, sm: 5 } }}>
      <Box className="page-head" sx={{ mb: 3 }}>
        <Box><Typography variant="h4" fontWeight={900}>Train status</Typography><Typography color="text.secondary">Look up a train in the available journey catalogue.</Typography></Box>
        <Activity className="text-cyan-300" />
      </Box>
      <Paper component="form" onSubmit={search} sx={{ p: { xs: 2, sm: 3 }, display: "flex", gap: 1.5, alignItems: "flex-start", flexWrap: "wrap", mb: 3 }}>
        <TextField fullWidth label="Train number or catalogue code" placeholder="For example, DEMO-TR-0001" value={trainNo} onChange={(event) => setTrainNo(event.target.value)} inputProps={{ maxLength: 30 }} sx={{ flex: "1 1 250px" }} />
        <Button type="submit" variant="contained" startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <RefreshCw size={16} />} disabled={loading || !trainNo.trim()} sx={{ minHeight: 56 }}>{loading ? "Searching" : "Check status"}</Button>
        <Typography variant="caption" color="text.secondary" sx={{ flexBasis: "100%" }}>Catalogue entries marked DEMO show sample schedule details. A live Indian Railways running-status feed is not connected.</Typography>
      </Paper>
      {error && <Alert severity="info" sx={{ mb: 2 }}>{error}</Alert>}
      {data && <Paper sx={{ p: { xs: 2, sm: 3 } }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2, flexWrap: "wrap", mb: 2 }}>
          <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}><Train className="text-cyan-300" /><Box><Typography variant="h6" fontWeight={900}>{data.trainName}</Typography><Typography color="text.secondary">{data.trainNumber}</Typography></Box></Box>
          <Chip label={data.isLive ? "LIVE PROVIDER DATA" : "SAMPLE SCHEDULE"} color={data.isLive ? "success" : "warning"} variant="outlined" />
        </Box>
        <Alert severity={data.isLive ? "success" : "warning"} sx={{ mb: 2 }}>{data.isLive ? `Last updated ${new Date(data.lastUpdatedAt).toLocaleString()}` : "This is catalogue schedule information, not real-time train tracking. Delays and current position are not available."}</Alert>
        {data.timeline?.length ? <Box sx={{ display: "grid", gap: 1.25 }}>
          {data.timeline.map((stop, index) => <Box key={`${stop.stationCode}-${index}`} sx={{ display: "grid", gridTemplateColumns: "32px minmax(0,1fr) auto", gap: 1.5, alignItems: "center", p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
            <MapPin size={18} className="text-cyan-300" />
            <Box sx={{ minWidth: 0 }}><Typography fontWeight={800}>{stop.stationName}</Typography><Typography variant="caption" color="text.secondary">{stop.stationCode} · {stop.platform ? `Platform ${stop.platform}` : "Platform not supplied"}</Typography></Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: "flex", gap: .5, alignItems: "center" }}><Clock3 size={13} />{stop.scheduledArrival || stop.scheduledDeparture || "Time unavailable"}</Typography>
          </Box>)}
        </Box> : <Alert severity="info">No station timeline is available for this catalogue entry.</Alert>}
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2 }}>Source: {data.source || "Schedule source not supplied"}</Typography>
      </Paper>}
    </Container>
  );
}
