import React, { useState, useEffect } from "react";
import { travelApi } from "../services/api";
import { X, Bus, Navigation, Gauge, Phone, RefreshCw, Compass } from "lucide-react";

export default function BusLiveTrackModal({ isOpen, onClose, busId = "ZG-4412", busName = "Zingbus AC Sleeper" }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchTracking = async () => {
    try {
      const res = await travelApi.getBusLiveTrack(busId);
      if (res.data.success) {
        setData(res.data);
      }
    } catch (e) {
      console.error("Live tracking error", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetchTracking();
      // Poll every 5 seconds for simulated GPS movement
      const interval = setInterval(fetchTracking, 5000);
      return () => clearInterval(interval);
    }
  }, [isOpen, busId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl overflow-hidden text-slate-100 my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Bus className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                Live GPS Bus Tracking
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse">
                  GPS ACTIVE
                </span>
              </h3>
              <p className="text-xs text-slate-400">{busName} ({busId})</p>
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
          {loading && !data && (
            <div className="py-12 text-center text-slate-400 flex flex-col items-center gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
              <p className="text-sm">Connecting to onboard vehicle GPS tracker...</p>
            </div>
          )}

          {data && (
            <>
              {/* Simulated Live GPS Map Viewport */}
              <div className="relative h-48 w-full rounded-2xl overflow-hidden border border-slate-700/60 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/50 flex flex-col items-center justify-center">
                {/* Grid Lines Pattern */}
                <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px]" />
                
                {/* Highway line */}
                <div className="absolute w-full h-1.5 bg-blue-500/40 transform -rotate-6 top-1/2" />
                <div className="absolute w-full border-t border-dashed border-amber-400/80 transform -rotate-6 top-1/2 -mt-0.5" />

                {/* Animated Bus Marker */}
                <div className="relative z-10 flex flex-col items-center animate-bounce">
                  <div className="p-3 bg-amber-500 text-slate-950 rounded-2xl shadow-xl shadow-amber-500/30 border-2 border-white flex items-center justify-center">
                    <Bus className="w-6 h-6" />
                  </div>
                  <span className="mt-1 px-2.5 py-0.5 bg-slate-950/90 border border-slate-700 rounded-full text-[11px] font-bold text-amber-300">
                    {data.speedKmH} km/h • {data.heading}
                  </span>
                </div>

                {/* Live coordinate overlay */}
                <div className="absolute bottom-3 left-3 bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-300 flex items-center gap-1.5">
                  <Navigation className="w-3.5 h-3.5 text-blue-400" />
                  {data.coordinates.latitude.toFixed(4)}° N, {data.coordinates.longitude.toFixed(4)}° E
                </div>
              </div>

              {/* Status and Speed Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                    <Gauge className="w-4 h-4 text-emerald-400" />
                    <span>Current Speed</span>
                  </div>
                  <p className="text-2xl font-bold text-white font-mono">{data.speedKmH} <span className="text-xs text-slate-400 font-sans">km/h</span></p>
                  <p className="text-[11px] text-emerald-400 font-semibold mt-1">Normal cruising speed</p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                    <Compass className="w-4 h-4 text-blue-400" />
                    <span>Location</span>
                  </div>
                  <p className="text-sm font-bold text-white truncate">{data.currentLandmark}</p>
                  <p className="text-[11px] text-slate-400 mt-1">Updated 5s ago</p>
                </div>
              </div>

              {/* Next Halt & Rest Stop */}
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-semibold uppercase tracking-wider">Next Designated Stop</span>
                  <span className="text-amber-400 font-mono font-bold">In {data.nextStop.distanceKm} km</span>
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <h5 className="font-bold text-white text-sm">{data.nextStop.name}</h5>
                    <p className="text-xs text-slate-400">Scheduled Meal & Washroom Break</p>
                  </div>
                  <span className="text-xs font-bold px-3 py-1 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30 font-mono">
                    ETA: {data.nextStop.eta}
                  </span>
                </div>
              </div>

              {/* Driver Contact */}
              <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-400">Primary Bus Captain:</span>
                  <p className="font-bold text-white text-sm">{data.driverContact.name}</p>
                </div>
                <a
                  href={`tel:${data.driverContact.phone}`}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-1.5 transition"
                >
                  <Phone className="w-3.5 h-3.5" />
                  Call Captain
                </a>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400">
          <span>Auto-refreshing GPS location every 5 seconds</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
