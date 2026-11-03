const prisma = require("../config/prisma");
const { enrichSegment, toPoint } = require("./routeGeometry");
const { airportPoint } = require("../data/airportCoordinates");
const serpApiFlightsProvider = require("../providers/SerpApiFlightsProvider");

const MAX_LEGS = 3;
const TRANSFER_MINUTES = 75;
const modeNames = { train: "Train", bus: "Intercity bus", flight: "Flight", cab: "Cab" };
const displayText = (value) => String(value || "").replace(/demo/gi, "").replace(/\s+/g, " ").replace(/^[-\s]+|[-\s]+$/g, "").trim();
const CITY_ALIASES = { delhi: "New Delhi", bangalore: "Bengaluru", bengaluru: "Bengaluru", bombay: "Mumbai", calcutta: "Kolkata", madras: "Chennai" };
const canonicalCity = (city) => CITY_ALIASES[String(city || "").trim().toLowerCase()] || String(city || "").trim();
const airportDistanceKm = (from, to) => {
  if (!from || !to) return null;
  const radians = (value) => Number(value) * Math.PI / 180;
  const dLat = radians(to.latitude - from.latitude), dLon = radians(to.longitude - from.longitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(dLon / 2) ** 2;
  return Math.round(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};
const minimumFare = (json) => {
  try {
    const values = Object.values(JSON.parse(json || "{}")).filter((value) => Number.isFinite(Number(value))).map(Number);
    return values.length ? Math.min(...values) : null;
  } catch { return null; }
};
const localDay = (date) => new Date(`${date}T00:00:00.000Z`);
const dayCode = (date) => ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][new Date(`${date}T00:00:00.000Z`).getUTCDay()];

function datasetEdges(records, startDate, dayCount = 3, stations = [], busStops = []) {
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
      const stops = (() => {
        try {
          const parsed = JSON.parse(record.stopsJson || "[]");
          if (Array.isArray(parsed)) return parsed.filter((stop) => typeof stop === "string" || (stop && typeof stop === "object"));
          if (Array.isArray(parsed?.stops)) return parsed.stops.filter((stop) => typeof stop === "string" || (stop && typeof stop === "object"));
          if (Array.isArray(parsed?.intermediateStops)) return parsed.intermediateStops.filter((stop) => typeof stop === "string" || (stop && typeof stop === "object"));
          return [];
        } catch { return []; }
      })();
      const getCoords = (place) => {
        const nested = place.coordinates && !Array.isArray(place.coordinates) ? place.coordinates : {};
        return { latitude: place.latitude ?? place.lat ?? nested.latitude ?? nested.lat, longitude: place.longitude ?? place.lng ?? place.lon ?? nested.longitude ?? nested.lng ?? nested.lon };
      };
      const placeByCode = (code) => [...stations, ...busStops].find((place) => code && place.code?.toUpperCase() === code.toUpperCase());
      const sourcePlace = placeByCode(record.sourceCode);
      const destinationPlace = placeByCode(record.destinationCode);
      const sourceCoords = getCoords(rawRecord.source || {}), destinationCoords = getCoords(rawRecord.destination || {});
      const hasPoint = (place, raw) => Number.isFinite(Number(raw.latitude ?? place?.latitude)) && Number.isFinite(Number(raw.longitude ?? place?.longitude));
      const cityReference = (city) => {
        const places = record.mode === "train" ? stations : record.mode === "bus" ? busStops : [];
        const expectedName = record.mode === "train" ? "demo rail node" : "demo bus terminal";
        return places.find((place) => place.code?.startsWith("DEMO-") && place.name?.toLowerCase().includes(expectedName) && canonicalCity(place.city).toLowerCase() === canonicalCity(city).toLowerCase() && hasPoint(place, {}));
      };
      const sourceFallback = (record.mode === "train" || record.mode === "bus") && !hasPoint(sourcePlace, sourceCoords) ? cityReference(record.sourceCity) : null;
      const destinationFallback = (record.mode === "train" || record.mode === "bus") && !hasPoint(destinationPlace, destinationCoords) ? cityReference(record.destinationCity) : null;
      edges.push({
        route: {
          routeName, routeNumber: displayText(record.serviceNumber),
          totalDistanceKm: record.distanceKm || 0, dataStatus: "DEMO",
          dataSource: "Supplied synthetic sample dataset", lastUpdatedAt: null,
        },
        mode: record.mode, from: canonicalCity(record.sourceCity), to: canonicalCity(record.destinationCity),
        originLocation: sourceFallback
          ? { name: `${sourceFallback.city} city area (${record.mode} stop pin unavailable)`, latitude: sourceFallback.latitude, longitude: sourceFallback.longitude, coordinateAccuracy: "CITY_APPROXIMATE" }
          : { name: sourcePlace?.name || record.sourceName, code: sourcePlace?.code || record.sourceCode, latitude: sourceCoords.latitude ?? sourcePlace?.latitude, longitude: sourceCoords.longitude ?? sourcePlace?.longitude, coordinateAccuracy: "SAVED_LOCATION" },
        destinationLocation: destinationFallback
          ? { name: `${destinationFallback.city} city area (${record.mode} stop pin unavailable)`, latitude: destinationFallback.latitude, longitude: destinationFallback.longitude, coordinateAccuracy: "CITY_APPROXIMATE" }
          : { name: destinationPlace?.name || record.destinationName, code: destinationPlace?.code || record.destinationCode, latitude: destinationCoords.latitude ?? destinationPlace?.latitude, longitude: destinationCoords.longitude ?? destinationPlace?.longitude, coordinateAccuracy: "SAVED_LOCATION" },
        intermediateStops: stops.map((stop) => {
          const item = typeof stop === "string" ? { name: stop } : stop;
          const place = placeByCode(item.stationCode || item.code);
          const latitude = item.latitude ?? item.lat ?? item.coordinates?.latitude ?? place?.latitude;
          const longitude = item.longitude ?? item.lon ?? item.lng ?? item.coordinates?.longitude ?? place?.longitude;
          return { ...item, name: item.name || item.stationName || item.station || item.city || place?.name, code: item.stationCode || item.code || place?.code, coordinates: Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude)) ? toPoint(latitude, longitude, item.name || item.stationName || item.station || item.city || place?.name, item.stationCode || item.code || place?.code) : null };
        }),
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
  const mappedLocation = (location, city, mode) => {
    if (location?.latitude == null || location?.longitude == null) return { point: null, accuracy: "UNAVAILABLE" };
    const isGeneratedCityNode = /demo (rail node|bus terminal)/i.test(String(location.name || ""));
    const accuracy = location.coordinateAccuracy || (isGeneratedCityNode ? "CITY_APPROXIMATE" : "SAVED_LOCATION");
    const pinName = accuracy === "CITY_APPROXIMATE" ? `${city} city area (${mode} stop pin unavailable)` : location.name;
    const pinCode = accuracy === "CITY_APPROXIMATE" ? null : location.code;
    return { point: toPoint(location.latitude, location.longitude, pinName, pinCode), accuracy };
  };
  const sourcePin = mappedLocation(edge.originLocation, edge.from, edge.mode);
  const destinationPin = mappedLocation(edge.destinationLocation, edge.to, edge.mode);
  return {
    index: index + 1,
    segmentOrder: index + 1,
    serviceNumber: displayText(edge.route.routeNumber),
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
    transportMode: edge.mode,
    fromCoordinates: sourcePin.point,
    toCoordinates: destinationPin.point,
    fromLocationName: sourcePin.point?.name || edge.originLocation?.name || edge.from,
    toLocationName: destinationPin.point?.name || edge.destinationLocation?.name || edge.to,
    fromLocationCode: edge.originLocation?.code || null,
    toLocationCode: edge.destinationLocation?.code || null,
    fromCoordinatesAccuracy: sourcePin.accuracy,
    toCoordinatesAccuracy: destinationPin.accuracy,
    fromCity: edge.from,
    toCity: edge.to,
    intermediateStops: edge.intermediateStops || [],
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
    tripId: id,
    recordType: path.every((edge) => edge.route.dataStatus === "VERIFIED") ? "VERIFIED" : path.some((edge) => edge.route.dataStatus === "LIVE") ? "LIVE" : "DEMO",
    origin: path[0].from,
    destination: path[path.length - 1].to,
    via: path.length > 1 ? path.slice(0, -1).map((edge) => edge.to).join(" → ") : "Direct",
    segments,
    totalFare: path.reduce((sum, edge) => sum + edge.fare, 0),
    totalDistanceKm: path.reduce((sum, edge) => sum + (edge.route.totalDistanceKm || 0), 0),
    totalDurationMinutes: Math.max(0, Math.round((end - start) / 60000)),
    departureTime: start.toISOString(),
    arrivalTime: end.toISOString(),
    labels: [label],
    estimateOnly: path.some((edge) => edge.route.dataStatus !== "VERIFIED"),
    dataStatus: path.every((edge) => edge.route.dataStatus === "VERIFIED") ? "VERIFIED" : path.some((edge) => edge.route.dataStatus === "LIVE") ? "LIVE" : "DEMO",
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
exports.datasetEdges = datasetEdges;

exports.plan = async ({ from, to, date }) => {
  const originQuery = String(from || "").trim();
  const destinationQuery = String(to || "").trim();
  const travelDate = date || new Date().toISOString().slice(0, 10);
  if (!originQuery || !destinationQuery) return { supported: false, plans: [], message: "Choose an origin and destination." };
  if (canonicalCity(originQuery).toLowerCase() === canonicalCity(destinationQuery).toLowerCase()) return { supported: false, plans: [], message: "Choose two different cities." };

  const startDay = localDay(travelDate);
  const finalDay = new Date(startDay.getTime() + 2 * 86400000).toISOString().slice(0, 10);
  const [stations, busStops, schedules, datasetRecords, allStations, allBusStops] = await Promise.all([
    prisma.station.findMany({ where: { OR: [{ city: { contains: originQuery } }, { name: { contains: originQuery } }, { code: { contains: originQuery.toUpperCase() } }] } }),
    prisma.busStop.findMany({ where: { OR: [{ city: { contains: originQuery } }, { name: { contains: originQuery } }, { code: { contains: originQuery.toUpperCase() } }] } }),
    prisma.schedule.findMany({
      where: { travelDate: { gte: travelDate, lte: finalDay }, status: { not: "CANCELLED" } },
      include: { route: { include: { originStation: true, destStation: true, originBusStop: true, destBusStop: true } } },
      take: 5000,
    }),
    prisma.transportDatasetRecord.findMany({ where: { mode: { in: ["train", "bus", "flight"] }, dataStatus: "DEMO" } }),
    prisma.station.findMany(),
    prisma.busStop.findMany(),
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
      originLocation: origin,
      destinationLocation: destination,
      intermediateStops: (() => {
        try {
          const parsedStops = JSON.parse(route.intermediateStopsJson || "[]");
          const candidateStops = Array.isArray(parsedStops) ? parsedStops : Array.isArray(parsedStops?.stops) ? parsedStops.stops : Array.isArray(parsedStops?.intermediateStops) ? parsedStops.intermediateStops : [];
          const stops = candidateStops.filter((stop) => typeof stop === "string" || (stop && typeof stop === "object"));
          return stops.map((stop) => {
            const place = [...allStations, ...allBusStops].find((item) => (stop.code && item.code === stop.code) || item.name?.toLowerCase() === String(stop.name || "").toLowerCase());
            return place ? { ...stop, coordinates: place.latitude != null && place.longitude != null ? toPoint(place.latitude, place.longitude, place.name, place.code) : null } : { ...stop, coordinates: null };
          });
        } catch { return []; }
      })(),
      from: canonicalCity(origin.city),
      to: canonicalCity(destination.city),
      departureTime: schedule.departureTime,
      arrivalTime: schedule.arrivalTime,
      durationMinutes: Math.max(1, Math.round((schedule.arrivalTime - schedule.departureTime) / 60000)),
      fare,
      schedule,
    };
  }).filter(Boolean).filter((edge) => edge.departureTime >= startDay);
  edges.push(...datasetEdges(datasetRecords, travelDate, 3, allStations, allBusStops));

  // The regular search service already queries SerpApi, but this planner used
  // only stored timetable rows. Add live direct flights as separate options.
  let directFlights = [];
  let flightNotice = serpApiFlightsProvider.configured
    ? null
    : "Live flights require SERPAPI_API_KEY in backend/.env. Imported flight schedules are included when available.";
  if (serpApiFlightsProvider.configured) {
    try {
      const flightData = await serpApiFlightsProvider.search({ origin: sourceCity, destination: destinationCity, travelDate });
      flightNotice = flightData.notice || null;
      const savedAirportPoint = (airport) => {
        const code = String(airport?.code || "").toUpperCase();
        const saved = allStations.find((station) => code && station.code?.toUpperCase() === code && /airport|aerodrome/i.test(station.name || ""));
        return saved?.latitude != null && saved?.longitude != null
          ? { ...toPoint(saved.latitude, saved.longitude, airport?.name || saved.name, code), coordinateSource: "Saved airport coordinates" }
          : airportPoint(code);
      };
      directFlights = flightData.results.map((flight, index) => {
        const departureTime = new Date(flight.origin?.departureTime || "");
        const arrivalTime = new Date(flight.destination?.arrivalTime || "");
        const fare = Number(flight.minFare);
        if (!Number.isFinite(departureTime.getTime()) || !Number.isFinite(arrivalTime.getTime()) || arrivalTime <= departureTime || !Number.isFinite(fare)) return null;
        const serviceNumber = flight.numberOrCode || `LIVE-${index + 1}`;
        const originAirport = savedAirportPoint(flight.origin);
        const destinationAirport = savedAirportPoint(flight.destination);
        return {
          route: {
            routeName: flight.name || `Flight ${serviceNumber}`,
            routeNumber: serviceNumber,
            totalDistanceKm: flight.totalDistanceKm || airportDistanceKm(originAirport, destinationAirport) || 0,
            dataStatus: "LIVE",
            dataSource: flight.dataSource || "Google Flights search results via SerpApi",
            lastUpdatedAt: flight.lastUpdatedAt || null,
          },
          mode: "flight", from: sourceCity, to: destinationCity,
          originLocation: { ...(originAirport || {}), name: flight.origin?.name || `${sourceCity} Airport`, code: flight.origin?.code || null },
          destinationLocation: { ...(destinationAirport || {}), name: flight.destination?.name || `${destinationCity} Airport`, code: flight.destination?.code || null },
          intermediateStops: (flight.intermediateStops || []).map((stop) => {
            const point = savedAirportPoint(stop) || allStations.find((station) => station.name?.toLowerCase() === String(stop.name || "").toLowerCase() && station.latitude != null && station.longitude != null);
            return { ...stop, coordinates: point || null };
          }),
          departureTime, arrivalTime,
          durationMinutes: Number(flight.durationMinutes) || Math.round((arrivalTime - departureTime) / 60000),
          fare,
          schedule: { id: flight.id || `serpapi:${travelDate}:${serviceNumber}:${index}` },
        };
      }).filter(Boolean).filter((edge) => edge.departureTime >= startDay && edge.departureTime < new Date(startDay.getTime() + 3 * 86400000));
    } catch (error) {
      console.warn("End-to-end live flight search unavailable:", error.message);
      flightNotice = `Live flight search unavailable: ${error.message}`;
    }
  }

  const options = [
    [dijkstraRoute(edges, sourceCity, destinationCity, "fastest"), "Fastest in available dataset"],
    [dijkstraRoute(edges, sourceCity, destinationCity, "cheapest"), "Lowest listed sample fare"],
    [dijkstraRoute(edges, sourceCity, destinationCity, "fewest"), "Fewest transfers"],
    [dijkstraRoute(edges, sourceCity, destinationCity, "balanced"), "Balanced available option"],
    [dijkstraRoute(edges, sourceCity, destinationCity, "fastest", true), "Connected multimodal option"],
  ];
  directFlights.slice(0, 3).forEach((flight, index) => options.push([[flight], `Live flight option ${index + 1} · SerpApi`]));
  if (!options.some(([path]) => path)) return {
    supported: false,
    plans: [],
    message: `No connected services for ${sourceCity} → ${destinationCity} were found in the saved schedules for this date. Add an authorized data feed or sample timetable records for these places.`,
    flightNotice,
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
  const plans = await Promise.all([...candidates.values()].map(async (item, index) => {
    const plan = materialize(item.path, travelDate, `plan-${index + 1}`, item.labels[0]);
    plan.labels = item.labels;
    plan.segments = await Promise.all(plan.segments.map(enrichSegment));
    return plan;
  }));
  const via = [...new Set(plans.flatMap((plan) => plan.segments.slice(0, -1).map((leg) => leg.to)))];
  return {
    supported: true,
    hub: via.join(", ") || "Direct",
    plans,
    flightNotice,
    disclaimer: "Plans may combine saved schedules, supplied sample data, and SerpApi Google Flights results. Sample entries are illustrative, not live inventory. Confirm current flight price and availability before purchase. Transfer times are planning assumptions.",
    travelDate,
  };
};
