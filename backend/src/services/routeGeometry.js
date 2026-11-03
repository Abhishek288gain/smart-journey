const timeoutSignal = (milliseconds = 8000) => AbortSignal.timeout(milliseconds);
const { airportPoint } = require("../data/airportCoordinates");
const validPoint = (point) => point && Number.isFinite(Number(point.latitude)) && Number.isFinite(Number(point.longitude));
const toPoint = (latitude, longitude, name, code) => ({ latitude: Number(latitude), longitude: Number(longitude), name, code: code || null });
const limitLine = (coordinates, maxPoints = 2200) => {
  if (coordinates.length <= maxPoints) return coordinates;
  const stride = (coordinates.length - 1) / (maxPoints - 1);
  return Array.from({ length: maxPoints }, (_, index) => coordinates[Math.round(index * stride)]);
};
const geometryCache = new Map();
const cacheRequest = (key, loader) => {
  const existing = geometryCache.get(key);
  if (existing && existing.expiresAt > Date.now()) return existing.promise;
  const promise = Promise.resolve().then(loader);
  geometryCache.set(key, { promise, expiresAt: Date.now() + 12000 });
  promise.then((value) => {
    const current = geometryCache.get(key);
    if (current?.promise === promise) current.expiresAt = Date.now() + (value ? 6 * 60 * 60 * 1000 : 30000);
  }, () => geometryCache.delete(key));
  return promise;
};

async function geocodeAirportRaw(name, city) {
  const query = `${name || "airport"}, ${city || ""}, airport`;
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.search = new URLSearchParams({ q: query, format: "jsonv2", limit: "3" }).toString();
    const response = await fetch(url, { signal: timeoutSignal(6000), headers: { "User-Agent": "SmartJourneyPlanner/1.0 (route map)" } });
    if (!response.ok) return null;
    const results = await response.json();
    const result = results.find((item) => item.class === "aeroway" || item.type === "aerodrome");
    return result ? { ...toPoint(result.lat, result.lon, name), coordinateSource: "OpenStreetMap airport geocoding" } : null;
  } catch { return null; }
}

async function geocodeStopRaw(name, city, mode) {
  const cleanedName = String(name || "").replace(/\bdemo\b/gi, "").replace(/\s+/g, " ").trim();
  if (!cleanedName || !city) return null;
  const query = `${cleanedName} ${mode === "train" ? "railway station" : "bus station"}, ${city}, India`;
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.search = new URLSearchParams({ q: query, format: "jsonv2", limit: "5" }).toString();
    const response = await fetch(url, { signal: timeoutSignal(6000), headers: { "User-Agent": "SmartJourneyPlanner/1.0 (route map)" } });
    if (!response.ok) return null;
    const results = await response.json();
    const result = results.find((item) => mode === "train"
      ? item.class === "railway" && ["station", "halt", "tram_stop"].includes(item.type)
      : (item.class === "amenity" && item.type === "bus_station") || (item.class === "highway" && item.type === "bus_stop") || (item.class === "public_transport" && ["station", "platform"].includes(item.type)));
    return result ? toPoint(result.lat, result.lon, result.name || cleanedName) : null;
  } catch { return null; }
}

function greatCircle(from, to, samples = 48) {
  const rad = Math.PI / 180;
  const a = [from.latitude * rad, from.longitude * rad];
  const b = [to.latitude * rad, to.longitude * rad];
  const vector = ([lat, lon]) => [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)];
  const va = vector(a), vb = vector(b);
  const dot = Math.max(-1, Math.min(1, va.reduce((sum, x, i) => sum + x * vb[i], 0)));
  const omega = Math.acos(dot), sinOmega = Math.sin(omega);
  const coordinates = [];
  for (let i = 0; i <= samples; i += 1) {
    const t = i / samples;
    const scaleA = sinOmega ? Math.sin((1 - t) * omega) / sinOmega : 1 - t;
    const scaleB = sinOmega ? Math.sin(t * omega) / sinOmega : t;
    const x = va.map((value, j) => value * scaleA + vb[j] * scaleB);
    coordinates.push([Math.atan2(x[1], x[0]) / rad, Math.atan2(x[2], Math.hypot(x[0], x[1])) / rad]);
  }
  return { type: "LineString", coordinates };
}

async function roadGeometryRaw(from, to) {
  try {
    const path = `${from.longitude},${from.latitude};${to.longitude},${to.latitude}`;
    const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${path}?overview=full&geometries=geojson&steps=false`, { signal: timeoutSignal(8000) });
    const body = await response.json();
    const geometry = body.routes?.[0]?.geometry;
    return response.ok && geometry?.coordinates?.length > 1 ? { ...geometry, coordinates: limitLine(geometry.coordinates) } : null;
  } catch { return null; }
}

async function railGeometryRaw(from, to, reference, name) {
  // OSM route relations are the only geometry treated as verified railway routing.
  const safeTag = (value) => String(value || "").replace(/["\[\];\\]/g, "").slice(0, 120);
  const selectors = [reference && `relation[route~"train|railway"][ref="${safeTag(reference)}"]`, name && `relation[route~"train|railway"][name="${safeTag(name)}"]`].filter(Boolean);
  if (!selectors.length) return null;
  const query = `[out:json][timeout:10];(${selectors.join(";")});out geom;`;
  try {
    const response = await fetch("https://overpass-api.de/api/interpreter", { method: "POST", signal: timeoutSignal(6500), headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" }, body: new URLSearchParams({ data: query }) });
    if (!response.ok) return null;
    const body = await response.json();
    const ways = body.elements?.flatMap((relation) => relation.members || []).filter((member) => member.type === "way" && member.geometry?.length > 1) || [];
    if (!ways.length) return null;
    const locations = ways.flatMap((way, wayIndex) => way.geometry.map((point, pointIndex) => ({ wayIndex, pointIndex, coord: [point.lon, point.lat] })));
    const nearest = (point) => locations.reduce((best, candidate) => {
      const score = (candidate.coord[0] - point.longitude) ** 2 + (candidate.coord[1] - point.latitude) ** 2;
      return score < best.score ? { ...candidate, score } : best;
    }, { wayIndex: 0, pointIndex: 0, score: Infinity });
    const start = nearest(from), end = nearest(to);
    if (start.wayIndex === end.wayIndex && start.pointIndex === end.pointIndex) return null;
    const lines = [];
    const step = start.wayIndex <= end.wayIndex ? 1 : -1;
    for (let wayIndex = start.wayIndex; step > 0 ? wayIndex <= end.wayIndex : wayIndex >= end.wayIndex; wayIndex += step) {
      const geometry = ways[wayIndex].geometry;
      let first = wayIndex === start.wayIndex ? start.pointIndex : (step > 0 ? 0 : geometry.length - 1);
      let last = wayIndex === end.wayIndex ? end.pointIndex : (step > 0 ? geometry.length - 1 : 0);
      let line = first <= last ? geometry.slice(first, last + 1) : geometry.slice(last, first + 1).reverse();
      if (line.length > 1) lines.push(line.map((point) => [point.lon, point.lat]));
    }
    // Keep OSM way fragments separate; never invent straight track connectors.
    return lines.length ? { type: "MultiLineString", coordinates: lines } : null;
  } catch { return null; }
}

async function railNetworkGeometryRaw(from, to) {
  const latPad = Math.min(0.7, Math.max(0.22, Math.abs(from.latitude - to.latitude) * 0.08));
  const lonPad = Math.min(0.7, Math.max(0.22, Math.abs(from.longitude - to.longitude) * 0.08));
  const south = Math.min(from.latitude, to.latitude) - latPad, north = Math.max(from.latitude, to.latitude) + latPad;
  const west = Math.min(from.longitude, to.longitude) - lonPad, east = Math.max(from.longitude, to.longitude) + lonPad;
  if ((north - south) * (east - west) > 90) return null;
  const query = `[out:json][timeout:6];way[railway~"^(rail|narrow_gauge)$"](${south},${west},${north},${east});out geom;`;
  try {
    const response = await fetch("https://overpass-api.de/api/interpreter", { method: "POST", signal: timeoutSignal(7000), headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" }, body: new URLSearchParams({ data: query }) });
    if (!response.ok) return null;
    const body = await response.json();
    const ways = body.elements?.filter((way) => way.type === "way" && way.geometry?.length > 1) || [];
    const graph = new Map(), coordinates = new Map();
    const keyOf = (point) => `${Number(point.lat).toFixed(5)},${Number(point.lon).toFixed(5)}`;
    const edgeLength = (a, b) => {
      const rad = Math.PI / 180, dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
      const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
      return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
    };
    const connect = (a, b) => {
      const ka = keyOf(a), kb = keyOf(b);
      if (ka === kb) return;
      coordinates.set(ka, [Number(a.lon), Number(a.lat)]); coordinates.set(kb, [Number(b.lon), Number(b.lat)]);
      if (!graph.has(ka)) graph.set(ka, []); if (!graph.has(kb)) graph.set(kb, []);
      const distance = edgeLength(a, b);
      graph.get(ka).push([kb, distance]); graph.get(kb).push([ka, distance]);
    };
    for (const way of ways) for (let i = 1; i < way.geometry.length; i += 1) connect(way.geometry[i - 1], way.geometry[i]);
    if (!graph.size) return null;
    const nearest = (point) => {
      let result = null, best = Infinity;
      const cosLat = Math.cos(point.latitude * Math.PI / 180);
      for (const key of graph.keys()) {
        const [lat, lon] = key.split(",").map(Number);
        const score = (lat - point.latitude) ** 2 + ((lon - point.longitude) * cosLat) ** 2;
        if (score < best) { best = score; result = key; }
      }
      return best <= 0.18 ** 2 ? result : null;
    };
    const start = nearest(from), target = nearest(to);
    if (!start || !target) return null;
    const distances = new Map([[start, 0]]), previous = new Map(), heap = [];
    const push = (value) => { heap.push(value); let i = heap.length - 1; while (i) { const p = Math.floor((i - 1) / 2); if (heap[p][1] <= heap[i][1]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const root = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; while (true) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][1] < heap[m][1]) m = l; if (r < heap.length && heap[r][1] < heap[m][1]) m = r; if (m === i) break; [heap[i], heap[m]] = [heap[m], heap[i]]; i = m; } } return root; };
    push([start, 0]);
    while (heap.length) {
      const [current, distance] = pop();
      if (distance !== distances.get(current)) continue;
      if (current === target) break;
      for (const [next, weight] of graph.get(current)) {
        const candidate = distance + weight;
        if (candidate < (distances.get(next) ?? Infinity)) { distances.set(next, candidate); previous.set(next, current); push([next, candidate]); }
      }
    }
    if (!distances.has(target)) return null;
    const path = [target];
    while (path.at(-1) !== start) { const parent = previous.get(path.at(-1)); if (!parent) return null; path.push(parent); }
    path.reverse();
    return path.length > 1 ? { type: "LineString", coordinates: limitLine(path.map((key) => coordinates.get(key))) } : null;
  } catch { return null; }
}

const pointKey = (point) => `${Number(point.latitude).toFixed(5)},${Number(point.longitude).toFixed(5)}`;
const geocodeAirport = (name, city) => cacheRequest(`airport:${String(name || "").toLowerCase()}|${String(city || "").toLowerCase()}`, () => geocodeAirportRaw(name, city));
const geocodeStop = (name, city, mode) => cacheRequest(`stop:${mode}:${String(name || "").toLowerCase()}|${String(city || "").toLowerCase()}`, () => geocodeStopRaw(name, city, mode));
const roadGeometry = (from, to) => cacheRequest(`road:${pointKey(from)}:${pointKey(to)}`, () => roadGeometryRaw(from, to));
const railGeometry = (from, to, reference, name) => cacheRequest(`rail:${String(reference || name || "").toLowerCase()}:${pointKey(from)}:${pointKey(to)}`, () => railGeometryRaw(from, to, reference, name));
const railNetworkGeometry = (from, to) => cacheRequest(`rail-network:${pointKey(from)}:${pointKey(to)}`, () => railNetworkGeometryRaw(from, to));

async function enrichSegmentRaw(segment) {
  let from = segment.fromCoordinates;
  let to = segment.toCoordinates;
  if (segment.transportMode === "flight") {
    if (!validPoint(from)) from = airportPoint(segment.fromLocationCode) || await geocodeAirport(segment.fromLocationName || segment.from, segment.fromCity || segment.from);
    if (!validPoint(to)) to = airportPoint(segment.toLocationCode) || await geocodeAirport(segment.toLocationName || segment.to, segment.toCity || segment.to);
  } else if (segment.transportMode === "train" || segment.transportMode === "bus") {
    if (!validPoint(from)) from = await geocodeStop(segment.fromLocationName || segment.from, segment.fromCity || segment.from, segment.transportMode);
    if (!validPoint(to)) to = await geocodeStop(segment.toLocationName || segment.to, segment.toCity || segment.to, segment.transportMode);
  }
  if (validPoint(from)) from = { ...from, name: from.name || segment.fromLocationName || segment.from, code: from.code || segment.fromLocationCode || null };
  if (validPoint(to)) to = { ...to, name: to.name || segment.toLocationName || segment.to, code: to.code || segment.toLocationCode || null };
  const fromCoordinatesAccuracy = validPoint(from) && segment.fromCoordinatesAccuracy === "UNAVAILABLE" ? (from.coordinateSource ? "AIRPORT_DATASET" : "GEOCODED") : segment.fromCoordinatesAccuracy;
  const toCoordinatesAccuracy = validPoint(to) && segment.toCoordinatesAccuracy === "UNAVAILABLE" ? (to.coordinateSource ? "AIRPORT_DATASET" : "GEOCODED") : segment.toCoordinatesAccuracy;
  const base = { ...segment, scheduleDataSource: segment.dataSource, dataSource: "Route geometry source unavailable", fromCoordinates: validPoint(from) ? from : null, toCoordinates: validPoint(to) ? to : null, fromCoordinatesAccuracy, toCoordinatesAccuracy, routeGeometry: null, geometryType: "UNAVAILABLE" };
  if (!validPoint(from) || !validPoint(to)) {
    return { ...base, geometryStatus: "UNAVAILABLE", geometryMessage: "Coordinates are unavailable for one or both stops; no route line is shown." };
  }
  if (segment.transportMode === "flight") {
    const coordinateSources = [...new Set([from.coordinateSource, to.coordinateSource].filter(Boolean))];
    const coordinateSource = coordinateSources.join(" + ") || "saved airport coordinates";
    return { ...base, routeGeometry: greatCircle(from, to), dataSource: `Airport coordinates: ${coordinateSource}; great-circle geodesic`, geometryType: "APPROXIMATE", geometryStatus: "APPROXIMATE", geometryMessage: "Approximate aerial great-circle path between airport coordinates; the actual aircraft track may vary." };
  }
  if (segment.transportMode === "bus") {
    const geometry = await roadGeometry(from, to);
    return geometry
      ? { ...base, routeGeometry: geometry, dataSource: "OpenStreetMap road routing via OSRM", geometryType: "APPROXIMATE", geometryStatus: "APPROXIMATE", geometryMessage: "Approximate road route between the terminals; the operator’s exact bus path is not supplied. Schedule and fare provenance are shown separately." }
      : { ...base, geometryStatus: "UNAVAILABLE", geometryMessage: "Road routing service did not return a route. No straight-line road route is drawn." };
  }
  if (segment.transportMode === "train") {
    const demoService = /^(demo|sample)/i.test(String(segment.serviceReference || "")) || /^(demo|sample)/i.test(String(segment.serviceName || ""));
    const geometry = demoService ? null : await railGeometry(from, to, segment.serviceReference, segment.serviceName);
    if (geometry) return { ...base, routeGeometry: geometry, dataSource: "OpenStreetMap railway route relation", geometryType: "VERIFIED", geometryStatus: "VERIFIED", geometryMessage: "Railway line matched from an OpenStreetMap train route relation. Timetable and fare provenance are shown separately." };
    const approximateRail = await railNetworkGeometry(from, to);
    if (approximateRail) return { ...base, routeGeometry: approximateRail, dataSource: "OpenStreetMap railway network shortest path", geometryType: "APPROXIMATE", geometryStatus: "APPROXIMATE", geometryMessage: "Approximate path through mapped railway tracks; it is not verified against this train service’s operating route. Timetable and fare are shown separately." };
    return {
      ...base,
      routeGeometry: greatCircle(from, to, 32),
      dataSource: "Approximate endpoint connector; railway network data unavailable",
      geometryType: "APPROXIMATE",
      geometryStatus: "APPROXIMATE",
      geometryMessage: "Approximate connection between the mapped endpoints only; this line is not railway track and does not represent the train’s operating route.",
    };
  }
  return { ...base, geometryStatus: "UNAVAILABLE", geometryMessage: "Route geometry is not available for this transport mode." };
}

async function enrichSegment(segment) {
  const result = await enrichSegmentRaw(segment);
  const approximatePins = segment.fromCoordinatesAccuracy === "CITY_APPROXIMATE" || segment.toCoordinatesAccuracy === "CITY_APPROXIMATE";
  if (!approximatePins) return result;
  if (segment.transportMode === "bus" && result.routeGeometry) return { ...result, geometryMessage: "Road-following route between city-area reference pins; exact terminal coordinates and the operator’s bus path are not supplied." };
  if (segment.transportMode === "train") return { ...result, geometryType: "APPROXIMATE", geometryStatus: "APPROXIMATE", geometryMessage: `${result.geometryMessage} One or both pins show a city area because the exact station coordinate is missing.` };
  return result;
}

exports.enrichSegment = enrichSegment;
exports.toPoint = toPoint;
exports.validPoint = validPoint;
exports.greatCircle = greatCircle;
