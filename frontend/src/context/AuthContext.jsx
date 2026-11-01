import { createContext, useContext, useEffect, useState } from "react";
import api, { authApi } from "../services/api";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem("smartJourneyUser");
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      const token = localStorage.getItem("smartJourneyToken");
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const response = await authApi.getMe();
        setCurrentUser(response.data.user);
        localStorage.setItem("smartJourneyUser", JSON.stringify(response.data.user));
      } catch (error) {
        setCurrentUser(null);
        localStorage.removeItem("smartJourneyToken");
        localStorage.removeItem("smartJourneyUser");
      } finally {
        setLoading(false);
      }
    };

    checkUser();
  }, []);

  const sendOtp = async (identifier, type = "phone") => {
    const res = await authApi.sendOtp(identifier, type);
    return res.data;
  };

  const verifyOtp = async (otpSessionId, otpCode, fullName) => {
    const res = await authApi.verifyOtp(otpSessionId, otpCode, fullName);
    const { token, user } = res.data;
    localStorage.setItem("smartJourneyToken", token);
    localStorage.setItem("smartJourneyUser", JSON.stringify(user));
    setCurrentUser(user);
    return res.data;
  };

  const loginWithDemoUser = async () => {
    const otpRes = await sendOtp("+919876543210", "phone");
    if (otpRes.otpMode !== "development_mock" || !otpRes.demoOtp) throw new Error("Quick login is only available in local development mode");
    return await verifyOtp(otpRes.otpSessionId, otpRes.demoOtp, "Sample Traveler");
  };

  const logout = () => {
    localStorage.removeItem("smartJourneyToken");
    localStorage.removeItem("smartJourneyUser");
    setCurrentUser(null);
  };

  const value = {
    currentUser,
    setCurrentUser,
    loading,
    sendOtp,
    verifyOtp,
    loginWithDemoUser,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
export default AuthContext;
