import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import Search from "./pages/Search";
import BookingFlow from "./pages/BookingFlow";
import Trips from "./pages/Trips";
import Bookings from "./pages/Bookings";
import Alerts from "./pages/Alerts";
import Notification from "./pages/Notification";
import Checkout from "./pages/Checkout";
import VerifyTicket from "./pages/VerifyTicket";
import Login from "./pages/Login";
import TripPlanningChat from "./components/TripPlanningChat";

export default function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/search" element={<Search />} />
        <Route path="/login" element={<Login />} />
        <Route path="/booking/:lockToken" element={<ProtectedRoute><BookingFlow /></ProtectedRoute>} />
        <Route path="/booking" element={<ProtectedRoute><BookingFlow /></ProtectedRoute>} />
        <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
        <Route path="/verify-ticket" element={<VerifyTicket />} />
        <Route path="/trips" element={<ProtectedRoute><Trips /></ProtectedRoute>} />
        <Route path="/bookings" element={<ProtectedRoute><Bookings /></ProtectedRoute>} />
        <Route path="/alerts" element={<ProtectedRoute><Alerts /></ProtectedRoute>} />
        <Route path="/notification" element={<ProtectedRoute><Notification /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <TripPlanningChat />
    </>
  );
}
