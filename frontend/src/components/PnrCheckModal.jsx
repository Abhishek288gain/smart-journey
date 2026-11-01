import React, { useState } from "react";
import { travelApi } from "../services/api";
import { X, Search, CheckCircle2, Ticket, AlertCircle } from "lucide-react";

export default function PnrCheckModal({ isOpen, onClose }) {
  const [pnrNumber, setPnrNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const handleCheck = async (e) => {
    if (e) e.preventDefault();
    if (!/^SJ\d{8}$/i.test(pnrNumber.trim())) {
      setError("External railway PNR lookup is not connected. Enter a Smart Journey booking reference (SJ + 8 digits).");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await travelApi.checkPnr(pnrNumber.trim());
      if (res.data.success) {
        setData(res.data);
      } else {
        setError(res.data.message || "PNR record not found");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to retrieve PNR status");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl overflow-hidden text-slate-100 my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30">
              <Ticket className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Booking Reference Lookup</h3>
              <p className="text-xs text-slate-400">Look up Smart Journey booking records</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleCheck} className="p-5 border-b border-slate-800 bg-slate-900">
          <label className="block text-xs font-semibold text-slate-400 mb-2">
            Enter Smart Journey booking reference:
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              maxLength={10}
              value={pnrNumber}
              onChange={(e) => setPnrNumber(e.target.value.replace(/[^a-z0-9]/gi, "").toUpperCase())}
              placeholder="e.g. SJ89401258"
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-base font-mono text-white tracking-widest focus:outline-none focus:border-teal-500"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white font-semibold rounded-xl flex items-center gap-2 transition disabled:opacity-50"
            >
              <Search className="w-4 h-4" />
              {loading ? "Checking..." : "Check"}
            </button>
          </div>
        </form>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {error && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {data && (
            <div className="space-y-4">
              {/* Journey Overview Card */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-white text-base">{data.serviceName || "Smart Journey booking"}</h4>
                    <p className="text-xs font-mono text-teal-400">{data.mode ? `${data.mode} · ${data.serviceReference || ""} · ` : ""}Reference · {data.bookingReference}</p>
                  </div>
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    {data.chartStatus?.replaceAll("_", " ") || "STATUS UNAVAILABLE"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-xs">
                  <div>
                    <span className="text-slate-400">Date of Journey:</span>
                    <p className="font-semibold text-slate-200">{data.dateOfJourney}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Route:</span>
                    <p className="font-semibold text-slate-200">{data.from} → {data.to}</p>
                  </div>
                </div>
              </div>

              {/* Passengers Breakdown */}
              <div className="space-y-2">
                <h5 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Passenger Booking Status</h5>
                <div className="space-y-2">
                  {data.passengers?.map((p, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-xs font-bold font-mono">
                          {p.passengerNo || idx + 1}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">{p.name}</p>
                          <p className="text-xs text-slate-400">
                            Class: {p.classType || "3A"} • {p.berthType ? `${p.berthType} Berth` : "Berth Assigned"}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          {p.currentStatus || "CNF"}
                        </span>
                        <p className="text-xs font-mono font-bold text-white mt-1">
                          Coach: {p.coach || "B3"} / Berth: {p.berth || "42"}
                        </p>
                      </div>
                    </div>
                  ))}
                  {!data.passengers?.length && <p className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-slate-400">{data.message || "Passenger details are unavailable for this booking."}</p>}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium transition text-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
