import React, { useEffect, useState, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { travelApi } from "../services/api";
import { accountApi } from "../services/api";
import { useAuth } from "../context/AuthContext";
import SearchForm from "../components/SearchForm";
import TrainLiveModal from "../components/TrainLiveModal";
import BusLiveTrackModal from "../components/BusLiveTrackModal";
import SeatSelectionModal from "../components/SeatSelectionModal";
import IntegratedTripPlans from "../components/IntegratedTripPlans";
import {
  Train,
  Bus,
  Clock,
  MapPin,
  ShieldCheck,
  Zap,
  Filter,
  ArrowRight,
  Activity,
  Star,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
  Bookmark,
  Plane,
  CarFront,
} from "lucide-react";

const routeKey = (from, to, date, mode) => [from, to, date, mode].map((value) => String(value || "").trim().toLowerCase()).join("|");
const redBusUrl = (from, to, date) => {
  const slug = (value) => String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const [year, month, day] = String(date || "").split("-").map(Number);
  const onward = year && month && day ? `${String(day).padStart(2, "0")}-${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][month - 1]}-${year}` : "";
  const url = new URL(`https://www.redbus.in/bus-tickets/${slug(from)}-to-${slug(to)}`);
  if (from) url.searchParams.set("fromCityName", from);
  if (to) url.searchParams.set("toCityName", to);
  if (onward) url.searchParams.set("onward", onward);
  url.searchParams.set("srcCountry", "IND");
  url.searchParams.set("destCountry", "India");
  return url.toString();
};
const IRCTC_TRAIN_SEARCH = "https://www.irctc.co.in/nget/train-search";

export default function Search() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const from = searchParams.get("from") || "Jabalpur";
  const to = searchParams.get("to") || "Mumbai";
  const date = searchParams.get("date") || new Date().toISOString().split("T")[0];
  const modeParam = searchParams.get("mode") || "all";
  const passengers = Number(searchParams.get("passengers") || 1);

  const [results, setResults] = useState([]);
  const [summary, setSummary] = useState(null);
  const [flightNotice, setFlightNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters state
  const [activeMode, setActiveMode] = useState(modeParam);
  const [maxPrice, setMaxPrice] = useState(20000);
  const [maxDuration, setMaxDuration] = useState("any");
  const [departureWindow, setDepartureWindow] = useState("any");
  const [sortBy, setSortBy] = useState("recommended");
  const [selectedClass, setSelectedClass] = useState("all");

  // Modals state
  const [liveTrainModal, setLiveTrainModal] = useState({ open: false, trainNo: "12189" });
  const [liveBusModal, setLiveBusModal] = useState({ open: false, busId: "ZG-4412", busName: "" });
  const [selectedTripForBooking, setSelectedTripForBooking] = useState(null);
  const [savedRouteKeys, setSavedRouteKeys] = useState(() => new Set());
  const [savingRouteKey, setSavingRouteKey] = useState("");
  const [saveError, setSaveError] = useState("");
  const flightNoticeText = /valid api access key|invalid_access_key|aviationstack rejected|rejected.{0,20}api key|api key.{0,20}rejected/i.test(flightNotice)
    ? "Live flight search is unavailable because SerpApi rejected its API key. Imported schedules are shown when available. Check SERPAPI_API_KEY in backend/.env and restart the backend."
    : flightNotice;

  const beginBooking = (journey) => {
    if (!currentUser) {
      navigate("/login", { state: { from: { pathname: "/search", search: window.location.search } } });
      return;
    }
    setSelectedTripForBooking(journey);
  };

  const saveRoute = async (journey) => {
    setSaveError("");
    if (!currentUser) {
      navigate("/login", { state: { from: { pathname: "/search", search: window.location.search } } });
      return;
    }
    const key = routeKey(from, to, date, journey.type);
    setSavingRouteKey(key);
    try {
      await accountApi.saveTrip({ from, to, date, transportMode: journey.type, passengers });
      setSavedRouteKeys((keys) => new Set(keys).add(key));
    } catch (err) { setSaveError(err.response?.data?.message || "Could not save this route. Please try again."); }
    finally { setSavingRouteKey(""); }
  };

  useEffect(() => {
    if (!currentUser) { setSavedRouteKeys(new Set()); return; }
    accountApi.trips().then(({ data }) => {
      const keys = (data.trips || []).map((trip) => routeKey(trip.journey?.from, trip.journey?.to, trip.journey?.travelDate, trip.journey?.transportMode));
      setSavedRouteKeys(new Set(keys));
    }).catch(() => {});
  }, [currentUser]);

  const fetchResults = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await travelApi.search({
        from,
        to,
        date,
        mode: activeMode,
        sortBy,
        passengers,
      });
      if (res.data.success) {
        setResults(res.data.results || []);
        setSummary(res.data.summary);
        setFlightNotice(res.data.flightNotice || "");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load journey options");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  }, [from, to, date, activeMode, sortBy, passengers]);

  // Client-side filtering for class and price
  const filteredResults = useMemo(() => {
    return results.filter((item) => {
      // Price filter
      if (item.minFare > maxPrice) return false;
      if (maxDuration !== "any" && item.durationMinutes > Number(maxDuration) * 60) return false;
      if (departureWindow !== "any") {
        const hour = new Date(item.origin.departureTime).getHours();
        const windows = { morning: [5, 12], afternoon: [12, 17], evening: [17, 22], night: [22, 5] };
        const [start, end] = windows[departureWindow];
        const inWindow = start > end ? hour >= start || hour < end : hour >= start && hour < end;
        if (!inWindow) return false;
      }
      // Mode filter
      if (activeMode !== "all" && item.type !== activeMode) return false;
      return true;
    });
  }, [results, maxPrice, maxDuration, departureWindow, activeMode]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20 ix-search-page">
      {/* Top Search Bar Container */}
      <div className="bg-gradient-to-b from-slate-900 to-slate-950 border-b border-slate-800/80 py-6 px-4 ix-search-top">
        <div className="max-w-7xl mx-auto">
          <SearchForm
            compact
            initial={{ from, to, date, mode: activeMode }}
          />
        </div>
      </div>

      {/* Main Results Layout */}
      <div className="max-w-7xl mx-auto px-4 mt-6">
        {/* Results Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/60 border border-slate-800 mb-6 ix-search-route-banner">
          <div>
            <h1 className="text-xl font-black text-white flex items-center gap-2">
              <span>{from}</span>
              <ArrowRight className="w-4 h-4 text-slate-400" />
              <span>{to}</span>
            </h1>
                <p className="text-xs text-slate-400 mt-0.5">
              Travel Date: <b className="text-slate-200">{date}</b> • {summary?.totalFound || 0} Connections Available
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-xs font-semibold rounded-xl px-3 py-2 text-white focus:outline-none"
            >
              <option value="recommended">✨ Recommended</option>
              <option value="fastest">⚡ Fastest Duration</option>
              <option value="cheapest">💰 Lowest Price</option>
              <option value="departure">🕒 Departure Time</option>
            </select>
          </div>
        </div>

        <IntegratedTripPlans from={from} to={to} date={date} />

        {/* 2-Column Grid: Filters Sidebar + Results List */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Filters Sidebar */}
          <div className="lg:col-span-3 space-y-4">
            <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800/90 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-blue-400" /> Filters
                </span>
                <button
                  onClick={() => {
                    setActiveMode("all");
                    setMaxPrice(20000);
                    setMaxDuration("any");
                    setDepartureWindow("any");
                  }}
                  className="text-[11px] text-blue-400 hover:underline"
                >
                  Reset
                </button>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold text-slate-300">Maximum journey duration</label>
                <select value={maxDuration} onChange={(e) => setMaxDuration(e.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-white">
                  <option value="any">Any duration</option><option value="6">Up to 6 hours</option><option value="12">Up to 12 hours</option><option value="24">Up to 24 hours</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold text-slate-300">Departure time</label>
                <select value={departureWindow} onChange={(e) => setDepartureWindow(e.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-white">
                  <option value="any">Any time</option><option value="morning">Morning · 5am–12pm</option><option value="afternoon">Afternoon · 12pm–5pm</option><option value="evening">Evening · 5pm–10pm</option><option value="night">Night · 10pm–5am</option>
                </select>
              </div>

              {/* Mode Toggle */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">Transport Mode</label>
                <div className="grid grid-cols-5 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[10px] font-semibold">
                  <button
                    onClick={() => setActiveMode("all")}
                    className={`py-1.5 rounded-lg transition ${
                      activeMode === "all" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setActiveMode("train")}
                    className={`py-1.5 rounded-lg transition ${
                      activeMode === "train" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Trains
                  </button>
                  <button
                    onClick={() => setActiveMode("bus")}
                    className={`py-1.5 rounded-lg transition ${
                      activeMode === "bus" ? "bg-teal-600 text-white" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Bus
                  </button>
                  <button onClick={() => setActiveMode("flight")} className={`py-1.5 rounded-lg transition ${activeMode === "flight" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"}`}>Flight</button>
                  <button onClick={() => setActiveMode("cab")} className={`py-1.5 rounded-lg transition ${activeMode === "cab" ? "bg-amber-600 text-white" : "text-slate-400 hover:text-white"}`}>Cab</button>
                </div>
              </div>

              {/* Price Range */}
              <div>
                <div className="flex justify-between items-center text-xs font-semibold text-slate-300 mb-2">
                  <span>Max Budget:</span>
                  <span className="text-teal-400 font-mono font-bold">₹{maxPrice}</span>
                </div>
                <input
                  type="range"
                  min="400"
                  max="20000"
                  step="200"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(Number(e.target.value))}
                  className="w-full accent-teal-400 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
                  <span>₹400</span>
                  <span>₹20,000</span>
                </div>
              </div>

              {/* Quick Perks */}
              <div className="pt-3 border-t border-slate-800 space-y-2 text-xs">
                <span className="text-slate-400 font-semibold text-[11px]">Included Amenities</span>
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input type="checkbox" defaultChecked className="rounded accent-blue-500" />
                  <span>Air Conditioned (AC)</span>
                </label>
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input type="checkbox" defaultChecked className="rounded accent-blue-500" />
                  <span>Live GPS / Status Support</span>
                </label>
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input type="checkbox" defaultChecked className="rounded accent-blue-500" />
                  <span>Confirmed Seat Lock (10m)</span>
                </label>
              </div>
            </div>
          </div>

        {saveError && <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">{saveError}</div>}

        {/* Results List */}
          <div className="lg:col-span-9 space-y-4">
            {loading && (
              <div className="py-20 text-center text-slate-400 space-y-3">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
                <p className="text-sm font-semibold">Comparing train, bus, flight and cab options...</p>
              </div>
            )}

            {error && (
              <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-6 h-6 flex-shrink-0" />
                  <div>
                    <h4 className="font-bold">Search Error</h4>
                    <p className="text-xs opacity-90">{error}</p>
                  </div>
                </div>
                <button
                  onClick={fetchResults}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs transition"
                >
                  Retry Search
                </button>
              </div>
            )}

            {!loading && !error && flightNoticeText && (activeMode === "flight" || activeMode === "all") && (
              <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 px-4 py-3 text-xs text-sky-200 ix-flight-notice" role="status">
                <b>Flight search:</b> {flightNoticeText}
              </div>
            )}

            {!loading && !error && filteredResults.length === 0 && (
              <div className="p-12 text-center rounded-3xl bg-slate-900/60 border border-slate-800 space-y-3">
                <p className="text-base font-bold text-white">No journeys match the selected criteria</p>
                <p className="text-xs text-slate-400">Try widening your price range or switching transport mode.</p>
                <button
                  onClick={() => {
                    setActiveMode("all");
                    setMaxPrice(20000);
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl"
                >
                  Reset Filters
                </button>
              </div>
            )}

            {!loading &&
              filteredResults.map((journey) => {
                const isTrain = journey.type === "train";
                const isBus = journey.type === "bus";

                return (
                  <div
                    key={journey.id}
                    className="p-5 md:p-6 rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition shadow-xl space-y-4 group"
                  >
                    {/* Header Row */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold shadow-md ${
                            isTrain
                              ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                              : "bg-teal-500/20 text-teal-400 border border-teal-500/30"
                          }`}
                        >
                          {isTrain ? <Train className="w-5 h-5" /> : isBus ? <Bus className="w-5 h-5" /> : journey.type === "flight" ? <Plane className="w-5 h-5" /> : <CarFront className="w-5 h-5" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-white group-hover:text-blue-300 transition">
                              {journey.name}
                            </h3>
                            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-slate-800 text-slate-300">
                              #{journey.numberOrCode}
                            </span>
                            {journey.dataStatus === "LIVE" ? <span title="Live flight status data from Aviationstack" className="text-[9px] font-extrabold tracking-wide px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">LIVE DATA</span> : journey.dataStatus !== "VERIFIED" && <span title="Illustrative sample data; not operator-confirmed" className="text-[9px] font-extrabold tracking-wide px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-300">SAMPLE ESTIMATE</span>}
                          </div>
                          <p className="text-xs text-slate-400">
                            Operated by: <b className="text-slate-300">{journey.operator}</b>
                            {journey.rating && (
                              <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 font-bold text-[11px] inline-flex items-center gap-0.5">
                                <Star className="w-3 h-3 fill-amber-300" /> {journey.rating}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                    <div className="flex items-center gap-2">
                    {/* Tag pill */}
                    {journey.tag && journey.tag !== "standard" && (
                        <span
                          className={`text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 ${
                            journey.tag === "fastest"
                              ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                              : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          }`}
                        >
                          <Zap className="w-3.5 h-3.5" />
                          {journey.tagNote || journey.tag.toUpperCase()}
                        </span>
                      )}
                    <button type="button" onClick={() => saveRoute(journey)} disabled={savingRouteKey === routeKey(from, to, date, journey.type) || savedRouteKeys.has(routeKey(from, to, date, journey.type))} className="px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-950/70 text-[11px] font-semibold text-slate-300 hover:text-teal-300 hover:border-teal-500/50 disabled:text-emerald-300 disabled:border-emerald-500/30 flex items-center gap-1.5">
                      <Bookmark className="w-3.5 h-3.5" /> {savedRouteKeys.has(routeKey(from, to, date, journey.type)) ? "Saved" : savingRouteKey === routeKey(from, to, date, journey.type) ? "Saving…" : "Save route"}
                    </button>
                    </div>
                    </div>

                    {/* Timeline & Route Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                      {/* Origin */}
                      <div className="md:col-span-4 space-y-0.5">
                        <span className="text-lg font-black text-white font-mono">
                          {new Date(journey.origin.departureTime).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <p className="text-xs font-bold text-slate-200">{journey.origin.name}</p>
                        <p className="text-[11px] text-slate-400">{journey.origin.city} • {journey.origin.platform || journey.origin.terminal || journey.origin.code || (isTrain ? "Station" : "Terminal")}</p>
                      </div>

                      {/* Duration Line */}
                      <div className="md:col-span-4 text-center space-y-1">
                        <span className="text-xs font-semibold text-slate-400 flex items-center justify-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-blue-400" /> {journey.durationFormatted}
                        </span>
                        <div className="relative flex items-center justify-center">
                          <div className="w-full h-0.5 bg-slate-800" />
                          <div className="absolute w-2 h-2 rounded-full bg-blue-500" />
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {journey.totalDistanceKm ? `${journey.totalDistanceKm} km direct` : journey.type === "flight" ? `Flight ${journey.status || "status unavailable"}` : "Distance not supplied"}
                        </span>
                      </div>

                      {/* Destination */}
                      <div className="md:col-span-4 text-right space-y-0.5">
                        <span className="text-lg font-black text-white font-mono">
                          {new Date(journey.destination.arrivalTime).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <p className="text-xs font-bold text-slate-200">{journey.destination.name}</p>
                        <p className="text-[11px] text-slate-400">{journey.destination.city}</p>
                      </div>
                    </div>

                    <details className="rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3">
                      <summary className="cursor-pointer text-xs font-bold text-cyan-200">View service details · stops, amenities, and data source</summary>
                      <div className="mt-3 grid gap-3 text-xs text-slate-300 md:grid-cols-2">
                        <div><b className="text-slate-100">Intermediate stops</b>{journey.intermediateStops?.length ? <ul className="mt-1 list-inside list-disc text-slate-400">{journey.intermediateStops.map((stop, index) => <li key={`${journey.id}-stop-${index}`}>{typeof stop === "string" ? stop : `${stop.name || stop.station || stop.code || "Stop"}${stop.arrTime ? ` · ${stop.arrTime}` : stop.time ? ` · ${stop.time}` : ""}`}</li>)}</ul> : <p className="mt-1 text-slate-500">No stop list was supplied for this service.</p>}</div>
                        <div><b className="text-slate-100">Data source</b><p className="mt-1 text-slate-400">{journey.source || "Sample transport dataset"}{journey.lastUpdatedAt ? ` · updated ${new Date(journey.lastUpdatedAt).toLocaleDateString("en-IN")}` : ""}</p>{journey.classCodes?.length > 0 && <p className="mt-2 text-slate-400">Classes listed in sample record: {journey.classCodes.join(", ")}</p>}{journey.amenities?.length > 0 && <p className="mt-2 text-slate-400">Amenities: {journey.amenities.join(", ")}</p>}</div>
                      </div>
                    </details>

                    {/* Class Availability or Bus Deck Summary */}
                    {isTrain && journey.classes && (
                      <div className="pt-2 border-t border-slate-800/80 flex flex-wrap gap-2 items-center justify-between">
                        <div className="flex flex-wrap gap-2">
                          {journey.classes.length ? journey.classes.map((cls, idx) => (
                            <button
                              key={idx}
                              type="button"
                                disabled={journey.bookingSupported === false}
                              onClick={() => beginBooking(journey)}
                                className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-blue-500 hover:bg-slate-900 transition text-left cursor-pointer disabled:cursor-not-allowed"
                            >
                              <div className="flex items-center gap-2 text-xs">
                                <span className="font-bold text-white">{cls.code}</span>
                                <span className="font-mono text-emerald-400 font-bold">₹{cls.fare}</span>
                              </div>
                              <p className="text-[10px] text-emerald-400 font-semibold">{cls.status}</p>
                            </button>
                          )) : journey.minFare != null && <span className="self-center text-xs text-amber-200">Sample fare estimate from ₹{journey.minFare.toLocaleString("en-IN")} · class fares unavailable</span>}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          {journey.bookingSupported !== false && <button
                            type="button"
                            onClick={() => setLiveTrainModal({ open: true, trainNo: journey.trackingReference || journey.numberOrCode })}
                            className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-xs font-semibold text-blue-400 border border-slate-700 flex items-center gap-1.5 transition"
                          >
                            <Activity className="w-3.5 h-3.5 text-emerald-400" />
                            Track Status
                          </button>}

                          {journey.bookingSupported !== false && <button
                            type="button"
                            onClick={() => beginBooking(journey)}
                            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white shadow-lg shadow-blue-500/25 flex items-center gap-1.5 transition"
                          >
                            <span>{journey.dataStatus === "VERIFIED" ? "Continue booking" : "Try demo booking"}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>}
                          <a href={journey.bookingUrl || IRCTC_TRAIN_SEARCH} target="_blank" rel="noopener noreferrer" className="px-3 py-2 rounded-xl border border-blue-500/30 text-blue-300 hover:bg-blue-500/10 text-[11px] font-bold whitespace-nowrap">
                            Search & book on IRCTC ↗
                          </a>
                        </div>
                      </div>
                    )}

                    {isBus && (
                      <div className="pt-2 border-t border-slate-800/80 flex flex-wrap gap-2 items-center justify-between">
                        <div className="flex items-center gap-3 text-xs">
                          <span className="px-2.5 py-1 rounded-lg bg-teal-500/10 text-teal-300 font-semibold border border-teal-500/20">
                            {journey.busLayoutType ? `${journey.busLayoutType}${journey.busLayoutType.includes("Sleeper") ? "" : " layout"}` : "Bus service"}
                          </span>
                          <span className="text-slate-300">
                            <b className="text-white">{journey.totalAvailableSeats == null ? "—" : journey.totalAvailableSeats}</b> {journey.totalAvailableSeats == null ? "availability not supplied" : "seats · sample inventory"}
                          </span>
                          <span className="text-slate-400">• From <b className="text-teal-400 font-mono">₹{journey.minFare}</b></span>
                        </div>

                        {/* Bus Actions */}
                        <div className="flex items-center gap-2">
                          {journey.bookingSupported !== false && <button
                            type="button"
                            onClick={() =>
                              setLiveBusModal({
                                open: true,
                                busId: journey.numberOrCode,
                                busName: journey.name,
                              })
                            }
                            className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-xs font-semibold text-amber-400 border border-slate-700 flex items-center gap-1.5 transition"
                          >
                            <MapPin className="w-3.5 h-3.5 text-amber-400" />
                            Track GPS
                          </button>}

                          {journey.bookingSupported !== false && <button
                            type="button"
                            onClick={() => beginBooking(journey)}
                            className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-xs font-bold text-white shadow-lg shadow-teal-500/25 flex items-center gap-1.5 transition"
                          >
                            <span>{journey.dataStatus === "VERIFIED" ? "Continue booking" : "Try demo booking"}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>}
                          <a href={journey.bookingUrl || redBusUrl(journey.origin.city || from, journey.destination.city || to, date)} target="_blank" rel="noopener noreferrer" className="px-3 py-2 rounded-xl border border-teal-500/30 text-teal-700 hover:bg-teal-500/10 text-[11px] font-bold whitespace-nowrap">
                            View & book on redBus ↗
                          </a>
                        </div>
                      </div>
                    )}
                    {journey.type === "flight" ? (
                      <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs text-slate-400">{journey.availabilityNotice || "Flight status only; fare and seat availability were not supplied."}{journey.minFare != null && <span className="ml-2 font-semibold text-amber-200">Sample fare estimate: ₹{journey.minFare.toLocaleString("en-IN")}</span>}{journey.bookingSupported === false && <span className="ml-2 text-amber-200">Sample record · booking unavailable</span>}</p>
                        {journey.bookingUrl && <a href={journey.bookingUrl} target="_blank" rel="noreferrer" className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white">View & book flight ↗</a>}
                      </div>
                    ) : !isTrain && !isBus && (
                      <div className="pt-2 border-t border-slate-800/80 flex flex-wrap gap-2 items-center justify-between">
                        <div className="flex flex-wrap gap-2">{journey.classes?.map((cls) => <button key={cls.code} type="button" onClick={() => beginBooking(journey)} className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500 text-xs text-left"><b>{cls.name}</b><span className="ml-2 font-mono text-emerald-400">₹{cls.fare}</span></button>)}</div>
                        <button type="button" onClick={() => beginBooking(journey)} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white flex items-center gap-1.5">Book {journey.type} <ArrowRight className="w-3.5 h-3.5" /></button>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Modals */}
      <TrainLiveModal
        isOpen={liveTrainModal.open}
        trainNumber={liveTrainModal.trainNo}
        onClose={() => setLiveTrainModal({ ...liveTrainModal, open: false })}
      />
      <BusLiveTrackModal
        isOpen={liveBusModal.open}
        busId={liveBusModal.busId}
        busName={liveBusModal.busName}
        onClose={() => setLiveBusModal({ ...liveBusModal, open: false })}
      />
      <SeatSelectionModal
        isOpen={!!selectedTripForBooking}
        trip={selectedTripForBooking}
        onClose={() => setSelectedTripForBooking(null)}
      />
    </div>
  );
}
