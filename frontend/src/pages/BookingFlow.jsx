import React, { useState, useEffect } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { bookingApi } from "../services/api";
import {
  Clock,
  ShieldCheck,
  User,
  Users,
  Train,
  Bus,
  Plane,
  CarFront,
  MapPin,
  Tag,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Trash2,
  Sparkles,
} from "lucide-react";

export default function BookingFlow() {
  const { lockToken } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const stateData = location.state || {};
  const [lockData, setLockData] = useState(stateData.lockData || null);
  const [loading, setLoading] = useState(!stateData.lockData);
  const [error, setError] = useState(null);

  // 10-minute countdown timer (seconds)
  const [secondsRemaining, setSecondsRemaining] = useState(600);
  const [isExpired, setIsExpired] = useState(false);

  // Passenger entries state (one per locked seat)
  const [passengers, setPassengers] = useState([]);

  // Contact details
  const [contactPhone, setContactPhone] = useState(currentUser?.phone || "");
  const [contactEmail, setContactEmail] = useState(currentUser?.email || "");

  // Bus boarding & dropping points
  const [boardingPoint, setBoardingPoint] = useState("");
  const [droppingPoint, setDroppingPoint] = useState("");

  // Promo coupon
  const [couponCode, setCouponCode] = useState("SMART50");
  const [couponApplied, setCouponApplied] = useState(false);
  const [fareBreakdown, setFareBreakdown] = useState(null);

  // Verify and load lock details if not in route state
  useEffect(() => {
    if (!lockData && lockToken) {
      setLoading(true);
      bookingApi
        .verifyLock(lockToken)
        .then((res) => {
          if (res.data.success) {
            setLockData(res.data.lockData);
          } else {
            setIsExpired(true);
          }
        })
        .catch(() => setIsExpired(true))
        .finally(() => setLoading(false));
    }
  }, [lockToken, lockData]);

  // Initialize passengers based on locked seats
  useEffect(() => {
    if (lockData && lockData.lockedSeats) {
      const seats = lockData.lockedSeats;
      const initialPax = seats.map((seat, idx) => ({
        fullName: idx === 0 && currentUser ? currentUser.fullName : "",
        age: "",
        gender: "",
        seatOrBerthNumber: seat,
        idProofType: "",
        idProofNumber: "",
      }));
      setPassengers(initialPax);
      setFareBreakdown(lockData.fareBreakdown);
    }
  }, [lockData, currentUser]);

  // Live countdown timer hook
  useEffect(() => {
    if (isExpired) return;

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isExpired]);

  // 1-Click Fill from Saved Frequent Travelers
  const handleLoadSavedPassengers = () => {
    if (!currentUser || !currentUser.passengers || currentUser.passengers.length === 0) return;

    const saved = currentUser.passengers;
    setPassengers((prev) =>
      prev.map((p, i) => {
        const savedMatch = saved[i] || saved[0];
        return {
          ...p,
          fullName: savedMatch.fullName,
          age: savedMatch.age,
          gender: savedMatch.gender,
          idProofType: "",
          idProofNumber: "",
        };
      })
    );
  };

  const handlePassengerChange = (index, field, value) => {
    setPassengers((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleApplyCoupon = async () => {
    try {
      const response = await bookingApi.applyCoupon(lockToken, couponCode);
      setCouponApplied(true);
      setFareBreakdown(response.data.fareBreakdown);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || "Could not apply coupon");
    }
  };

  const formatTimer = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
  };

  // Proceed to Phase 4 Razorpay Checkout
  const handleProceedToPayment = () => {
    // Validate passengers
    for (const p of passengers) {
      if (!p.fullName || p.fullName.trim().length === 0) {
        setError("Please provide a name for all passengers");
        return;
      }
      if (!Number.isInteger(Number(p.age)) || Number(p.age) < 1 || Number(p.age) > 120 || !["male", "female", "other"].includes(p.gender)) {
        setError("Enter a valid age and choose a gender for each passenger");
        return;
      }
    }

    // Save details to state and route to Razorpay checkout trigger
    navigate("/checkout", {
      state: {
        lockToken,
        scheduleId: lockData.scheduleId,
        transportMode: lockData.transportMode,
        passengers,
        boardingPoint,
        droppingPoint,
        contactPhone,
        contactEmail,
        fareBreakdown,
        scheduleDetails: lockData.scheduleDetails,
      },
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <p className="text-sm font-semibold flex items-center gap-2 text-slate-400">
          <Clock className="w-5 h-5 animate-spin text-blue-500" />
          Verifying seat hold...
        </p>
      </div>
    );
  }

  if (isExpired) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full p-8 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-4 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/30">
            <Clock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white">10-Minute Hold Expired</h2>
          <p className="text-xs text-slate-400">
            The temporary reservation for your selected seats has expired and been returned to general availability.
          </p>
          <button
            onClick={() => navigate("/search")}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition"
          >
            Search & Reselect Seats
          </button>
        </div>
      </div>
    );
  }

  const isTrain = lockData?.transportMode === "train";
  const transportMode = lockData?.transportMode;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24">
      {/* Top Floating 10-Minute Countdown Banner */}
      <div className="sticky top-16 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3 shadow-lg">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center">
              {isTrain ? <Train className="w-4 h-4" /> : transportMode === "bus" ? <Bus className="w-4 h-4" /> : transportMode === "flight" ? <Plane className="w-4 h-4" /> : <CarFront className="w-4 h-4" />}
            </div>
            <div>
              <p className="text-xs font-bold text-white">
                {lockData?.scheduleDetails?.routeName || "Trip Booking"}
              </p>
              <p className="text-[11px] text-slate-400">
                Seats Locked: <b className="text-emerald-400 font-mono">{lockData?.lockedSeats?.join(", ")}</b>
              </p>
            </div>
          </div>

          {/* Countdown Clock */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold font-mono transition ${
              secondsRemaining < 120
                ? "bg-rose-500/20 border-rose-500/40 text-rose-300 animate-pulse"
                : "bg-slate-950 border-slate-700 text-teal-400"
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Hold Expires in: {formatTimer(secondsRemaining)}</span>
          </div>
        </div>
      </div>

      {/* Main Form & Review Grid */}
      <div className="max-w-6xl mx-auto px-4 mt-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Passenger Details & Preferences */}
          <div className="lg:col-span-8 space-y-6">
            {error && (
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Frequent Traveler 1-Click Banner */}
            {currentUser && currentUser.passengers?.length > 0 && (
              <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <div>
                    <h4 className="text-xs font-bold text-white">Saved Frequent Travelers</h4>
                    <p className="text-[11px] text-slate-400">
                      {currentUser.passengers.length} profiles available in your roster
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleLoadSavedPassengers}
                  className="px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 font-bold text-xs transition"
                >
                  1-Click Autofill
                </button>
              </div>
            )}

            {/* Passenger Forms */}
            <div className="space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" /> Passenger Details (Govt ID Proof Required)
              </h2>

              {passengers.map((pax, idx) => (
                <div
                  key={idx}
                  className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800/90 space-y-4"
                >
                  <div className="flex justify-between items-center pb-3 border-b border-slate-800">
                    <span className="text-xs font-bold text-white flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs font-mono">
                        {idx + 1}
                      </span>
                      Passenger {idx + 1}
                    </span>
                    <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      Assigned Seat: {pax.seatOrBerthNumber}
                    </span>
                  </div>

                  {/* Name & Age & Gender */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-6 bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase">
                        Full Name (as per ID)
                      </label>
                      <input
                        type="text"
                        required
                        value={pax.fullName}
                        onChange={(e) => handlePassengerChange(idx, "fullName", e.target.value)}
                        placeholder="e.g. Aryan Sharma"
                        className="w-full bg-transparent text-sm font-semibold text-white focus:outline-none mt-0.5"
                      />
                    </div>

                    <div className="sm:col-span-3 bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase">
                        Age
                      </label>
                      <input
                        type="number"
                        required
                        min="1"
                        max="120"
                        value={pax.age}
                        onChange={(e) => handlePassengerChange(idx, "age", e.target.value === "" ? "" : Number(e.target.value))}
                        className="w-full bg-transparent text-sm font-semibold text-white focus:outline-none mt-0.5"
                      />
                    </div>

                    <div className="sm:col-span-3 bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase">
                        Gender
                      </label>
                      <select
                        required
                        value={pax.gender}
                        onChange={(e) => handlePassengerChange(idx, "gender", e.target.value)}
                        className="w-full bg-transparent text-sm font-semibold text-white focus:outline-none mt-0.5 cursor-pointer"
                      >
                        <option value="" className="bg-slate-900">Select</option>
                        <option value="male" className="bg-slate-900">Male</option>
                        <option value="female" className="bg-slate-900">Female</option>
                        <option value="other" className="bg-slate-900">Other</option>
                      </select>
                    </div>
                  </div>

                  {/* ID Proof Type & Number */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-4 bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase">
                        ID Proof Type
                      </label>
                      <select
                        value={pax.idProofType}
                        onChange={(e) => handlePassengerChange(idx, "idProofType", e.target.value)}
                        className="w-full bg-transparent text-xs font-semibold text-white focus:outline-none mt-0.5 cursor-pointer"
                      >
                        <option value="" className="bg-slate-900">Not provided</option>
                        <option value="AADHAAR" className="bg-slate-900">Aadhaar Card</option>
                        <option value="PAN" className="bg-slate-900">PAN Card</option>
                        <option value="PASSPORT" className="bg-slate-900">Passport</option>
                        <option value="VOTER_ID" className="bg-slate-900">Voter ID</option>
                      </select>
                    </div>

                    <div className="sm:col-span-8 bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase">
                        ID Proof Number
                      </label>
                      <input
                        type="text"
                        value={pax.idProofNumber}
                        onChange={(e) => handlePassengerChange(idx, "idProofNumber", e.target.value)}
                        placeholder="XXXX-XXXX-1234"
                        className="w-full bg-transparent text-xs font-mono font-semibold text-white focus:outline-none mt-0.5"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Contact Details */}
            <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800/90 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Ticket Dispatch & SMS Updates
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase">
                    Phone for booking updates
                  </label>
                  <input
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    className="w-full bg-transparent text-xs font-mono font-semibold text-white focus:outline-none mt-0.5"
                  />
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase">
                    Email Address (for PDF e-ticket)
                  </label>
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className="w-full bg-transparent text-xs font-semibold text-white focus:outline-none mt-0.5"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Trip Summary & Fare Breakdown */}
          <div className="lg:col-span-4 space-y-5">
            {/* Fare Breakdown Card */}
            <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 pb-2 border-b border-slate-800">
                Fare Breakdown
              </h3>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between items-center text-slate-300">
                  <span>
                    Base Fare ({fareBreakdown?.seatCount || 1} × ₹{fareBreakdown?.ratePerSeat || 1080})
                  </span>
                  <span className="font-mono font-semibold">₹{fareBreakdown?.baseFare}</span>
                </div>

                <div className="flex justify-between items-center text-slate-300">
                  <span>GST & Service Taxes (5%)</span>
                  <span className="font-mono font-semibold">₹{fareBreakdown?.taxes}</span>
                </div>

                <div className="flex justify-between items-center text-slate-300">
                  <span>Platform Convenience Fee</span>
                  <span className="font-mono font-semibold">₹{fareBreakdown?.convenienceFee}</span>
                </div>

                {fareBreakdown?.discount > 0 && (
                  <div className="flex justify-between items-center text-emerald-400 font-semibold">
                    <span>Coupon Discount ({fareBreakdown.couponApplied})</span>
                    <span className="font-mono">-₹{fareBreakdown.discount}</span>
                  </div>
                )}
              </div>

              {/* Coupon Input */}
              <div className="pt-2 border-t border-slate-800 flex gap-1.5">
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder="Promo Code"
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white uppercase focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleApplyCoupon}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-teal-300 font-bold text-xs rounded-xl transition"
                >
                  Apply
                </button>
              </div>

              {/* Total Payable */}
              <div className="pt-3 border-t border-slate-800 flex justify-between items-center">
                <div>
                  <span className="text-xs text-slate-400">Total Payable Amount</span>
                  <p className="text-2xl font-black text-white font-mono">
                    ₹{fareBreakdown?.totalPayable}
                  </p>
                </div>
                <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/20 px-2.5 py-1 rounded-full border border-emerald-500/30">
                  Guaranteed Lock
                </span>
              </div>

              {/* Proceed to Payment Button */}
              <button
                type="button"
                onClick={handleProceedToPayment}
                className="w-full py-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-teal-500 hover:from-blue-500 hover:to-teal-400 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-blue-500/25 transition text-sm group"
              >
                <span>Proceed to Pay (₹{fareBreakdown?.totalPayable})</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
