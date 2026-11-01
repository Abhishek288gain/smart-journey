import { useLocation, useNavigate } from "react-router-dom";
import OtpLoginModal from "../components/OtpLoginModal";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = location.state?.from || "/";
  return <div className="min-h-[70vh]" aria-label="Sign in"><OtpLoginModal isOpen onClose={() => navigate(returnTo, { replace: true })} /></div>;
}
