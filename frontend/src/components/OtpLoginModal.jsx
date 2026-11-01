import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { X, Smartphone, Mail, ShieldCheck, Zap, ArrowRight, CheckCircle2 } from "lucide-react";

export default function OtpLoginModal({ isOpen, onClose }) {
  const { sendOtp, verifyOtp, loginWithDemoUser } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [fullName, setFullName] = useState("");
  const [type, setType] = useState("phone"); // "phone" | "email"
  const [step, setStep] = useState("IDENTIFIER"); // "IDENTIFIER" | "OTP"
  const [otpSessionId, setOtpSessionId] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [demoOtpHint, setDemoOtpHint] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    if (!identifier) {
      setError("Please enter your phone or email");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await sendOtp(identifier, type);
      setOtpSessionId(data.otpSessionId);
      const isDevelopmentMock = data.otpMode === "development_mock" && Boolean(data.demoOtp);
      setDemoOtpHint(isDevelopmentMock ? data.demoOtp : "");
      setOtpCode(isDevelopmentMock ? data.demoOtp : "");
      setStep("OTP");
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault();
    if (!otpCode || otpCode.length < 4) {
      setError("Please enter the 6-digit OTP");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await verifyOtp(otpSessionId, otpCode, fullName);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await loginWithDemoUser();
      onClose();
    } catch (err) {
      setError("Quick login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-700/60 rounded-3xl shadow-2xl overflow-hidden text-slate-100 my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-blue-600 to-teal-500 text-white shadow-lg shadow-blue-500/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Smart Journey Login</h3>
              <p className="text-xs text-slate-400">Instant OTP verification for Train & Bus</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Quick development login */}
          {import.meta.env.DEV && <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-900/30 via-indigo-900/20 to-teal-900/30 border border-blue-500/30 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-blue-300 flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-400" /> Try a traveler account
              </p>
              <p className="text-[11px] text-slate-300 mt-0.5">Development-only test sign-in</p>
            </div>
            <button
              onClick={handleDemoLogin}
              disabled={loading}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition shadow-md shadow-blue-600/30 flex items-center gap-1"
            >
              1-Click Login
            </button>
          </div>}

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              {error}
            </div>
          )}

          {step === "IDENTIFIER" ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setType("phone")}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition ${
                    type === "phone" ? "bg-slate-800 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" /> Mobile OTP
                </button>
                <button
                  type="button"
                  onClick={() => setType("email")}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition ${
                    type === "email" ? "bg-slate-800 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" /> Email OTP
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                  {type === "phone" ? "Mobile Phone Number:" : "Email Address:"}
                </label>
                <input
                  type={type === "phone" ? "tel" : "email"}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={type === "phone" ? "+91 98765 43210" : "aryan@example.com"}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                  required
                  autoComplete={type === "phone" ? "tel" : "email"}
                />
              </div>

              {type === "phone" && <p className="-mt-2 text-[11px] text-slate-500">Enter a valid 10-digit Indian mobile number, with or without +91.</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-teal-500 hover:from-blue-500 hover:to-teal-400 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition shadow-lg shadow-blue-500/25 disabled:opacity-50"
              >
                {loading ? "Sending OTP..." : "Send Verification OTP"}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs flex justify-between items-center">
                <span className="text-slate-400">Code sent to: <b className="text-white">{identifier}</b></span>
                <button
                  type="button"
                  onClick={() => setStep("IDENTIFIER")}
                  className="text-blue-400 hover:underline text-xs"
                >
                  Change
                </button>
              </div>

              {type === "phone" && <div><label className="mb-1.5 block text-xs font-semibold text-slate-400">Your name (for new accounts)</label><input value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={80} autoComplete="name" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none" placeholder="Full name" /></div>}

              {demoOtpHint && (
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center justify-between">
                  <span>Test OTP code: <b className="font-mono text-white text-sm">{demoOtpHint}</b></span>
                  <span className="text-[10px] text-emerald-400 font-semibold px-2 py-0.5 rounded bg-emerald-500/20">Auto-filled</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                  Enter 6-Digit OTP:
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="123456"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-center text-xl font-mono tracking-widest text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading || (type === "phone" && fullName.trim().length < 2)}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-teal-500 hover:from-blue-500 hover:to-teal-400 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition shadow-lg shadow-blue-500/25 disabled:opacity-50"
              >
                {loading ? "Verifying..." : "Verify & Complete Login"}
                <CheckCircle2 className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
