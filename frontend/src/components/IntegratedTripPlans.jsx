import React, { Suspense, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Bus, CarFront, Clock3, Info, Plane, RefreshCw, Train, Wallet } from "lucide-react";
import { travelApi } from "../services/api";
const TripRouteMap = React.lazy(() => import("./TripRouteMap"));

const iconFor = { train: Train, bus: Bus, cab: CarFront, flight: Plane };
const money = (amount) => `₹${Number(amount || 0).toLocaleString("en-IN")}`;
const time = (value) => new Date(value).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
const duration = (minutes) => `${Math.floor(minutes / 60)}h ${minutes % 60}m`;

export default function IntegratedTripPlans({ from, to, date }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [maxTransfers, setMaxTransfers] = useState("2");
  const [selectedLegByPlan, setSelectedLegByPlan] = useState({});
  const [expandedPlanById, setExpandedPlanById] = useState({});

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    travelApi.planItinerary({ from, to, date }, { signal: controller.signal })
      .then((response) => { if (active) setData(response.data); })
      .catch((err) => { if (active) setError(err.response?.data?.message || "Could not create end-to-end plans."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [from, to, date]);

  const visiblePlans = data?.plans?.filter((plan) => plan.segments.length - 1 <= Number(maxTransfers)) || [];

  return (
    <section className="mb-6 rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/40 p-5 md:p-7 shadow-xl shadow-cyan-950/20" aria-labelledby="integrated-plans-title">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.18em] text-cyan-200">Door-to-door planner</div>
          <h2 id="integrated-plans-title" className="text-xl md:text-2xl font-black text-white">End-to-end trip plans</h2>
          <p className="mt-1 text-sm text-slate-400">Compare connected trips across transport modes, including transfers.</p>
        </div>
        {!loading && data?.supported && <div className="flex flex-wrap items-center gap-3"><label className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-xs text-slate-300">Max transfers<select value={maxTransfers} onChange={(event) => setMaxTransfers(event.target.value)} className="rounded-md bg-slate-900 px-2 py-1 text-white"><option value="0">Direct only</option><option value="1">1 transfer</option><option value="2">2 transfers</option></select></label><div className="rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-xs text-slate-300">Transfer hubs <b className="ml-1 text-cyan-200">{data.hub}</b></div></div>}
      </div>

      {loading && <div className="flex items-center gap-2 py-8 text-sm text-slate-400"><RefreshCw className="h-4 w-4 animate-spin text-cyan-300" /> Finding useful transfer combinations…</div>}
      {error && !loading && <p className="mt-5 rounded-xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-200">{error}</p>}
      {!loading && !error && data?.supported && <>
        {visiblePlans.length ? <div className="sj-plan-grid mt-5 grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
          {visiblePlans.map((plan) => (
            <article key={plan.id} className={`sj-plan-card min-w-0 rounded-2xl border border-slate-700/80 bg-slate-950/65 p-2 sm:p-4${expandedPlanById[plan.id] ? " expanded" : ""}`}>
              <div className="mb-2 flex flex-wrap gap-1.5 sm:mb-4 sm:gap-2">{plan.labels.map((label) => <span key={label} className="rounded-full bg-cyan-300/10 px-2 py-1 text-[9px] font-bold leading-tight text-cyan-200 sm:px-2.5 sm:text-[10px]">{label}</span>)}</div>
              <div className="mb-2 grid grid-cols-2 items-center gap-1 sm:mb-4 sm:flex sm:justify-between sm:gap-3">
                <div className="min-w-0"><p className="text-[8px] uppercase tracking-wide text-slate-500 sm:text-[10px] sm:tracking-widest">Estimated total</p><p className="text-base font-black text-white sm:text-xl">{money(plan.totalFare)} <span className="hidden text-xs font-medium text-slate-500 sm:inline">/ traveller</span></p></div>
                <div className="min-w-0 text-right"><p className="flex items-center justify-end gap-1 text-[11px] font-bold text-slate-200 sm:text-sm"><Clock3 className="h-3 w-3 shrink-0 text-cyan-300 sm:h-3.5 sm:w-3.5" />{duration(plan.totalDurationMinutes)}</p><p className="mt-1 hidden text-[11px] text-slate-500 sm:block">{plan.totalDistanceKm.toLocaleString()} km approx.</p></div>
              </div>
              <div className="mb-2 flex flex-wrap gap-1 sm:mb-0">{[...new Set(plan.segments.map((segment) => segment.modeLabel))].map((mode) => <span key={mode} className="rounded-md border border-slate-700 px-1.5 py-0.5 text-[8px] text-slate-400 sm:text-[10px]">{mode}</span>)}</div>
              <button type="button" className="sj-plan-expand mt-1 min-h-11 w-full rounded-lg border border-cyan-300/20 bg-cyan-300/[.06] px-2 text-[10px] font-bold text-cyan-200 md:hidden" aria-expanded={Boolean(expandedPlanById[plan.id])} onClick={() => setExpandedPlanById((current) => ({ ...current, [plan.id]: !current[plan.id] }))}>{expandedPlanById[plan.id] ? "Hide map & legs" : "Show map & legs"}</button>
              <div className="sj-plan-details">
              <Suspense fallback={<div className="mt-4 grid h-[280px] place-items-center rounded-2xl border border-slate-700 bg-slate-900/70 text-sm text-slate-400 md:h-[390px]">Loading interactive map…</div>}><TripRouteMap segments={plan.segments} selectedKey={selectedLegByPlan[plan.id] || "1"} onSelect={(key) => setSelectedLegByPlan((current) => ({ ...current, [plan.id]: key }))} /></Suspense>
              <div className="space-y-0">
                {plan.segments.map((segment, index) => {
                  const Icon = iconFor[segment.modeIcon] || Train;
                  return <React.Fragment key={`${plan.id}-${segment.index}`}>
                    <div className={`relative flex gap-3 pb-3 rounded-xl ${(selectedLegByPlan[plan.id] || "1") === String(segment.index) ? "bg-cyan-300/[.06]" : ""}`} onClick={() => setSelectedLegByPlan((current) => ({ ...current, [plan.id]: String(segment.index) }))} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelectedLegByPlan((current) => ({ ...current, [plan.id]: String(segment.index) })); }} role="button" tabIndex={0}>
                      <div className="relative flex w-8 shrink-0 justify-center"><span className="z-10 grid h-8 w-8 place-items-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200"><Icon className="h-4 w-4" /></span>{index < plan.segments.length - 1 && <span className="absolute top-8 h-full border-l border-dashed border-slate-600" />}</div>
                      <div className="min-w-0 flex-1 rounded-xl border border-slate-800 bg-slate-900/75 p-3">
                        <div className="flex items-center justify-between gap-2"><p className="text-xs font-bold text-white">{segment.modeLabel}</p><p className="text-xs font-bold text-emerald-200">{money(segment.estimatedFare)}</p></div>
                        <p className="mt-1 truncate text-[10px] text-slate-400">{segment.serviceName} · {segment.serviceReference} · {segment.dataStatus === "VERIFIED" ? "Verified feed" : segment.dataStatus === "LIVE" ? "Live flight result" : "DEMO schedule"}{segment.lastUpdatedAt ? ` · Updated ${new Date(segment.lastUpdatedAt).toLocaleDateString("en-IN")}` : ""}</p>
                        <p className="mt-1 truncate text-sm font-semibold text-slate-200">{segment.from} <ArrowRight className="mx-1 inline h-3 w-3 text-slate-500" /> {segment.to}</p>
                        <p className="mt-1 text-[11px] text-slate-500">{time(segment.departureTime)} – {time(segment.arrivalTime)} · {duration(segment.durationMinutes)}</p>
                        {segment.distanceKm && <p className="mt-1 text-[10px] text-slate-500">Approx. {Number(segment.distanceKm).toLocaleString()} km</p>}
                        <p className="mt-1 text-[10px] font-bold text-slate-400">Geometry: {segment.geometryStatus || "UNAVAILABLE"}{segment.geometryMessage ? ` · ${segment.geometryMessage}` : ""}</p>
                        <Link to={segment.bookingSearchUrl} className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-cyan-300 hover:text-cyan-100">Check this leg <ArrowRight className="h-3 w-3" /></Link>
                      </div>
                    </div>
                    {segment.transferMinutes && <div className="ml-11 -mt-2 mb-3 flex items-center gap-1 text-[10px] text-amber-200/80"><Clock3 className="h-3 w-3" />Scheduled transfer + wait: {duration(segment.transferMinutes)} in {segment.to}</div>}
                  </React.Fragment>;
                })}
              </div>
              <div className="mt-1 flex items-center justify-between border-t border-slate-800 pt-3 text-[11px] text-slate-400"><span className="inline-flex items-center gap-1"><Wallet className="h-3.5 w-3.5" />Fare estimate</span><span>{plan.segments.length} connected legs</span></div>
              </div>
            </article>
          ))}
        </div> : <div className="mt-5 rounded-xl border border-slate-700 bg-slate-950/50 p-4 text-sm text-slate-300">No saved plan fits this transfer limit.</div>}
        {data.flightNotice && <p className="mt-4 flex gap-2 rounded-xl border border-sky-300/15 bg-sky-300/5 p-3 text-[11px] leading-relaxed text-sky-100/80"><Plane className="mt-0.5 h-4 w-4 shrink-0" />{data.flightNotice}</p>}
        <p className="mt-3 flex gap-2 rounded-xl border border-amber-300/15 bg-amber-300/5 p-3 text-[11px] leading-relaxed text-amber-100/80"><Info className="mt-0.5 h-4 w-4 shrink-0" />{data.disclaimer}</p>
      </>}
      {!loading && !error && data && !data.supported && <div className="mt-5 space-y-3"><div className="rounded-xl border border-slate-700 bg-slate-950/50 p-4 text-sm text-slate-300">{data.message}</div>{data.flightNotice && <p className="flex gap-2 rounded-xl border border-sky-300/15 bg-sky-300/5 p-3 text-[11px] leading-relaxed text-sky-100/80"><Plane className="mt-0.5 h-4 w-4 shrink-0" />{data.flightNotice}</p>}</div>}
    </section>
  );
}
