import React from "react";
import { Box, Typography } from "@mui/material";
import {
  AutoAwesome,
  CompareArrows,
  LocationOn,
  NotificationsActive,
  Security,
} from "@mui/icons-material";
const items = [
  [<AutoAwesome />, "AI Recommended", "Best route for you"],
  [<CompareArrows />, "Compare All", "Trains, flights, buses & more"],
  [<LocationOn />, "Live Tracking", "Real-time journey updates"],
  [<NotificationsActive />, "Price Alerts", "Get notified for price drops"],
  [<Security />, "Secure & Easy", "Safe bookings, easy travel"],
];
export default function FeatureStrip() {
  return (
    <Box className="feature-strip">
      {items.map(([icon, title, sub]) => (
        <Box className="feature-item" key={title}>
          <Box className="feature-icon">{icon}</Box>
          <Box>
            <Typography fontWeight={800} variant="body2">
              {title}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {sub}
            </Typography>
          </Box>
        </Box>
      ))}
    </Box>
  );
}
