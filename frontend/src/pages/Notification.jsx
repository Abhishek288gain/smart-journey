import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Divider,
  Alert,
  CircularProgress,
  Typography,
} from "@mui/material";
import { DoneAll, Notifications } from "@mui/icons-material";
import { accountApi } from "../services/api";
export default function Notification() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = () => {
    setLoading(true); setError("");
    return accountApi.notifications()
      .then((r) => setItems(Array.isArray(r.data.notifications) ? r.data.notifications : []))
      .catch((e) => setError(e.response?.data?.message || "Could not load updates. Please refresh and try again."))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);
  const read = async (id) => {
    try { await accountApi.markRead(id); await load(); }
    catch (e) { setError(e.response?.data?.message || "Could not mark this update as read."); }
  };
  const all = async () => {
    try { await accountApi.markAllRead(); await load(); }
    catch (e) { setError(e.response?.data?.message || "Could not mark updates as read."); }
  };
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box className="page-head">
        <Box>
          <Typography variant="h4">Notifications</Typography>
          <Typography color="text.secondary">
            Booking updates, price alerts and journey reminders.
          </Typography>
        </Box>
        <Button startIcon={<DoneAll />} onClick={all} disabled={!items.some((item) => !item.isRead)}>
          Mark all read
        </Button>
      </Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading && <Box className="empty-state"><CircularProgress /><Typography color="text.secondary">Loading your updates…</Typography></Box>}
      {!loading && <Card>
        {items.map((n, i) => (
          <Box key={n._id}>
            <CardContent
              sx={{
                display: "flex",
                gap: 2,
                alignItems: "flex-start",
                background: n.isRead ? "transparent" : "rgba(33,150,243,.07)",
              }}
            >
              <Notifications color={n.isRead ? "disabled" : "primary"} />
              <Box sx={{ flex: 1 }}>
                <Typography fontWeight={800}>{n.title}</Typography>
                <Typography color="text.secondary">{n.message}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {new Date(n.createdAt).toLocaleString()}
                </Typography>
              </Box>
              {!n.isRead && (
                <Button size="small" onClick={() => read(n._id)}>
                  Read
                </Button>
              )}
            </CardContent>
            {i < items.length - 1 && <Divider />}
          </Box>
        ))}
      </Card>}
      {!loading && !items.length && !error && (
        <Box className="empty-state">
          <Notifications sx={{ fontSize: 50 }} />
          <Typography>No notifications yet.</Typography>
        </Box>
      )}
    </Container>
  );
}
