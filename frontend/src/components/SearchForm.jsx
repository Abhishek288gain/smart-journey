import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Train, Bus, Plane, CarFront, ArrowLeftRight, Search, Calendar, Users } from "lucide-react";
import LocationAutocomplete from "./LocationAutocomplete";

export default function SearchForm({ compact = false, initial = {} }) {
  const navigate = useNavigate();
  const todayStr = new Date().toISOString().split("T")[0];

  const [form, setForm] = useState({
    from: initial.from || "Jabalpur",
    to: initial.to || "Mumbai",
    date: initial.date || todayStr,
    passengers: initial.passengers || "1",
    mode: initial.mode || "all",
  });
  const [fromLocation, setFromLocation] = useState(null);
  const [toLocation, setToLocation] = useState(null);
  const [locationError, setLocationError] = useState("");

  const handleChange = (key, val) => {
    setForm((prev) => ({ ...prev, [key]: val }));
  };

  const handleSwap = () => {
    setForm((prev) => ({ ...prev, from: prev.to, to: prev.from }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!fromLocation || !toLocation) {
      setLocationError("Choose both locations from the saved suggestions before searching.");
      return;
    }
    if (fromLocation.name.trim().toLowerCase() === toLocation.name.trim().toLowerCase()) {
      setLocationError("Choose a different destination from your origin.");
      return;
    }
    setLocationError("");
    const params = new URLSearchParams({
      from: form.from,
      to: form.to,
      date: form.date,
      mode: form.mode,
      passengers: form.passengers,
    });
    navigate(`/search?${params.toString()}`);
  };

  return (
    <div className="search-panel bg-slate-900/90 backdrop-blur-xl border border-slate-700/80 rounded-3xl p-5 md:p-6 shadow-2xl">
      {/* Mode Selector Tabs */}
      <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-3 overflow-x-auto">
        <button
          type="button"
          onClick={() => handleChange("mode", "all")}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
            form.mode === "all"
              ? "bg-gradient-to-r from-blue-600 to-teal-500 text-white shadow-md shadow-blue-500/20"
              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
          }`}
        >
          <span className="flex items-center gap-1">
            <Train className="w-3.5 h-3.5" /> + <Bus className="w-3.5 h-3.5" />
          </span>
          <span>All modes</span>
        </button>

        <button
          type="button"
          onClick={() => handleChange("mode", "train")}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
            form.mode === "train"
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
          }`}
        >
          <Train className="w-3.5 h-3.5 text-blue-400" />
          <span>Trains Only</span>
        </button>

        <button
          type="button"
          onClick={() => handleChange("mode", "bus")}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
            form.mode === "bus"
              ? "bg-teal-600 text-white shadow-md shadow-teal-500/20"
              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
          }`}
        >
          <Bus className="w-3.5 h-3.5 text-teal-400" />
          <span>Buses Only</span>
        </button>
        <button type="button" onClick={() => handleChange("mode", "flight")} className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition ${form.mode === "flight" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white hover:bg-slate-800/60"}`}>
          <Plane className="w-3.5 h-3.5 text-indigo-300" /><span>Flights</span>
        </button>
        <button type="button" onClick={() => handleChange("mode", "cab")} className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition ${form.mode === "cab" ? "bg-amber-600 text-white" : "text-slate-400 hover:text-white hover:bg-slate-800/60"}`}>
          <CarFront className="w-3.5 h-3.5 text-amber-300" /><span>Cabs</span>
        </button>
      </div>

      {/* Main Search Inputs Grid */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
        <LocationAutocomplete label="From" value={form.from} placeholder="City, station, airport or terminal" onChange={(value) => { handleChange("from", value); setFromLocation(null); setLocationError(""); }} onSelect={(item) => { setFromLocation(item); handleChange("from", item.name); setLocationError(""); }} />

        {/* Swap Button */}
        <div className="md:col-span-1 flex justify-center">
          <button
            type="button"
            onClick={() => { handleSwap(); setFromLocation(toLocation); setToLocation(fromLocation); setLocationError(""); }}
            className="w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition shadow-md"
            title="Swap locations"
          >
            <ArrowLeftRight className="w-4 h-4" />
          </button>
        </div>

        <LocationAutocomplete label="To" value={form.to} placeholder="City, station, airport or terminal" onChange={(value) => { handleChange("to", value); setToLocation(null); setLocationError(""); }} onSelect={(item) => { setToLocation(item); handleChange("to", item.name); setLocationError(""); }} />

        {/* Date */}
        <div className="md:col-span-2 bg-slate-950 border border-slate-800 rounded-2xl p-3 focus-within:border-blue-500 transition">
          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Calendar className="w-3 h-3 text-blue-400" /> Travel Date
          </label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => handleChange("date", e.target.value)}
            className="w-full bg-transparent text-white font-bold text-sm focus:outline-none mt-0.5"
          />
        </div>

        {/* Passengers */}
        <div className="md:col-span-1 bg-slate-950 border border-slate-800 rounded-2xl p-3 focus-within:border-blue-500 transition">
          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Users className="w-3 h-3 text-teal-400" /> Count
          </label>
          <select
            value={form.passengers}
            onChange={(e) => handleChange("passengers", e.target.value)}
            className="w-full bg-transparent text-white font-bold text-sm focus:outline-none mt-0.5 cursor-pointer"
          >
            <option value="1" className="bg-slate-900">1</option>
            <option value="2" className="bg-slate-900">2</option>
            <option value="3" className="bg-slate-900">3</option>
            <option value="4" className="bg-slate-900">4</option>
            <option value="5" className="bg-slate-900">5</option>
          </select>
        </div>

        {/* Submit Button */}
        <div className="md:col-span-12" aria-live="polite">{locationError && <p role="alert" className="px-1 text-xs font-semibold text-rose-300">{locationError}</p>}</div>
        <div className="md:col-span-2">
          <button
            type="submit"
            className="w-full h-14 bg-gradient-to-r from-blue-600 via-indigo-600 to-teal-500 hover:from-blue-500 hover:to-teal-400 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-blue-500/25 transition group text-sm"
          >
            <Search className="w-4 h-4 group-hover:scale-110 transition" />
            <span>Search Trips</span>
          </button>
        </div>
      </form>
    </div>
  );
}
