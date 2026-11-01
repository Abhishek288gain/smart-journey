import { useEffect, useState } from "react";
import {
  Alert as MuiAlert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import {
  AddAlert,
  DeleteOutline,
  NotificationsActive,
} from "@mui/icons-material";
import { accountApi } from "../services/api";

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    from: "Jabalpur",
    to: "Mumbai",
    travelDate: "",
    transportMode: "any",
    targetPrice: 3000,
  });
  const load = () =>
    accountApi
      .alerts()
      .then((r) => setAlerts(r.data.alerts || []))
      .catch((e) =>
        setError(e.response?.data?.message || "Could not load alerts"),
      );
  useEffect(load, []);
  const create = async () => {
    try {
      await accountApi.createAlert(form);
      setOpen(false);
      load();
    } catch (e) {
      setError(e.response?.data?.message || "Could not create alert");
    }
  };
  const toggle = async (id) => {
    await accountApi.toggleAlert(id);
    load();
  };
  const del = async (id) => {
    await accountApi.deleteAlert(id);
    load();
  };
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box className="page-head">
        <Box>
          <Typography variant="h4">Price Alerts</Typography>
          <Typography color="text.secondary">
            Get notified when your route reaches your target price.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddAlert />}
          onClick={() => setOpen(true)}
        >
          Create Alert
        </Button>
      </Box>
      {error && <MuiAlert sx={{ mb: 2 }}>{error}</MuiAlert>}
      <Grid container spacing={2}>
        {alerts.map((a) => (
          <Grid item xs={12} md={6} key={a._id}>
            <Card className="list-card">
              <CardContent>
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Box>
                    <Typography variant="h6" fontWeight={800}>
                      {a.from} → {a.to}
                    </Typography>
                    <Typography color="text.secondary">
                      Target ₹{Number(a.targetPrice).toLocaleString()} ·{" "}
                      {a.transportMode}
                    </Typography>
                  </Box>
                  <NotificationsActive
                    color={a.isActive ? "secondary" : "disabled"}
                  />
                </Box>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    mt: 2,
                  }}
                >
                  <Typography>
                    {a.currentPrice
                      ? `Current ₹${a.currentPrice}`
                      : "Waiting for price update"}
                  </Typography>
                  <Switch checked={a.isActive} onChange={() => toggle(a._id)} />
                  <Button color="error" onClick={() => del(a._id)}>
                    <DeleteOutline />
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
      {!alerts.length && (
        <Box className="empty-state">
          <NotificationsActive sx={{ fontSize: 50 }} />
          <Typography variant="h6">No price alerts</Typography>
          <Typography color="text.secondary">
            Create one for a route you plan to travel.
          </Typography>
        </Box>
      )}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Create Price Alert</DialogTitle>
        <DialogContent sx={{ display: "grid", gap: 2, pt: "10px !important" }}>
          <TextField
            label="From"
            value={form.from}
            onChange={(e) => setForm({ ...form, from: e.target.value })}
          />
          <TextField
            label="To"
            value={form.to}
            onChange={(e) => setForm({ ...form, to: e.target.value })}
          />
          <TextField
            label="Travel Date"
            type="date"
            InputLabelProps={{ shrink: true }}
            value={form.travelDate}
            onChange={(e) => setForm({ ...form, travelDate: e.target.value })}
          />
          <TextField
            select
            label="Mode"
            value={form.transportMode}
            onChange={(e) =>
              setForm({ ...form, transportMode: e.target.value })
            }
          >
            {["any", "train", "flight", "bus", "cab"].map((x) => (
              <MenuItem key={x} value={x}>
                {x}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Target Price"
            type="number"
            value={form.targetPrice}
            onChange={(e) => setForm({ ...form, targetPrice: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={create}>
            Create Alert
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
