import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bot, Bus, CalendarDays, ChevronDown, LoaderCircle, MapPin, MessageCircle, Plane, Send, Sparkles, Train, X } from "lucide-react";
import { travelApi } from "../services/api";

const today = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

function parseRoute(text) {
  const value = text.trim();
  const patterns = [
    /\bfrom\s+(.+?)\s+(?:to|->|→|se)\s+(.+?)(?=\s+(?:on|by|next|tomorrow|for|with)\b|[?!.,]|$)/i,
    /^\s*(.+?)\s+(?:to|->|→|se)\s+(.+?)\s*$/i,
  ];
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match && match[1].trim() && match[2].trim()) return { from: match[1].trim(), to: match[2].trim() };
  }
  return null;
}

const money = (value) => Number.isFinite(Number(value)) ? `₹${Number(value).toLocaleString("en-IN")}` : "Fare not supplied";
const duration = (minutes) => `${Math.floor(minutes / 60)}h ${minutes % 60}m`;

function RouteResults({ result, onOpenSearch }) {
  const plans = result.plans?.slice(0, 2) || [];
  const direct = result.direct?.slice(0, 2) || [];
  return <div className="mt-3 space-y-2">
    {plans.map((plan) => <div key={plan.id} className="rounded-xl border border-cyan-300/15 bg-cyan-300/[.06] p-3">
      <div className="flex items-center justify-between gap-2"><span className="text-[11px] font-bold text-cyan-100">{plan.segments.length === 1 ? "Direct plan" : `${plan.segments.length} connected legs`}</span><span className="text-[10px] text-slate-400">{plan.segments.some((leg) => leg.dataStatus !== "VERIFIED") ? "SAMPLE DATA" : "VERIFIED FEED"}</span></div>
      <div className="mt-2 space-y-1.5">{plan.segments.map((leg) => { const ModeIcon = leg.modeIcon === "bus" ? Bus : leg.modeIcon === "flight" ? Plane : Train; return <div key={`${plan.id}-${leg.index}`} className="flex gap-2 text-[11px] text-slate-300"><ModeIcon size={13} className="mt-0.5 shrink-0 text-cyan-300" /><span><b>{leg.from} → {leg.to}</b><span className="block text-[10px] text-slate-500">{leg.modeLabel} · {leg.serviceName} · {money(leg.estimatedFare)}</span></span></div>; })}</div>
      <p className="mt-2 border-t border-slate-700/70 pt-2 text-[10px] text-slate-400">Approx. {duration(plan.totalDurationMinutes)} · {money(plan.totalFare)} per traveller</p>
    </div>)}
    {direct.map((journey) => <div key={journey.id} className="rounded-xl border border-slate-700 bg-slate-950/50 p-3">
      <div className="flex items-center justify-between gap-2"><span className="truncate text-[11px] font-bold text-slate-100">{journey.name}</span><span className="shrink-0 text-[9px] font-bold text-amber-200">{journey.dataStatus === "VERIFIED" || journey.dataStatus === "LIVE" ? journey.dataStatus : "SAMPLE"}</span></div>
      <p className="mt-1 text-[10px] text-slate-400">{journey.type} · {duration(journey.durationMinutes)} · {money(journey.minFare)}</p>
    </div>)}
    {(plans.length || direct.length) ? <button onClick={onOpenSearch} className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-cyan-200 hover:text-white">View all journey options <span aria-hidden="true">→</span></button> : null}
  </div>;
}

export default function TripPlanningChat() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState([{ id: "welcome", role: "assistant", text: "Hi! Tell me your start and destination, and I’ll check direct services and connected train or bus routes. For example: “Gwalior to Rishikesh”." }]);
  const [lastRoute, setLastRoute] = useState(null);
  const endRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, busy, open]);

  const planRoute = async (route, userText) => {
    const cleanRoute = { from: route.from.trim(), to: route.to.trim(), date };
    setLastRoute(cleanRoute);
    setMessages((items) => [...items, { id: `${Date.now()}-user`, role: "user", text: userText }]);
    setDraft("");
    setBusy(true);
    try {
      const [planResponse, searchResponse] = await Promise.allSettled([
        travelApi.planItinerary(cleanRoute),
        travelApi.search({ ...cleanRoute, mode: "all", sortBy: "recommended" }),
      ]);
      const planData = planResponse.status === "fulfilled" ? planResponse.value.data : null;
      const directData = searchResponse.status === "fulfilled" ? searchResponse.value.data : null;
      const plans = planData?.supported ? planData.plans || [] : [];
      const direct = directData?.success ? directData.results || [] : [];
      let text;
      if (plans.length || direct.length) {
        text = `I checked ${cleanRoute.from} → ${cleanRoute.to} for ${cleanRoute.date}. ${plans.length ? `Found ${plans.length} connected plan${plans.length === 1 ? "" : "s"}.` : "No connected plan was available in the saved schedules."} ${direct.length ? `Also found ${direct.length} direct option${direct.length === 1 ? "" : "s"}.` : "No direct options were returned."} Check the sample or live-data label below.`;
      } else {
        const detail = planData?.message || searchResponse.reason?.response?.data?.message || "No matching options were returned.";
        text = `${detail} Try selecting a supported city from the search suggestions, or choose another date.`;
      }
      const flightNotice = directData?.flightNotice;
      if (flightNotice && /invalid|not configured|access key/i.test(flightNotice)) text += " Flight data is unavailable because the flight provider is not currently configured with a valid key.";
      setMessages((items) => [...items, { id: `${Date.now()}-assistant`, role: "assistant", text, result: { plans, direct } }]);
    } catch {
      setMessages((items) => [...items, { id: `${Date.now()}-error`, role: "assistant", text: "I couldn’t reach the journey services right now. Please try again in a moment." }]);
    } finally {
      setBusy(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  const send = (event) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    const route = parseRoute(text);
    if (!route) {
      setMessages((items) => [...items, { id: `${Date.now()}-user`, role: "user", text }, { id: `${Date.now()}-hint`, role: "assistant", text: "Please include both places in one message, like “from Gwalior to Rishikesh” or “Delhi se Rishikesh”." }]);
      setDraft("");
      return;
    }
    planRoute(route, text);
  };

  const useExample = (from, to) => planRoute({ from, to }, `${from} to ${to}`);
  const openResults = () => {
    if (!lastRoute) return;
    navigate(`/search?${new URLSearchParams({ ...lastRoute, mode: "all" })}`);
    setOpen(false);
  };

  return <div className="sj-chat-widget fixed bottom-5 right-5 z-[80] flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
    {open && <section aria-label="Trip planning chat" className="sj-chat-panel flex h-[min(680px,calc(100dvh-112px))] w-[min(420px,calc(100vw-24px))] flex-col overflow-hidden rounded-3xl border border-cyan-200/20 bg-slate-950 shadow-[0_24px_90px_rgba(0,0,0,.65)]">
      <header className="sj-chat-header flex items-center gap-3 border-b border-slate-700/70 bg-gradient-to-r from-slate-900 to-cyan-950/70 p-4">
        <div className="grid h-10 w-10 place-items-center rounded-2xl border border-cyan-200/20 bg-cyan-300/10 text-cyan-200"><Bot size={21} /></div>
        <div className="min-w-0 flex-1"><h2 className="text-sm font-extrabold text-white">Trip planning assistant</h2><p className="mt-0.5 text-[10px] text-slate-400">Connected routes · India</p></div>
        <label className="sj-chat-date flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-950/70 px-2 py-1.5 text-[10px] text-slate-300" title="Choose travel date"><CalendarDays size={13} className="text-cyan-200" /><input aria-label="Travel date" type="date" min={today()} value={date} onChange={(event) => setDate(event.target.value)} className="w-[112px] bg-transparent text-[10px] text-white outline-none" /></label>
        <button onClick={() => setOpen(false)} aria-label="Minimize trip planning chat" className="grid h-8 w-8 place-items-center rounded-xl text-slate-400 hover:bg-white/10 hover:text-white"><ChevronDown size={19} /></button>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
        {messages.map((message) => <div key={message.id} className={`flex gap-2.5 ${message.role === "user" ? "flex-row-reverse" : ""}`}>
          <div className={`grid h-7 w-7 shrink-0 place-items-center rounded-xl ${message.role === "user" ? "bg-blue-500/15 text-blue-200" : "bg-cyan-300/10 text-cyan-200"}`}>{message.role === "user" ? <MapPin size={14} /> : <Sparkles size={14} />}</div>
          <div className={`max-w-[86%] rounded-2xl px-3.5 py-3 ${message.role === "user" ? "rounded-tr-sm bg-blue-600/20 text-blue-50" : "rounded-tl-sm border border-slate-700/70 bg-slate-900 text-slate-200"}`}>
            <p className="whitespace-pre-wrap text-xs leading-5">{message.text}</p>
            {message.result && <RouteResults result={message.result} onOpenSearch={openResults} />}
          </div>
        </div>)}
        {messages.length === 1 && <div className="ml-9 flex flex-wrap gap-2"><button onClick={() => useExample("Gwalior", "Rishikesh")} className="rounded-full border border-cyan-300/20 bg-cyan-300/[.06] px-3 py-2 text-[10px] font-semibold text-cyan-100 hover:bg-cyan-300/15">Gwalior → Rishikesh</button><button onClick={() => useExample("Jabalpur", "Mumbai")} className="rounded-full border border-slate-700 bg-slate-900 px-3 py-2 text-[10px] font-semibold text-slate-300 hover:border-slate-500">Jabalpur → Mumbai</button></div>}
        {busy && <div className="ml-9 flex items-center gap-2 text-[11px] text-slate-400"><LoaderCircle size={14} className="animate-spin text-cyan-200" />Checking direct and connected options…</div>}
        <div ref={endRef} />
      </div>

      <form onSubmit={send} className="border-t border-slate-800 bg-slate-900/80 p-3">
        <div className="flex items-end gap-2 rounded-2xl border border-slate-700 bg-slate-950 p-2 focus-within:border-cyan-300/50">
          <textarea ref={inputRef} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(event); } }} rows={1} maxLength={180} aria-label="Describe your trip" placeholder="e.g. Gwalior to Rishikesh" className="max-h-24 min-h-9 flex-1 resize-y bg-transparent px-2 py-2 text-xs text-white outline-none placeholder:text-slate-500" />
          <button disabled={!draft.trim() || busy} type="submit" aria-label="Send trip request" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-cyan-400 text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"><Send size={15} /></button>
        </div>
        <p className="px-1 pt-2 text-[9px] leading-4 text-slate-500">Sample schedules and fares are not live operator data. This assistant plans routes; it does not book operator tickets.</p>
      </form>
    </section>}
    <button onClick={() => { setOpen((value) => !value); if (!open) setTimeout(() => inputRef.current?.focus(), 80); }} aria-expanded={open} aria-label={open ? "Close trip planning chat" : "Open trip planning chat"} className="group inline-flex h-14 items-center gap-3 rounded-full border border-cyan-100/20 bg-gradient-to-r from-blue-600 to-teal-500 px-5 text-white shadow-[0_12px_38px_rgba(18,139,181,.4)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_42px_rgba(18,175,176,.45)]">
      {open ? <X size={19} /> : <MessageCircle size={19} />}<span className="text-xs font-extrabold">{open ? "Close chat" : "Plan my trip"}</span><span className="grid h-2 w-2 place-items-center rounded-full bg-emerald-200 shadow-[0_0_12px_rgba(110,255,218,.8)]" />
    </button>
  </div>;
}
