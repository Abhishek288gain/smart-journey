import React, { useState, useEffect } from "react";
import { travelApi } from "../services/api";
import { X, Train, Clock, MapPin, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";

export default function TrainLiveModal({ isOpen, onClose, trainNumber = "12189" }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [inputTrainNo, setInputTrainNo] = useState(trainNumber);

  const fetchLiveStatus = async (trainNo) => {
    setLoading(true);
    setError(null);
    try {
      const res = await travelApi.getTrainLiveStatus(trainNo);
      if (res.data.success) {
        setData(res.data);
      } else {
        setError(res.data.message || "Failed to load running status");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Train status unavailable");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLiveStatus(trainNumber);
      setInputTrainNo(trainNumber);
    }
  }, [isOpen, trainNumber]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl overflow-hidden text-slate-100 my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Train className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                Live Running Status
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse">
                  LIVE
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                {data ? `${data.trainName} (${data.trainNumber})` : `Train #${inputTrainNo}`}
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

        {/* Train Search Input in Modal */}
        <div className="p-4 bg-slate-900/90 border-b border-slate-800 flex gap-2">
          <input
            type="text"
            value={inputTrainNo}
            onChange={(e) => setInputTrainNo(e.target.value)}
            placeholder="Enter Train Number (e.g. 12189, 12062)"
            className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={() => fetchLiveStatus(inputTrainNo)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl flex items-center gap-1.5 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Check
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-6">
          {loading && (
            <div className="py-12 text-center text-slate-400 flex flex-col items-center gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
              <p className="text-sm">Fetching real-time GPS telemetry from railway network...</p>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {data && !loading && (
            <>
              {/* Delay Banner */}
              <div
                className={`p-4 rounded-xl border flex items-center justify-between ${
                  data.delayMinutes > 0
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                    : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                }`}
              >
                <div className="flex items-center gap-3">
                  {data.delayMinutes > 0 ? (
                    <Clock className="w-6 h-6 text-amber-400" />
                  ) : (
                    <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                  )}
                  <div>
                    <h4 className="font-bold text-sm">
                      {data.delayMinutes > 0
                        ? `Running ${data.delayMinutes} mins Late`
                        : "Running Right on Time"}
                    </h4>
                    <p className="text-xs opacity-80">
                      Currently at: {data.currentStation?.stationName || "En route"} ({data.currentStation?.stationCode}) • Platform {data.currentStation?.platform || "2"}
                    </p>
                  </div>
                </div>
                <span className="text-xs bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-700/50">
                  Updated: {new Date(data.lastUpdatedAt).toLocaleTimeString()}
                </span>
              </div>

              {/* Station Timeline */}
              <div className="space-y-4">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Station-wise Running Timeline
                </h4>
                <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-700">
                  {data.timeline?.map((stn, idx) => {
                    const isPassed = stn.status === "PASSED";
                    const isCurrent = stn.status === "CURRENT";
                    const isUpcoming = stn.status === "UPCOMING";

                    return (
                      <div key={idx} className="relative flex items-start justify-between">
                        {/* Dot indicator */}
                        <div
                          className={`absolute -left-6 mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center transition ${
                            isCurrent
                              ? "bg-blue-600 border-white ring-4 ring-blue-500/30"
                              : isPassed
                              ? "bg-emerald-500 border-slate-900"
                              : "bg-slate-800 border-slate-600"
                          }`}
                        >
                          {isPassed && <span className="text-[10px] text-white">✓</span>}
                          {isCurrent && <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />}
                        </div>

                        {/* Station details */}
                        <div className="ml-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-white">
                              {stn.stationName}
                            </span>
                            <span className="text-xs px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                              {stn.stationCode}
                            </span>
                            {isCurrent && (
                              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                Current Station
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Platform {stn.platform} • {isPassed ? "Departed" : isCurrent ? "Halted" : "Expected"}
                          </p>
                        </div>

                        {/* Timing */}
                        <div className="text-right">
                          <p className="text-xs font-mono font-semibold text-slate-200">
                            {stn.actualArrival || stn.scheduledArrival}
                          </p>
                          {stn.delay > 0 && (
                            <span className="text-[10px] font-medium text-amber-400">
                              +{stn.delay}m late
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400">
          <span>Source: {data?.source || "IRCTC Provider Adapter"}</span>
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
