import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import SearchForm from "../components/SearchForm";
import TrainLiveModal from "../components/TrainLiveModal";
import PnrCheckModal from "../components/PnrCheckModal";
import BusLiveTrackModal from "../components/BusLiveTrackModal";
import {
  Train,
  Bus,
  Activity,
  Ticket,
  MapPin,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Plane,
  Route,
  Map,
  CircleHelp,
  Bookmark,
} from "lucide-react";

export default function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const [trainModalOpen, setTrainModalOpen] = useState(false);
  const [pnrModalOpen, setPnrModalOpen] = useState(false);
  const [busTrackModalOpen, setBusTrackModalOpen] = useState(false);

  useEffect(() => {
    const targetId = location.hash.slice(1);
    if (!targetId) return undefined;
    const timer = setTimeout(() => document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth" }), 50);
    return () => clearTimeout(timer);
  }, [location.hash]);

  const tripIdeas = [
    { from: "Gwalior", to: "Rishikesh", note: "Explore a connected journey" },
    { from: "Jabalpur", to: "Mumbai", note: "Compare available options" },
    { from: "Bhopal", to: "New Delhi", note: "Check transport schedules" },
    { from: "New Delhi", to: "Jaipur", note: "See route possibilities" },
  ];
  const openSearch = (from, to) => navigate(`/search?${new URLSearchParams({ from, to, date: new Date().toISOString().slice(0, 10), mode: "all" })}`);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 ix-home-page">
      <section className="relative overflow-hidden px-4 pb-16 pt-12 md:pb-20 ix-home-hero">
        {/* Background Gradients */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-20 right-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 mx-auto max-w-6xl space-y-6 text-center ix-home-content">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>One place to plan every leg of your journey</span>
          </div>

          <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight leading-tight">
            Plan the whole trip, not just the first leg{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-teal-400">
              from start to finish
            </span>
          </h1>

          <p className="max-w-2xl mx-auto text-slate-400 text-base md:text-lg">
            Search direct services, then explore connected routes through available stations and transfer hubs. See where each leg’s data comes from before you decide.
          </p>

          <div id="planner" className="mx-auto max-w-5xl scroll-mt-48 pt-6 ix-home-planner">
            <SearchForm />
          </div>
          <div className="flex flex-wrap justify-center gap-3 pt-1 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1.5"><Train className="h-3.5 w-3.5 text-blue-300" /> Rail schedules</span>
            <span className="inline-flex items-center gap-1.5"><Bus className="h-3.5 w-3.5 text-teal-300" /> Bus routes</span>
            <span className="inline-flex items-center gap-1.5"><Plane className="h-3.5 w-3.5 text-indigo-300" /> Flight status feed</span>
            <span className="inline-flex items-center gap-1.5"><Route className="h-3.5 w-3.5 text-cyan-300" /> Multi-leg planning</span>
          </div>
        </div>
      </section>

      <section className="mx-auto mb-16 max-w-6xl px-4">
        <div className="mb-5 flex items-end justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-teal-300">Travel tools</p><h2 className="mt-1 text-xl font-bold text-white">Plan, track and manage</h2></div><span className="hidden text-xs text-slate-500 sm:block">Tools are grouped by task in the navigation above</span></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Live Train Status Card */}
          <button
            onClick={() => setTrainModalOpen(true)}
            className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 hover:border-blue-500/40 text-left transition shadow-xl group"
          >
            <div className="w-10 h-10 rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center mb-3 group-hover:scale-110 transition">
              <Activity className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-sm">Live Train Status</h3>
            <p className="text-xs text-slate-400 mt-1">Check train status when a supported provider is connected</p>
          </button>

          {/* Check Booking Reference Card */}
          <button
            onClick={() => setPnrModalOpen(true)}
            className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 hover:border-teal-500/40 text-left transition shadow-xl group"
          >
            <div className="w-10 h-10 rounded-2xl bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center mb-3 group-hover:scale-110 transition">
              <Ticket className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-sm">Booking reference</h3>
            <p className="text-xs text-slate-400 mt-1">Check an internal Smart Journey booking record</p>
          </button>

          {/* Live Bus GPS Card */}
          <button
            onClick={() => setBusTrackModalOpen(true)}
            className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 hover:border-amber-500/40 text-left transition shadow-xl group"
          >
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center mb-3 group-hover:scale-110 transition">
              <MapPin className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-sm">Bus tracking</h3>
            <p className="text-xs text-slate-400 mt-1">Open tracking assistance; live GPS needs an operator feed</p>
          </button>

          {/* 10-Min Seat Lock Card */}
          <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 text-left shadow-xl">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center mb-3">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-sm">Seat hold preview</h3>
            <p className="text-xs text-slate-400 mt-1">Try the internal checkout flow with sample services</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.2em] text-blue-300">Get started</p>
            <h2 className="mt-1 text-xl font-bold text-white">Example journeys</h2>
            <p className="mt-1 text-xs text-slate-400">Examples open a search using the locations available in this project’s catalogue.</p>
          </div>
          <button
            onClick={() => document.getElementById("planner")?.scrollIntoView({ behavior: "smooth" })}
            className="text-xs text-blue-400 hover:underline flex items-center gap-1 font-semibold"
          >
            Plan a journey <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {tripIdeas.map((r) => (
            <div
              key={`${r.from}-${r.to}`}
              onClick={() => openSearch(r.from, r.to)}
              className="p-5 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition cursor-pointer space-y-3 group"
            >
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold px-2 py-1 rounded bg-blue-500/15 text-blue-300">Sample search</span>
                <ArrowRight className="h-4 w-4 text-slate-500" />
              </div>

              <div>
                <h4 className="text-base font-bold text-white group-hover:text-blue-300 transition flex items-center gap-2">
                  <span>{r.from}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                  <span>{r.to}</span>
                </h4>
                <p className="mt-1 text-xs text-slate-400">{r.note}</p>
              </div>

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                <span>Schedules and prices shown after search</span>
                <span className="text-blue-400 font-bold group-hover:translate-x-1 transition">
                  Explore →
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="assistant" className="mx-auto grid max-w-6xl scroll-mt-48 gap-5 px-4 pb-10 md:grid-cols-2">
        <article className="rounded-3xl border border-cyan-300/15 bg-gradient-to-br from-cyan-950/50 to-slate-900/80 p-6 md:p-8">
          <div className="mb-4 grid h-11 w-11 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200"><Sparkles className="h-5 w-5" /></div>
          <p className="text-[10px] font-black uppercase tracking-[.2em] text-cyan-200">Trip planning assistant</p>
          <h2 className="mt-2 text-xl font-black text-white">Need a route with a transfer?</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">Enter your origin and destination above. The planner checks connected schedules in the saved catalogue and lays out each leg, wait, and fare estimate. Sample schedules and fares are labelled and are not live operator data.</p>
          <button onClick={() => document.getElementById("planner")?.scrollIntoView({ behavior: "smooth" })} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-xs font-extrabold text-slate-950 hover:bg-cyan-300">Plan a trip <ArrowRight className="h-4 w-4" /></button>
        </article>
        <article className="rounded-3xl border border-slate-800 bg-slate-900/65 p-6 md:p-8">
          <div className="mb-4 grid h-11 w-11 place-items-center rounded-2xl border border-indigo-300/20 bg-indigo-300/10 text-indigo-200"><CircleHelp className="h-5 w-5" /></div>
          <p className="text-[10px] font-black uppercase tracking-[.2em] text-indigo-200">How it works</p>
          <ol className="mt-3 space-y-3 text-sm text-slate-300"><li><b className="mr-2 text-cyan-200">01</b>Choose supported locations and a travel date.</li><li><b className="mr-2 text-cyan-200">02</b>Compare direct options with connected train and bus legs.</li><li><b className="mr-2 text-cyan-200">03</b>Review each source label and verify service details with the operator.</li></ol>
          <p className="mt-4 border-t border-slate-800 pt-3 text-xs leading-5 text-slate-500">Live rail inventory, official PNR status, bus GPS and flight fares require authorized provider feeds. The app does not invent those values.</p>
        </article>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/45 p-6 md:p-8">
          <h2 className="text-lg font-bold text-white">Frequently asked</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div><h3 className="text-sm font-bold text-slate-200">Are all schedules live?</h3><p className="mt-1 text-xs leading-5 text-slate-400">No. Sample catalogue entries are labelled. Live provider data is shown only when a configured provider returns it.</p></div>
            <div><h3 className="text-sm font-bold text-slate-200">Does a trip plan book every leg?</h3><p className="mt-1 text-xs leading-5 text-slate-400">No. A plan compares connected legs; operator booking and confirmed inventory require provider integrations.</p></div>
            <div><h3 className="text-sm font-bold text-slate-200">Can I save or manage trips?</h3><p className="mt-1 text-xs leading-5 text-slate-400">Sign in to save routes, manage internal bookings, and create price alerts.</p></div>
            <div><h3 className="text-sm font-bold text-slate-200">What is a booking reference?</h3><p className="mt-1 text-xs leading-5 text-slate-400">A Smart Journey reference belongs to this app; it is not an IRCTC PNR or operator ticket number.</p></div>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-800/80 bg-slate-950/60 px-4 py-7 text-xs text-slate-500"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3"><span>Smart Journey · Plan with clear data sources</span><div className="flex flex-wrap gap-4"><button onClick={() => setPnrModalOpen(true)} className="hover:text-cyan-200">Booking help</button><button onClick={() => navigate("/trips")} className="inline-flex items-center gap-1 hover:text-cyan-200"><Bookmark className="h-3 w-3" />Saved trips</button><button onClick={() => navigate("/alerts")} className="hover:text-cyan-200">Price alerts</button></div></div><div className="home-developer-credit mx-auto mt-4 max-w-6xl rounded-xl border px-4 py-3 text-center text-[11px] font-semibold">Developed by Abhishek Jha and Sharad Singh Ghosh <span aria-hidden="true">·</span> Branch CSBS</div></footer>

      {/* Modals */}
      <TrainLiveModal
        isOpen={trainModalOpen}
        onClose={() => setTrainModalOpen(false)}
        trainNumber="12189"
      />
      <PnrCheckModal
        isOpen={pnrModalOpen}
        onClose={() => setPnrModalOpen(false)}
      />
      <BusLiveTrackModal
        isOpen={busTrackModalOpen}
        onClose={() => setBusTrackModalOpen(false)}
        busId="ZG-4412"
        busName="Zingbus AC Sleeper"
      />
    </main>
  );
}
