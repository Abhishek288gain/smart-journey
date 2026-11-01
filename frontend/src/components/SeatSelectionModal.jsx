import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { travelApi, bookingApi } from "../services/api";
import {
  X,
  Bus,
  Train,
  Plane,
  CarFront,
  ShieldCheck,
  Check,
  AlertCircle,
  RefreshCw,
  Clock,
  Layers,
  ArrowRight,
} from "lucide-react";

export default function SeatSelectionModal({ isOpen, onClose, trip }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Bus specific state
  const [deck, setDeck] = useState("lower"); // "lower" | "upper"
  const [seatMapData, setSeatMapData] = useState(null);
  const [selectedSeats, setSelectedSeats] = useState([]);

  // Train specific state
  const [trainClass, setTrainClass] = useState("3A");
  const [passengerCount, setPassengerCount] = useState(1);
  const [berthPreference, setBerthPreference] = useState("lower");

  useEffect(() => {
    if (isOpen && trip) {
      setSelectedSeats([]);
      setError(null);

      if (trip.type === "bus") {
        setLoading(true);
        travelApi
          .getBusSeatMap(trip.id)
          .then((res) => {
            if (res.data.success) {
              setSeatMapData(res.data);
            }
          })
          .catch((e) => {
            console.error("Failed to fetch seat map", e);
          })
          .finally(() => setLoading(false));
      } else {
        // Default train class to first available
        if (trip.classes && trip.classes.length > 0) {
          setTrainClass(trip.classes[0].code);
        }
      }
    }
  }, [isOpen, trip]);

  if (!isOpen || !trip) return null;

  const isBus = trip.type === "bus";
  const isTrain = trip.type === "train";

  // Toggle seat selection for Bus
  const handleSeatClick = (seat) => {
    if (seat.status === "BOOKED" || seat.status === "LOCKED") return;

    if (selectedSeats.includes(seat.seatNo)) {
      setSelectedSeats(selectedSeats.filter((s) => s !== seat.seatNo));
    } else {
      if (selectedSeats.length >= 6) {
        setError("Maximum 6 seats can be selected per booking");
        return;
      }
      setSelectedSeats([...selectedSeats, seat.seatNo]);
      setError(null);
    }
  };

  // Lock seats & proceed to Booking Flow
  const handleProceedToLock = async () => {
    setError(null);
    let seatsToLock = [];

    if (isBus) {
      if (selectedSeats.length === 0) {
        setError("Please select at least 1 seat on the bus seat map");
        return;
      }
      seatsToLock = selectedSeats;
    } else {
      const prefix = isTrain
        ? (trainClass === "1A" ? "H1" : trainClass === "2A" ? "A1" : trainClass === "3A" ? "B3" : "S4")
        : trip.type === "flight" ? "F1" : "C1";
      const startNum = Math.floor(20 + Math.random() * 30);
      seatsToLock = Array.from({ length: passengerCount }, (_, i) => `${prefix}-${startNum + i}`);
    }

    setLoading(true);
    try {
      const lockRes = await bookingApi.lockSeats({
        scheduleId: trip.id,
        transportMode: trip.type,
        selectedSeats: seatsToLock,
        classType: isBus ? "SLEEPER" : trainClass,
      });

      if (lockRes.data.success) {
        onClose();
        navigate(`/booking/${lockRes.data.lockToken}`, {
          state: {
            lockData: lockRes.data,
            tripDetails: trip,
            berthPreference,
          },
        });
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to reserve seats. Please retry.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-700/70 rounded-3xl shadow-2xl overflow-hidden text-slate-100 my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-5 md:p-6 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-2xl flex items-center justify-center ${
                isBus
                  ? "bg-teal-500/20 text-teal-400 border border-teal-500/30"
                : "bg-blue-600/20 text-blue-400 border border-blue-500/30"
              }`}
            >
              {isBus ? <Bus className="w-6 h-6" /> : isTrain ? <Train className="w-6 h-6" /> : trip.type === "flight" ? <Plane className="w-6 h-6" /> : <CarFront className="w-6 h-6" />}
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                {isBus ? "Select Bus Seats & Berths" : isTrain ? "Select Train Class & Berths" : trip.type === "flight" ? "Choose Flight Cabin" : "Choose Cab Type"}
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> 10-Min Atomic Lock
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                {trip.name} (#{trip.numberOrCode}) • {trip.origin.city} → {trip.destination.city}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto space-y-6">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* BUS SEAT SELECTION LAYOUT */}
          {isBus && (
            <div className="space-y-6">
              {/* Deck Toggle & Legend */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-slate-950 rounded-2xl border border-slate-800">
                <div className="flex gap-2">
                  <button
                    onClick={() => setDeck("lower")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                      deck === "lower"
                        ? "bg-teal-600 text-white shadow-md shadow-teal-500/20"
                        : "text-slate-400 hover:text-white bg-slate-900"
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" /> Lower Deck
                  </button>
                  <button
                    onClick={() => setDeck("upper")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                      deck === "upper"
                        ? "bg-teal-600 text-white shadow-md shadow-teal-500/20"
                        : "text-slate-400 hover:text-white bg-slate-900"
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" /> Upper Deck
                  </button>
                </div>

                {/* Seat Map Legend */}
                <div className="flex items-center gap-3 text-[11px] text-slate-400">
                  <div className="flex items-center gap-1">
                    <div className="w-3.5 h-3.5 rounded bg-slate-800 border border-slate-600" />
                    <span>Available</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3.5 h-3.5 rounded bg-emerald-500 border border-emerald-400" />
                    <span>Selected</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3.5 h-3.5 rounded bg-pink-500/20 border border-pink-500" />
                    <span>Female</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3.5 h-3.5 rounded bg-slate-950 border border-slate-800 opacity-40" />
                    <span>Booked</span>
                  </div>
                </div>
              </div>

              {/* Interactive Bus Deck Grid */}
              <div className="p-6 bg-slate-950 rounded-3xl border border-slate-800/80 flex flex-col items-center">
                <div className="w-full max-w-md bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
                  {/* Front / Steering indicator */}
                  <div className="flex justify-between items-center text-[11px] font-bold uppercase tracking-wider text-slate-500 pb-2 border-b border-slate-800">
                    <span>Front / Driver Cabin</span>
                    <span className="text-teal-400 font-mono">{deck.toUpperCase()} DECK (2+1)</span>
                  </div>

                  {/* Seat Grid */}
                  <div className="grid grid-cols-4 gap-3 py-2">
                    {seatMapData?.decks?.[deck]?.map((seat, idx) => {
                      const isSelected = selectedSeats.includes(seat.seatNo);
                      const isBooked = seat.status === "BOOKED" || seat.status === "LOCKED";
                      const isFemale = seat.gender === "FEMALE";

                      return (
                        <button
                          key={idx}
                          type="button"
                          disabled={isBooked}
                          onClick={() => handleSeatClick(seat)}
                          className={`relative h-20 rounded-xl border flex flex-col items-center justify-between p-2 transition text-left ${
                            isBooked
                              ? "bg-slate-950/40 border-slate-800 text-slate-600 cursor-not-allowed opacity-50"
                              : isSelected
                              ? "bg-emerald-600 border-white text-white shadow-lg shadow-emerald-500/30 scale-105"
                              : isFemale
                              ? "bg-pink-950/30 border-pink-500/50 text-pink-300 hover:border-pink-400"
                              : "bg-slate-800/90 border-slate-700 text-slate-200 hover:border-teal-400 hover:bg-slate-800"
                          }`}
                        >
                          {/* Seat Number */}
                          <div className="w-full flex justify-between items-center">
                            <span className="text-xs font-mono font-bold">{seat.seatNo}</span>
                            {isSelected && <Check className="w-3.5 h-3.5" />}
                          </div>

                          {/* Sleeper pillow illustration */}
                          <div className="w-6 h-2 rounded bg-black/30" />

                          {/* Price */}
                          <span className="text-[10px] font-mono font-bold">
                            ₹{seat.price || 1350}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TRAIN CLASS & BERTH SELECTION LAYOUT */}
              {!isBus && (
            <div className="space-y-6">
              {/* Class Tabs */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  {isTrain ? "Choose Train Class" : trip.type === "flight" ? "Choose Cabin Class" : "Choose Vehicle"}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {trip.classes?.map((cls) => (
                    <button
                      key={cls.code}
                      type="button"
                      onClick={() => setTrainClass(cls.code)}
                      className={`p-4 rounded-2xl border text-left transition ${
                        trainClass === cls.code
                          ? "bg-blue-600 border-white text-white shadow-lg shadow-blue-500/20"
                          : "bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300"
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <span className="text-base font-black font-mono">{cls.code}</span>
                        <span className="text-xs font-mono font-bold">₹{cls.fare}</span>
                      </div>
                      <p className="text-xs font-semibold opacity-90 mt-1">{cls.name}</p>
                      <p className="text-[11px] text-emerald-400 font-bold mt-2">{cls.status}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Number of Passengers */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Number of Passengers to Reserve
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5, 6].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setPassengerCount(num)}
                      className={`w-12 h-12 rounded-xl font-bold text-sm transition ${
                        passengerCount === num
                          ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                          : "bg-slate-950 border border-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              {/* Berth Preference */}
              {isTrain && <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Berth Allocation Preference
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {["lower", "middle", "upper", "side_lower"].map((pref) => (
                    <button
                      key={pref}
                      type="button"
                      onClick={() => setBerthPreference(pref)}
                      className={`p-3 rounded-xl border font-semibold capitalize transition ${
                        berthPreference === pref
                          ? "bg-slate-800 border-blue-500 text-blue-300"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      {pref.replace("_", " ")} Berth
                    </button>
                  ))}
                </div>
              </div>}
            </div>
          )}
        </div>

        {/* Footer Summary & Lock Button */}
        <div className="p-5 md:p-6 bg-slate-950/90 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <span className="text-xs text-slate-400">
              {isBus ? `${selectedSeats.length} Seats Selected` : `${passengerCount} Passengers in ${trainClass}`}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black text-emerald-400 font-mono">
                ₹
                {isBus
                  ? selectedSeats.reduce((acc, s) => {
                      const seatObj = [
                        ...(seatMapData?.decks?.lower || []),
                        ...(seatMapData?.decks?.upper || []),
                      ].find((x) => x.seatNo === s);
                      return acc + (seatObj?.price || 1350);
                    }, 0)
                  : (trip.classes?.find((c) => c.code === trainClass)?.fare || 1080) * passengerCount}
              </span>
              <span className="text-xs text-slate-400">+ 5% GST</span>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs transition"
            >
              Cancel
            </button>

            <button
              onClick={handleProceedToLock}
              disabled={loading}
              className={`flex-1 sm:flex-initial px-6 py-3 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2 shadow-xl transition disabled:opacity-50 ${
                isBus
                  ? "bg-gradient-to-r from-teal-600 to-emerald-500 hover:from-teal-500 hover:to-emerald-400 shadow-teal-500/20"
                  : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-500/20"
              }`}
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Locking Seats...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Hold for 10 Mins</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
