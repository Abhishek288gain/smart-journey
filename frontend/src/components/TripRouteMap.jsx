import React, { useEffect, useMemo, useRef, useState } from "react";
import { Bus, Plane, Train, MapPin, Info, Plus, Minus, LocateFixed, X } from "lucide-react";

const COLORS = { train: "#48d7a5", bus: "#ffc857", flight: "#69b8ff", cab: "#d49bff" };
const ICONS = { train: Train, bus: Bus, flight: Plane, cab: MapPin };
const valid = (p) => p && Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude));
const displayTime = (value) => value ? new Date(value).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : "time not supplied";

export default function TripRouteMap({ segments, selectedKey, onSelect }) {
  const [openDetail, setOpenDetail] = useState(null);
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, width: 1000, height: 460 });
  const [popup, setPopup] = useState(null);
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const priorSelected = useRef(selectedKey);
  const priorSegments = useRef(segments);
  const plotted = useMemo(() => {
    const items = segments.map((segment, index) => {
      const coords = segment.routeGeometry?.coordinates || [];
      const stops = (Array.isArray(segment.intermediateStops) ? segment.intermediateStops : []).map((stop) => typeof stop === "string" ? null : stop?.coordinates || null).filter(valid);
      const endpoints = [
        { point: segment.fromCoordinates, label: segment.fromCoordinates?.name || segment.from, code: segment.fromCoordinates?.code, kind: "origin" },
        { point: segment.toCoordinates, label: segment.toCoordinates?.name || segment.to, code: segment.toCoordinates?.code, kind: "destination" },
      ].filter((item) => valid(item.point));
      const lines = segment.routeGeometry?.type === "MultiLineString" ? coords : [coords];
      const paths = lines.map((line) => line.map(([longitude, latitude]) => ({ latitude, longitude })).filter(valid)).filter((line) => line.length > 1);
      return { segment, index, paths, points: paths.flat(), stops, endpoints };
    });
    const all = items.flatMap((item) => [...item.points, ...item.stops, ...item.endpoints.map((endpoint) => endpoint.point)]);
    if (!all.length) return { items, project: () => [0, 0], empty: true };
    const clampLat = (value) => Math.max(-85.0511, Math.min(85.0511, Number(value)));
    const worldX = (longitude, zoom) => (Number(longitude) + 180) / 360 * 256 * (2 ** zoom);
    const worldY = (latitude, zoom) => (1 - Math.asinh(Math.tan(clampLat(latitude) * Math.PI / 180)) / Math.PI) / 2 * 256 * (2 ** zoom);
    let minLat = Math.min(...all.map((p) => Number(p.latitude))), maxLat = Math.max(...all.map((p) => Number(p.latitude)));
    let minLon = Math.min(...all.map((p) => Number(p.longitude))), maxLon = Math.max(...all.map((p) => Number(p.longitude)));
    const latPad = Math.max((maxLat - minLat) * 0.14, 0.18), lonPad = Math.max((maxLon - minLon) * 0.14, 0.18);
    minLat = clampLat(minLat - latPad); maxLat = clampLat(maxLat + latPad); minLon -= lonPad; maxLon += lonPad;
    const spanAt = (zoom) => ({ x: worldX(maxLon, zoom) - worldX(minLon, zoom), y: Math.abs(worldY(maxLat, zoom) - worldY(minLat, zoom)) });
    let zoom = 2;
    for (let candidate = 2; candidate <= 11; candidate += 1) { const span = spanAt(candidate); if (span.x <= 920 && span.y <= 380) zoom = candidate; else break; }
    const span = spanAt(zoom), x0 = worldX(minLon, zoom), y0 = Math.min(worldY(minLat, zoom), worldY(maxLat, zoom));
    const mapScale = Math.min(920 / (span.x || 1), 380 / (span.y || 1));
    const drawnWidth = span.x * mapScale, drawnHeight = span.y * mapScale;
    const offsetX = (1000 - drawnWidth) / 2, offsetY = (460 - drawnHeight) / 2;
    const project = (point) => [offsetX + (worldX(point.longitude, zoom) - x0) * mapScale, offsetY + (worldY(point.latitude, zoom) - y0) * mapScale];
    const tiles = [];
    for (let x = Math.floor(x0 / 256); x <= Math.floor((x0 + span.x) / 256); x += 1) for (let y = Math.floor(y0 / 256); y <= Math.floor((y0 + span.y) / 256); y += 1) {
      tiles.push({ x: offsetX + (x * 256 - x0) * mapScale, y: offsetY + (y * 256 - y0) * mapScale, w: 256 * mapScale, h: 256 * mapScale, src: `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png` });
    }
    return { items, project, tiles, empty: false };
  }, [segments]);
  const selected = segments.find((segment, index) => `${segment.index ?? index + 1}` === String(selectedKey));

  const focusOn = (item) => {
    const points = item ? [...item.points, ...item.stops, ...item.endpoints.map((entry) => entry.point)] : plotted.items.flatMap((entry) => [...entry.points, ...entry.stops, ...entry.endpoints.map((endpoint) => endpoint.point)]);
    if (!points.length) return;
    const projected = points.map(plotted.project);
    let minX = Math.min(...projected.map(([x]) => x)), maxX = Math.max(...projected.map(([x]) => x));
    let minY = Math.min(...projected.map(([, y]) => y)), maxY = Math.max(...projected.map(([, y]) => y));
    const padX = Math.max((maxX - minX) * 0.18, 55), padY = Math.max((maxY - minY) * 0.18, 45);
    minX -= padX; maxX += padX; minY -= padY; maxY += padY;
    const aspect = 1000 / 460;
    let width = maxX - minX, height = maxY - minY;
    if (width / height < aspect) { const extra = height * aspect - width; minX -= extra / 2; width += extra; }
    else { const extra = width / aspect - height; minY -= extra / 2; height += extra; }
    setViewBox({ x: minX, y: minY, width, height });
  };

  useEffect(() => {
    if (priorSegments.current !== segments) {
      priorSegments.current = segments;
      focusOn(null);
    }
  }, [segments, plotted]);

  useEffect(() => {
    if (priorSelected.current !== selectedKey) {
      priorSelected.current = selectedKey;
      const item = plotted.items.find((entry) => `${entry.segment.index ?? entry.index + 1}` === String(selectedKey));
      if (item) focusOn(item);
    }
  }, [selectedKey, plotted]);

  const zoom = (factor) => setViewBox((current) => {
    const width = Math.max(100, Math.min(4000, current.width * factor));
    const height = width * 460 / 1000;
    return { x: current.x + (current.width - width) / 2, y: current.y + (current.height - height) / 2, width, height };
  });

  const startPan = (event) => {
    if (event.target.closest?.("g[role='button']") || event.target.closest?.("button")) return;
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, viewBox };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const movePan = (event) => {
    if (!dragRef.current || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = dragRef.current.viewBox.width / rect.width, scaleY = dragRef.current.viewBox.height / rect.height;
    setViewBox({ ...dragRef.current.viewBox, x: dragRef.current.viewBox.x - (event.clientX - dragRef.current.x) * scaleX, y: dragRef.current.viewBox.y - (event.clientY - dragRef.current.y) * scaleY });
  };
  const stopPan = () => { dragRef.current = null; };

  const chooseSegment = (key, point, detail) => {
    onSelect?.(key);
    setOpenDetail(key);
    setPopup({ title: detail.title, description: detail.description, point });
    const item = plotted.items.find((entry) => `${entry.segment.index ?? entry.index + 1}` === String(key));
    if (item) focusOn(item);
  };

  if (plotted.empty) return <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-900/70 p-5 text-sm text-slate-300"><Info className="mr-2 inline h-4 w-4 text-amber-300" />Map route unavailable: saved or resolved coordinates are missing. No straight line is drawn.</div>;

  return <div className="sj-route-map-shell mt-4 overflow-hidden rounded-2xl border border-slate-700/80 bg-[#071526]">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
      <div><p className="text-xs font-bold text-white">Transport route map</p><p className="text-[10px] text-slate-400">Routes with missing network geometry are intentionally omitted.</p></div>
      <div className="flex flex-wrap items-center gap-3"><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="text-[9px] text-slate-400">Â© OpenStreetMap</a><div className="flex flex-wrap gap-x-3 gap-y-1">{["train", "bus", "flight"].map((mode) => { const Icon = ICONS[mode]; return <span key={mode} className="inline-flex items-center gap-1 text-[10px] capitalize text-slate-300"><Icon size={12} color={COLORS[mode]} />{mode}<i className="ml-1 inline-block w-5 border-t-2" style={{ borderColor: COLORS[mode], borderStyle: mode === "flight" ? "dashed" : "solid" }} /></span>; })}<span className="inline-flex items-center gap-1 text-[10px] text-slate-300"><i className="w-5 border-t border-dashed border-slate-300" />Transfer</span><span className="text-[10px] text-emerald-300">â— Origin</span><span className="text-[10px] text-rose-300">â— Destination</span></div></div>
    </div>
    <div className="relative">
    <div className="absolute right-3 top-3 z-10 flex flex-col overflow-hidden rounded-lg border border-slate-500/60 bg-slate-950/90 shadow-lg" aria-label="Map controls">
      <button type="button" title="Zoom in" aria-label="Zoom in" onClick={() => zoom(0.75)} className="grid h-11 w-11 place-items-center text-white hover:bg-white/10"><Plus size={17} /></button>
      <button type="button" title="Zoom out" aria-label="Zoom out" onClick={() => zoom(1.33)} className="grid h-11 w-11 place-items-center border-t border-white/15 text-white hover:bg-white/10"><Minus size={17} /></button>
      <button type="button" title="Fit complete journey" aria-label="Fit complete journey" onClick={() => focusOn(null)} className="grid h-11 w-11 place-items-center border-t border-white/15 text-white hover:bg-white/10"><LocateFixed size={16} /></button>
    </div>
    {popup && <div className="absolute left-3 top-3 z-10 max-w-[min(80%,340px)] rounded-xl border border-cyan-200/25 bg-slate-950/95 p-3 pr-9 text-xs text-white shadow-xl"><button type="button" aria-label="Close map details" onClick={() => setPopup(null)} className="absolute right-2 top-2 text-slate-400 hover:text-white"><X size={15} /></button><b>{popup.title}</b><p className="mt-1 text-slate-300">{popup.description}</p>{popup.point && <p className="mt-1 text-[10px] text-slate-500">{Number(popup.point.latitude).toFixed(4)}, {Number(popup.point.longitude).toFixed(4)}</p>}</div>}
    <svg ref={svgRef} viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`} role="application" aria-label="Interactive journey map. Drag to pan; use map controls to zoom and fit the route." className="block h-[280px] w-full cursor-grab touch-none select-none active:cursor-grabbing md:h-[390px]" onPointerDown={startPan} onPointerMove={movePan} onPointerUp={stopPan} onPointerCancel={stopPan}>
      <defs>
        <pattern id="map-grid" width="44" height="44" patternUnits="userSpaceOnUse"><path d="M 44 0 L 0 0 0 44" fill="none" stroke="#aac5df" strokeOpacity=".055" strokeWidth="1" /></pattern>
        {Object.entries(COLORS).map(([mode, color]) => <marker key={mode} id={`arrow-${mode}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill={color} /></marker>)}
        <marker id="rail-tie" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M 5 0 L 5 10" stroke="#e5fff4" strokeWidth="2" /></marker>
      </defs>
      <rect width="1000" height="460" fill="#07111f" />
      {plotted.tiles.map((tile) => <image key={tile.src} href={tile.src} x={tile.x} y={tile.y} width={tile.w} height={tile.h} opacity=".94" preserveAspectRatio="none" style={{ filter: "invert(.86) hue-rotate(180deg) brightness(.78) contrast(.95) saturate(.75)" }} onError={(event) => { event.currentTarget.style.display = "none"; }} />)}
      <rect width="1000" height="460" fill="url(#map-grid)" pointerEvents="none" />
      {plotted.items.map(({ segment, index, paths }) => {
        if (!paths.length) return null;
        const color = COLORS[segment.transportMode || segment.mode] || "#a8b8ca";
        const key = `${segment.index ?? index + 1}`;
        const linePoints = paths.flat();
        const middle = linePoints[Math.floor(linePoints.length / 2)];
        return <g key={key} role="button" tabIndex="0" aria-label={`Select ${segment.modeLabel} ${segment.from} to ${segment.to}`} onClick={() => chooseSegment(key, middle, { title: `${segment.modeLabel}: ${segment.from} â†’ ${segment.to}`, description: `${segment.serviceName || "Service"} ${segment.serviceReference || ""} Â· ${displayTime(segment.departureTime)} â€“ ${displayTime(segment.arrivalTime)} Â· ${segment.geometryStatus || "UNAVAILABLE"}` })} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") chooseSegment(key, middle, { title: `${segment.modeLabel}: ${segment.from} â†’ ${segment.to}`, description: `${segment.serviceName || "Service"} ${segment.serviceReference || ""}` }); }} className="cursor-pointer">{paths.map((points, pathIndex) => { const path = points.map((point, pointIndex) => `${pointIndex ? "L" : "M"}${plotted.project(point).join(",")}`).join(" "); const mode = segment.transportMode || segment.mode; const approximateTrain = mode === "train" && segment.geometryStatus === "APPROXIMATE"; return <React.Fragment key={pathIndex}><path d={path} fill="none" stroke={color} strokeOpacity={selectedKey === key ? 1 : .72} strokeWidth={mode === "bus" ? 5 : 4} strokeDasharray={mode === "flight" ? "10 8" : approximateTrain ? "4 7" : undefined} strokeLinecap="round" strokeLinejoin="round" markerEnd={`url(#arrow-${mode})`} markerMid={mode === "train" && !approximateTrain ? "url(#rail-tie)" : undefined} /><path d={path} fill="none" stroke="transparent" strokeWidth="20" /></React.Fragment>; })}</g>;
      })}
      {plotted.items.slice(0, -1).map(({ segment, index }, i) => {
        const next = plotted.items[i + 1];
        if (!valid(segment.toCoordinates) || !valid(next.segment.fromCoordinates)) return null;
        const start = plotted.project(segment.toCoordinates), end = plotted.project(next.segment.fromCoordinates);
        return <g key={`transfer-${index}`}><path d={`M${start.join(",")} L${end.join(",")}`} fill="none" stroke="#d8e3f0" strokeOpacity=".65" strokeDasharray="4 6" strokeWidth="2" /><text x={(start[0] + end[0]) / 2} y={(start[1] + end[1]) / 2 - 7} fill="#c6d1df" fontSize="10" stroke="#071526" strokeWidth="3" paintOrder="stroke">Transfer</text></g>;
      })}
      {plotted.items.flatMap(({ segment, index, stops, endpoints }) => {
        const mode = segment.transportMode || segment.mode;
        const color = COLORS[mode] || "#a8b8ca";
        const key = `${segment.index ?? index + 1}`;
        const marks = [...endpoints, ...stops.map((point) => ({ point, label: point.name, code: point.code, kind: "stop" }))];
        return marks.map(({ point, label, code, kind }, markIndex) => {
          const [x, y] = plotted.project(point);
          const Icon = ICONS[mode] || MapPin;
          return <g key={`${key}-${kind}-${markIndex}`} role="button" tabIndex="0" aria-label={`${kind}: ${label}`} onClick={() => chooseSegment(key, point, { title: `${label || kind}${code ? ` (${code})` : ""}`, description: `${segment.modeLabel} Â· ${segment.serviceName || "Service"} ${segment.serviceReference || ""} Â· ${displayTime(segment.departureTime)} â€“ ${displayTime(segment.arrivalTime)}` })} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") chooseSegment(key, point, { title: label || kind, description: `${segment.modeLabel} Â· ${segment.serviceName || "Service"}` }); }} className="cursor-pointer">
            <circle cx={x} cy={y} r={kind === "stop" ? 5 : 8} fill={kind === "origin" ? "#39d98a" : kind === "destination" ? "#fb7185" : color} stroke="#071526" strokeWidth="3" />
            {kind !== "stop" && <foreignObject x={x - 8} y={y - 8} width="16" height="16"><Icon size={13} color="#06111f" /></foreignObject>}
            <text x={x + 10} y={y - 9} fill="#e5edf8" fontSize="12" stroke="#071526" strokeWidth="3" paintOrder="stroke">{`${label || kind}${code ? ` (${code})` : ""}`.slice(0, 36)}</text>
          </g>;
        });
      })}
    </svg>
    </div>
    <div className="grid gap-2 border-t border-white/10 p-3 sm:grid-cols-2">
      {segments.map((segment, index) => {
        const key = `${segment.index ?? index + 1}`;
        const mode = segment.transportMode || segment.mode;
        const Icon = ICONS[mode] || MapPin;
        return <button type="button" key={key} onClick={() => { onSelect?.(key); setOpenDetail(key); }} className={`rounded-xl border p-2.5 text-left ${selectedKey === key ? "border-cyan-300/70 bg-cyan-300/10" : "border-slate-700 bg-slate-900/70"}`}>
          <span className="flex items-center gap-2 text-xs font-bold text-white"><Icon size={14} color={COLORS[mode]} />Leg {key}: {segment.from} â†’ {segment.to}</span>
          <span className="mt-1 block text-[10px] text-slate-400">{segment.geometryStatus || "UNAVAILABLE"} Â· {segment.dataSource || "Route source not supplied"}</span>
        </button>;
      })}
    </div>
    {selected && <details open className="sj-map-details border-t border-white/10 bg-slate-950/50 px-4 py-3 text-xs text-slate-300"><summary className="min-h-11 cursor-pointer content-center font-bold text-white">Leg details: {selected.modeLabel} Â· {selected.from} â†’ {selected.to}</summary><div className="pt-2"><p className="text-slate-400">{selected.geometryMessage || "No verified route geometry available."}</p>{selected.intermediateStops?.length > 0 && <p className="mt-1 text-[10px] text-slate-400">Stops: {selected.intermediateStops.map((stop) => typeof stop === "string" ? `${stop} (DEMO location unverified)` : `${stop.name || stop.station || stop.city || stop.code || "Stop"}${valid(stop.coordinates) ? "" : " (DEMO location unverified)"}`).filter(Boolean).join(" Â· ")}</p>}{openDetail && <p className="mt-1 text-[10px] text-slate-500">Geometry source: {selected.dataSource} Â· Schedule source: {selected.scheduleDataSource || "Not supplied"} Â· Schedule status: {selected.dataStatus || "DEMO"}</p>}</div></details>}
  </div>;
}
