import axios from "axios";

const api = axios.create({
  // Relative API requests work through the Vite dev proxy and same-origin deployments.
  // Set VITE_API_URL only when the deployed API is hosted on a separate origin.
  baseURL: import.meta.env.VITE_API_URL || "/api",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("smartJourneyToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("smartJourneyToken");
      localStorage.removeItem("smartJourneyUser");
    }
    return Promise.reject(error);
  }
);

// Auth Endpoints
export const authApi = {
  sendOtp: (identifier, type = "phone") => api.post("/auth/send-otp", { identifier, type }),
  verifyOtp: (otpSessionId, otpCode, fullName) => api.post("/auth/verify-otp", { otpSessionId, otpCode, fullName }),
  getMe: () => api.get("/auth/me"),
};

// Travel Search & Live Data Endpoints
export const travelApi = {
  search: (params) => api.get("/search", { params }),
  planItinerary: (params) => api.get("/search/plans", { params }),
  searchLocations: (params) => api.get("/search/locations", { params }),
  getTrainLiveStatus: (trainNo) => api.get(`/trains/${trainNo}/live`),
  checkPnr: (pnr) => api.get(`/trains/pnr/${pnr}`),
  searchBuses: (params) => api.get("/buses/search", { params }),
  getBusSeatMap: (busId) => api.get(`/buses/${busId}/seatmap`),
  getBusLiveTrack: (busId) => api.get(`/buses/${busId}/live-track`),
};

// Booking & Seat Lock Endpoints
export const bookingApi = {
  lockSeats: (data) => api.post("/bookings/lock-seats", data),
  verifyLock: (lockToken) => api.get(`/bookings/verify-lock/${lockToken}`),
  releaseSeats: (lockToken) => api.post("/bookings/release-seats", { lockToken }),
  applyCoupon: (lockToken, couponCode) => api.post("/bookings/apply-coupon", { lockToken, couponCode }),
  create: (data) => api.post("/bookings/create", data),
  cancelPreview: (id) => api.get(`/bookings/${id}/cancel-preview`),
  cancel: (id, reason) => api.post(`/bookings/${id}/cancel`, { reason }),
  ticketUrl: (id) => `${api.defaults.baseURL}/trips/${id}/ticket.pdf`,
  verifyTicket: (ticket) => api.post("/trips/verify-ticket", { ticket }),
};

export const paymentApi = {
  createOrder: (data) => api.post("/payments/create-order", data),
  verify: (data) => api.post("/payments/verify", data),
  simulate: (data) => api.post("/payments/simulate", data),
};

export const accountApi = {
  trips: () => api.get("/trips"),
  saveTrip: (data) => api.post("/trips", data),
  deleteTrip: (id) => api.delete(`/trips/${id}`),
  alerts: () => api.get("/alerts"),
  createAlert: (data) => api.post("/alerts", data),
  toggleAlert: (id) => api.put(`/alerts/${id}/toggle`),
  deleteAlert: (id) => api.delete(`/alerts/${id}`),
  notifications: () => api.get("/notifications"),
  markRead: (id) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put("/notifications/read-all"),
};

export default api;
