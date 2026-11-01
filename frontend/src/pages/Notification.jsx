import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Divider,
  Typography,
} from "@mui/material";
import { DoneAll, Notifications } from "@mui/icons-material";
import { accountApi } from "../services/api";
export default function Notification() {
  const [items, setItems] = useState([]);
  const load = () =>
    accountApi
      .notifications()
      .then((r) => setItems(r.data.notifications || []));
  useEffect(load, []);
  const read = async (id) => {
    await accountApi.markRead(id);
    load();
  };
  const all = async () => {
    await accountApi.markAllRead();
    load();
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
        <Button startIcon={<DoneAll />} onClick={all}>
          Mark all read
        </Button>
      </Box>
      <Card>
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
      </Card>
      {!items.length && (
        <Box className="empty-state">
          <Notifications sx={{ fontSize: 50 }} />
          <Typography>No notifications yet.</Typography>
        </Box>
      )}
    </Container>
  );
}
