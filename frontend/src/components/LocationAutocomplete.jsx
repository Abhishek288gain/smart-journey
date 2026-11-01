import { useEffect, useRef, useState } from "react";
import { Bus, LoaderCircle, MapPin, Plane, Train } from "lucide-react";
import { travelApi } from "../services/api";

export default function LocationAutocomplete({ label, value, onChange, onSelect, placeholder, icon }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [error, setError] = useState("");
  const rootRef = useRef(null);
  const fieldId = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const typeLabel = (type) => ({ city: "City", railway_station: "Railway station", airport: "Airport", bus_terminal: "Bus terminal" }[type] || "Location");

  useEffect(() => {
    const query = value.trim();
    if (!query) { setResults([]); setLoading(false); return undefined; }
    let current = true;
    setResults([]);
    setLoading(true);
    setError("");
    const timer = setTimeout(async () => {
      try {
        const response = await travelApi.searchLocations({ q: query, limit: 12 });
        if (!current) return;
        const locations = response.data.locations || [];
        setResults(locations);
        setOpen(true);
        setActive(-1);
        setError("");
        const exact = locations.find((item) => [item.name, item.displayName, item.code].some((candidate) => candidate?.toLowerCase() === query.toLowerCase()));
        if (exact) onSelect(exact, { automatic: true });
      } catch {
        if (current) setError("Could not load saved locations. Try again.");
      } finally { if (current) setLoading(false); }
    }, 140);
    return () => { current = false; clearTimeout(timer); };
  }, [value]);

  useEffect(() => {
    const close = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const handleKeyDown = (event) => {
    if (event.key === "Escape") { setOpen(false); return; }
    if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); setActive((index) => Math.min(index + 1, results.length - 1)); }
    if (event.key === "ArrowUp") { event.preventDefault(); setActive((index) => Math.max(index - 1, 0)); }
    if (event.key === "Enter" && open && results[active]) { event.preventDefault(); onSelect(results[active]); setOpen(false); }
  };

  return <div ref={rootRef} className="relative md:col-span-3 rounded-2xl border border-slate-800 bg-slate-950 p-3 transition focus-within:border-blue-500">
    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</label>
    <div className="flex items-center gap-2"><span className="text-blue-300">{icon || <MapPin className="h-4 w-4" />}</span><input type="text" role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={`${fieldId}-location-options`} aria-activedescendant={active >= 0 ? `${fieldId}-location-${active}` : undefined} value={value} onChange={(event) => { onChange(event.target.value); setOpen(true); }} onFocus={() => { if (value.trim()) setOpen(true); }} onKeyDown={handleKeyDown} placeholder={placeholder} autoComplete="off" className="mt-0.5 w-full bg-transparent text-sm font-bold text-white outline-none placeholder:text-slate-600" /></div>
    {open && value.trim() && <div id={`${fieldId}-location-options`} role="listbox" aria-label={`${label} suggestions`} className="absolute left-0 right-0 top-full z-40 mt-2 max-h-72 overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-1.5 shadow-2xl">
      {loading && <div className="flex items-center gap-2 px-3 py-3 text-xs text-slate-400"><LoaderCircle className="h-4 w-4 animate-spin" />Searching locations…</div>}
      {!loading && error && <p className="px-3 py-3 text-xs text-rose-300">{error}</p>}
      {!loading && !error && !results.length && <p className="px-3 py-3 text-xs text-slate-400">No matching cities, stations, airports, or terminals found.</p>}
      {!loading && results.length > 0 && <div className="px-3 pb-1 pt-1.5 text-[9px] font-extrabold uppercase tracking-[.16em] text-slate-500">{["india", "bharat"].includes(value.trim().toLowerCase()) ? "Places in India · choose a city or boarding point" : "Suggested locations · starts-with matches first"}</div>}
      {!loading && results.map((item, index) => <button key={item.id} id={`${fieldId}-location-${index}`} type="button" role="option" aria-selected={index === active} onMouseEnter={() => setActive(index)} onClick={() => { onSelect(item); setOpen(false); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ${index === active ? "bg-blue-500/15" : "hover:bg-white/5"}`}>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-400/10 text-blue-200">{item.type === "railway_station" ? <Train className="h-4 w-4" /> : item.type === "airport" ? <Plane className="h-4 w-4" /> : item.type === "bus_terminal" ? <Bus className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}</span>
        <span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold text-white">{item.displayName}</span><span className="block truncate text-[10px] text-slate-400">{item.detail}{item.code ? ` · ${item.code}` : ""}</span></span>
        <span className="shrink-0 rounded-md border border-slate-700/80 bg-slate-950/70 px-1.5 py-1 text-[8px] font-bold uppercase tracking-wide text-slate-400">{typeLabel(item.type)}</span>
      </button>)}
    </div>}
  </div>;
}
