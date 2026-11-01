const prisma = require("../config/prisma");

const MAX_LEGS = 3;
const TRANSFER_MINUTES = 75;
const modeNames = { train: "Train", bus: "Intercity bus", flight: "Flight", cab: "Cab" };
const displayText = (value) => String(value || "").replace(/demo/gi, "").replace(/\s+/g, " ").replace(/^[-\s]+|[-\s]+$/g, "").trim();
const CITY_ALIASES = { delhi: "New Delhi", bangalore: "Bengaluru", bengaluru: "Bengaluru", bombay: "Mumbai", calcutta: "Kolkata", madras: "Chennai" };
const canonicalCity = (city) => CITY_ALIASES[String(city || "").trim().toLowerCase()] || String(city || "").trim();
const minimumFare = (json) => {
  try {
    const values = Object.values(JSON.parse(json || "{}")).filter((value) => Number.isFinite(Number(value))).map(Number);
    return values.length ? Math.min(...values) : null;
  } catch { return null; }
};
const localDay = (date) => new Date(`${date}T00:00:00.000Z`);
const dayCode = (date) => ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][new Date(`${date}T00:00:00.000Z`).getUTCDay()];

function datasetEdges(records, startDate, dayCount = 3) {
  const edges = [];
  for (let offset = 0; offset < dayCount; offset += 1) {
    const day = new Date(`${startDate}T00:00:00.000Z`);
    day.setUTCDate(day.getUTCDate() + offset);
    const date = day.toISOString().slice(0, 10);
    const weekday = dayCode(date);
    for (const record of records) {
      const days = JSON.parse(record.runningDaysJson || "[]");
      if (days.length && !days.includes(weekday)) continue;
      const [hour, minute] = record.departureTime.split(":").map(Number);
      if (!Number.isInteger(hour) || !Number.isInteger(minute)) continue;
      const departureTime = new Date(`${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00.000Z`);
      const arrivalTime = new Date(departureTime.getTime() + record.durationMinutes * 60000);
      const fare = Number(record.estimatedFareINR);
      if (!Number.isFinite(fare)) continue;
      let rawRecord = {};
      try { rawRecord = JSON.parse(record.recordJson || "{}"); } catch {}
      const routeName = record.mode === "train"
        ? displayText(rawRecord.trainName || record.serviceName)
        : record.mode === "bus"
          ? `${record.sourceCity} → ${record.destinationCity} Bus`
          : `Flight ${displayText(rawRecord.flightNumber || record.serviceNumber)}`;
      edges.push({
        route: {
          routeName, routeNumber: displayText(record.serviceNumber),
          totalDistanceKm: record.distanceKm || 0, dataStatus: "DEMO",
          dataSource: "Supplied synthetic sample dataset", lastUpdatedAt: null,
        },
        mode: record.mode, from: canonicalCity(record.sourceCity), to: canonicalCity(record.destinationCity),
        departureTime, arrivalTime, durationMinutes: record.durationMinutes, fare,
        schedule: { id: `${record.id}:${date}` },
      });
    }
  }
  return edges;
}

function toLeg(edge, index, date, transferMinutes) {
  const departure = edge.departureTime;
  const arrival = edge.arrivalTime;
  return {
    index: index + 1,
    mode: edge.mode,
    modeLabel: modeNames[edge.mode] || edge.mode,
    modeIcon: edge.mode,
    from: edge.from,
    to: edge.to,
    serviceName: displayText(edge.route.routeName),
    serviceReference: displayText(edge.route.routeNumber),
    departureTime: departure.toISOString(),
    arrivalTime: arrival.toISOString(),
    durationMinutes: edge.durationMinutes,
    distanceKm: edge.route.totalDistanceKm || null,
    estimatedFare: edge.fare,
    dataStatus: edge.route.dataStatus || "DEMO",
    dataSource: edge.route.dataSource || "Sample dataset",
    lastUpdatedAt: edge.route.lastUpdatedAt,
    transferMinutes,
    bookingSearchUrl: `/search?${new URLSearchParams({ from: edge.from, to: edge.to, mode: edge.mode, date: departure.toISOString().slice(0, 10) })}`,
  };
}

function materialize(path, date, id, label) {
  const segments = path.map((edge, index) => {
    const next = path[index + 1];
    const wait = next ? Math.max(0, Math.round((next.departureTime - edge.arrivalTime) / 60000)) : null;
    return toLeg(edge, index, date, wait);
  });
  const start = path[0].departureTime;
  const end = path[path.length - 1].arrivalTime;
  return {
    id,
    via: path.length > 1 ? path.slice(0, -1).map((edge) => edge.to).join(" → ") : "Direct",
    segments,
    totalFare: path.reduce((sum, edge) => sum + edge.fare, 0),
    totalDistanceKm: path.reduce((sum, edge) => sum + (edge.route.totalDistanceKm || 0), 0),
    totalDurationMinutes: Math.max(0, Math.round((end - start) / 60000)),
    departureTime: start.toISOString(),
    arrivalTime: end.toISOString(),
    labels: [label],
    estimateOnly: path.some((edge) => edge.route.dataStatus !== "VERIFIED"),
    dataStatus: path.every((edge) => edge.route.dataStatus === "VERIFIED") ? "VERIFIED" : "DEMO",
  };
}

function dijkstraRoute(edges, from, to, objective = "fastest", requireTransfer = false) {
  const byOrigin = new Map();
  for (const edge of edges) {
    const key = edge.from.toLowerCase();
    if (!byOrigin.has(key)) byOrigin.set(key, []);
    byOrigin.get(key).push(edge);
  }
  const heap = [];
  const score = (state) => {
    const elapsed = Math.max(0, (state.arrivalTime - state.firstDeparture) / 60000);
    const transfers = state.path.length - 1;
    if (objective === "cheapest") return state.fare * 100000 + elapsed;
    if (objective === "fewest") return transfers * 100000000 + elapsed;
    if (objective === "balanced") return elapsed + state.fare * 0.25 + transfers * 75;
    return elapsed;
  };
  const push = (state) => {
    state.score = score(state);
    heap.push(state);
    let index = heap.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (heap[parent].score <= heap[index].score) break;
      [heap[parent], heap[index]] = [heap[index], heap[parent]];
      index = parent;
    }
  };
  const pop = () => {
    const first = heap[0];
    const tail = heap.pop();
    if (heap.length) {
      heap[0] = tail;
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        let smallest = index;
        if (left < heap.length && heap[left].score < heap[smallest].score) smallest = left;
        if (right < heap.length && heap[right].score < heap[smallest].score) smallest = right;
        if (smallest === index) break;
        [heap[index], heap[smallest]] = [heap[smallest], heap[index]];
        index = smallest;
      }
    }
    return first;
  };

  for (const edge of byOrigin.get(from.toLowerCase()) || []) push({ city: edge.to, arrivalTime: edge.arrivalTime, firstDeparture: edge.departureTime, fare: edge.fare, path: [edge], visited: new Set([from.toLowerCase(), edge.to.toLowerCase()]) });
  while (heap.length) {
    const current = pop();
    if (current.city.toLowerCase() === to.toLowerCase() && (!requireTransfer || current.path.length > 1)) return current.path;
    if (current.path.length >= MAX_LEGS) continue;
    for (const edge of byOrigin.get(current.city.toLowerCase()) || []) {
      if (current.visited.has(edge.to.toLowerCase())) continue;
      const last = current.path.at(-1);
      const minChange = last.mode === edge.mode ? 35 : TRANSFER_MINUTES;
      if (edge.departureTime - current.arrivalTime < minChange * 60000) continue;
      push({
        city: edge.to,
        arrivalTime: edge.arrivalTime,
        firstDeparture: current.firstDeparture,
        fare: current.fare + edge.fare,
        path: [...current.path, edge],
        visited: new Set([...current.visited, edge.to.toLowerCase()]),
      });
    }
  }
  return null;
}

exports.dijkstraRoute = dijkstraRoute;

exports.plan = async ({ from, to, date }) => {
  const originQuery = String(from || "").trim();
  const destinationQuery = String(to || "").trim();
  const travelDate = date || new Date().toISOString().slice(0, 10);
  if (!originQuery || !destinationQuery) return { supported: false, plans: [], message: "Choose an origin and destination." };
  if (canonicalCity(originQuery).toLowerCase() === canonicalCity(destinationQuery).toLowerCase()) return { supported: false, plans: [], message: "Choose two different cities." };

  const startDay = localDay(travelDate);
  const finalDay = new Date(startDay.getTime() + 2 * 86400000).toISOString().slice(0, 10);
  const [stations, busStops, schedules, datasetRecords] = await Promise.all([
    prisma.station.findMany({ where: { OR: [{ city: { contains: originQuery } }, { name: { contains: originQuery } }, { code: { contains: originQuery.toUpperCase() } }] } }),
    prisma.busStop.findMany({ where: { OR: [{ city: { contains: originQuery } }, { name: { contains: originQuery } }, { code: { contains: originQuery.toUpperCase() } }] } }),
    prisma.schedule.findMany({
      where: { travelDate: { gte: travelDate, lte: finalDay }, status: { not: "CANCELLED" } },
      include: { route: { include: { originStation: true, destStation: true, originBusStop: true, destBusStop: true } } },
      take: 5000,
    }),
    prisma.transportDatasetRecord.findMany({ where: { mode: { in: ["train", "bus", "flight"] }, dataStatus: "DEMO" } }),
  ]);

  const originCities = [...new Set([...stations.map((item) => item.city), ...busStops.map((item) => item.city), ...datasetRecords.flatMap((item) => [item.sourceCity, item.destinationCity])])];
  const matchingOrigins = originCities.filter((city) => city.toLowerCase() === originQuery.toLowerCase());
  const sourceCity = canonicalCity(matchingOrigins[0] || originCities.find((city) => city.toLowerCase().includes(originQuery.toLowerCase())));
  if (!sourceCity) return { supported: false, plans: [], message: "This origin is not present in the saved station or terminal dataset. Search and select a listed location." };

  // Resolve the destination against the same stored transport locations.
  const [destinationStations, destinationStops, destinationRecords] = await Promise.all([
    prisma.station.findMany({ where: { OR: [{ city: { contains: destinationQuery } }, { name: { contains: destinationQuery } }, { code: { contains: destinationQuery.toUpperCase() } }] } }),
    prisma.busStop.findMany({ where: { OR: [{ city: { contains: destinationQuery } }, { name: { contains: destinationQuery } }, { code: { contains: destinationQuery.toUpperCase() } }] } }),
    prisma.transportDatasetRecord.findMany({ where: { OR: [
      { sourceCity: { contains: destinationQuery } }, { destinationCity: { contains: destinationQuery } },
      { sourceName: { contains: destinationQuery } }, { destinationName: { contains: destinationQuery } },
    ] }, select: { sourceCity: true, destinationCity: true } }),
  ]);
  const destinationCities = [...new Set([...destinationStations.map((item) => item.city), ...destinationStops.map((item) => item.city), ...destinationRecords.flatMap((item) => [item.sourceCity, item.destinationCity])])];
  const destinationCity = canonicalCity(destinationCities.find((city) => city.toLowerCase() === destinationQuery.toLowerCase()) || destinationCities.find((city) => city.toLowerCase().includes(destinationQuery.toLowerCase())));
  if (!destinationCity) return { supported: false, plans: [], message: "This destination is not present in the saved station or terminal dataset. Search and select a listed location." };

  const edges = schedules.map((schedule) => {
    const route = schedule.route;
    const isTrain = route.mode === "train";
    const origin = isTrain ? route.originStation : route.originBusStop;
    const destination = isTrain ? route.destStation : route.destBusStop;
    const fare = minimumFare(schedule.pricingTiersJson);
    if (!origin || !destination || fare == null) return null;
    return {
      route,
      mode: route.mode,
      from: canonicalCity(origin.city),
      to: canonicalCity(destination.city),
      departureTime: schedule.departureTime,
      arrivalTime: schedule.arrivalTime,
      durationMinutes: Math.max(1, Math.round((schedule.arrivalTime - schedule.departureTime) / 60000)),
      fare,
      schedule,
    };
  }).filter(Boolean).filter((edge) => edge.departureTime >= startDay);
  edges.push(...datasetEdges(datasetRecords, travelDate));

  const options = [
    [dijkstraRoute(edges, sourceCity, destinationCity, "fastest"), "Fastest in available dataset"],
    [dijkstraRoute(edges, sourceCity, destinationCity, "cheapest"), "Lowest listed sample fare"],
    [dijkstraRoute(edges, sourceCity, destinationCity, "fewest"), "Fewest transfers"],
    [dijkstraRoute(edges, sourceCity, destinationCity, "balanced"), "Balanced available option"],
    [dijkstraRoute(edges, sourceCity, destinationCity, "fastest", true), "Connected multimodal option"],
  ];
  if (!options.some(([path]) => path)) return {
    supported: false,
    plans: [],
    message: `No connected services for ${sourceCity} → ${destinationCity} were found in the saved schedules for this date. Add an authorized data feed or sample timetable records for these places.`,
  };

  const candidates = new Map();
  const add = (path, label) => {
    if (!path) return;
    const key = path.map((edge) => edge.schedule.id).join("|");
    const existing = candidates.get(key);
    if (existing) existing.labels.push(label);
    else candidates.set(key, { path, labels: [label] });
  };
  options.forEach(([path, label]) => add(path, label));
  const plans = [...candidates.values()].map((item, index) => {
    const plan = materialize(item.path, travelDate, `plan-${index + 1}`, item.labels[0]);
    plan.labels = item.labels;
    return plan;
  });
  const via = [...new Set(plans.flatMap((plan) => plan.segments.slice(0, -1).map((leg) => leg.to)))];
  return {
    supported: true,
    hub: via.join(", ") || "Direct",
    plans,
    disclaimer: "Plans combine stored schedules with the supplied synthetic dataset. Sample entries are not live operator schedules, prices, seat availability, or reservations. Transfer minimums are planning assumptions.",
    travelDate,
  };
};
