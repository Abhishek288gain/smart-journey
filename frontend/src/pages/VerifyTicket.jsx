import { useEffect, useRef, useState } from "react";
import { AlertCircle, Camera, CheckCircle2, ScanLine, ShieldCheck } from "lucide-react";
import { bookingApi } from "../services/api";

export default function VerifyTicket() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [raw, setRaw] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setScanning(false);
  };

  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), []);

  const verify = async (payloadText = raw) => {
    setError(""); setResult(null);
    try {
      const ticket = JSON.parse(payloadText);
      const response = await bookingApi.verifyTicket(ticket);
      setResult(response.data);
    } catch (err) {
      setError(err.response?.data?.message || (err instanceof SyntaxError ? "Paste the complete JSON payload from the ticket QR code." : "Could not verify this ticket."));
    }
  };

  const startCamera = async () => {
    setError("");
    if (!("BarcodeDetector" in window) || !navigator.mediaDevices?.getUserMedia) {
      setError("This browser does not support QR scanning. Paste the QR code text below instead."); return;
    }
    try {
      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      streamRef.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      videoRef.current.srcObject = streamRef.current;
      await videoRef.current.play();
      setScanning(true);
      const scan = async () => {
        if (!streamRef.current || !videoRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes[0]?.rawValue) { setRaw(codes[0].rawValue); stopCamera(); verify(codes[0].rawValue); return; }
        } catch (_) { /* Continue scanning while the camera adjusts. */ }
        if (streamRef.current) window.setTimeout(scan, 300);
      };
      scan();
    } catch (_) { stopCamera(); setError("Camera access failed. Allow camera permission or paste the QR payload below."); }
  };

  return <main className="min-h-[calc(100vh-72px)] bg-slate-950 px-4 py-12 text-slate-100">
    <section className="mx-auto max-w-2xl rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl sm:p-9">
      <div className="mb-6 flex items-center gap-3"><div className="rounded-2xl bg-teal-500/15 p-3 text-teal-300"><ShieldCheck /></div><div><p className="text-xs font-bold uppercase tracking-[.2em] text-teal-300">Ticket security</p><h1 className="text-2xl font-black">Verify e-ticket</h1></div></div>
      <p className="mb-6 text-sm leading-6 text-slate-400">Scan the ticket QR code or paste its JSON text to check its signature and current booking status.</p>
      <div className="mb-4 overflow-hidden rounded-2xl border border-slate-700 bg-black">
        <video ref={videoRef} className={`aspect-video w-full object-cover ${scanning ? "block" : "hidden"}`} playsInline muted />
        {!scanning && <div className="flex aspect-video items-center justify-center text-slate-500"><ScanLine size={44} /></div>}
      </div>
      <button onClick={scanning ? stopCamera : startCamera} className="mb-5 flex w-full items-center justify-center gap-2 rounded-xl border border-teal-500/40 bg-teal-500/10 px-4 py-3 font-bold text-teal-200 hover:bg-teal-500/20">{scanning ? <><Camera size={17} /> Stop camera</> : <><Camera size={17} /> Scan ticket QR</>}</button>
      <form onSubmit={(event) => { event.preventDefault(); verify(); }} className="space-y-3">
        <label htmlFor="ticket-payload" className="text-xs font-bold uppercase tracking-wider text-slate-400">Or paste the QR payload</label>
        <textarea id="ticket-payload" value={raw} onChange={(event) => setRaw(event.target.value)} rows={5} placeholder='{"pnr":"SJ12345678", ...}' className="w-full resize-y rounded-xl border border-slate-700 bg-slate-950 p-3 font-mono text-xs text-slate-200 outline-none focus:border-teal-400" />
        <button className="w-full rounded-xl bg-blue-600 px-4 py-3 font-bold text-white hover:bg-blue-500">Verify ticket</button>
      </form>
      {error && <div className="mt-4 flex gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200"><AlertCircle size={18} className="shrink-0" />{error}</div>}
      {result && <div className={`mt-4 rounded-2xl border p-4 ${result.valid ? "border-emerald-500/40 bg-emerald-500/10" : "border-amber-500/40 bg-amber-500/10"}`}>
        <div className="mb-3 flex items-center gap-2 font-bold">{result.valid ? <CheckCircle2 className="text-emerald-300" /> : <AlertCircle className="text-amber-300" />}{result.message}</div>
        {result.ticket && <div className="grid grid-cols-2 gap-3 text-sm"><span className="text-slate-400">Smart Journey reference</span><strong>{result.ticket.pnr}</strong><span className="text-slate-400">Route</span><strong>{result.ticket.origin} → {result.ticket.destination}</strong><span className="text-slate-400">Mode</span><strong className="capitalize">{result.ticket.mode}</strong><span className="text-slate-400">Seats</span><strong>{result.ticket.seats.join(", ")}</strong></div>}
      </div>}
    </section>
  </main>;
}
