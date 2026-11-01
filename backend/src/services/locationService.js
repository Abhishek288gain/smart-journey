const prisma = require("../config/prisma");

const MAX_LIMIT = 30;
const displayText = (value) => String(value || "").replace(/demo/gi, "").replace(/\s+/g, " ").replace(/^[-\s]+|[-\s]+$/g, "").trim();

exports.search = async ({ query, limit = 20 }) => {
  const q = String(query || "").trim();
  if (q.length < 1) return [];
  const take = Math.min(MAX_LIMIT, Math.max(1, Number.parseInt(limit, 10) || 20));
  const browseIndia = ["india", "bharat"].includes(q.toLowerCase());
  const textFilter = browseIndia ? {} : { OR: [
    { code: { contains: q } }, { name: { contains: q } }, { city: { contains: q } },
  ] };
  const datasetTextFilter = browseIndia ? {} : { OR: [
    { sourceCity: { contains: q } }, { sourceName: { contains: q } }, { sourceCode: { contains: q } },
    { destinationCity: { contains: q } }, { destinationName: { contains: q } }, { destinationCode: { contains: q } },
  ] };
  const [stations, stops, ...datasetGroups] = await Promise.all([
    prisma.station.findMany({
      where: textFilter,
      orderBy: [{ city: "asc" }, { name: "asc" }],
      take,
    }),
    prisma.busStop.findMany({
      where: textFilter,
      orderBy: [{ city: "asc" }, { name: "asc" }],
      take,
    }),
    ...["train", "bus", "flight"].map((mode) => prisma.transportDatasetRecord.findMany({
      where: { mode, ...datasetTextFilter },
      take: Math.min(MAX_LIMIT * 4, take * 5),
    })),
  ]);
  const datasetRecords = datasetGroups.flat();

  const byKey = new Map();
  for (const station of stations) {
    const isAirport = /\bairport\b/i.test(station.name);
    const type = isAirport ? "airport" : "railway_station";
    const stationName = displayText(station.name);
    const stationKey = `${type}:${stationName.toLowerCase()}:${station.city.toLowerCase()}`;
    const isSample = station.code.startsWith("DEMO-") || station.state.toLowerCase() === "sample" || /^D[0-9A-F]{6}$/i.test(station.code);
    const publicCode = isAirport && !/^[a-z]{3}$/i.test(station.code) ? null : station.code.replace(/demo/gi, "SAMPLE");
    const stationState = displayText(station.state);
    if (!byKey.has(stationKey)) byKey.set(stationKey, {
      id: stationKey, name: station.city, displayName: stationName,
      state: stationState, type, code: publicCode,
      source: isSample ? "DEMO" : "DATABASE",
      detail: isAirport
        ? [stationState, "Airport", ...(isSample ? ["sample location"] : [])].filter(Boolean).join(" · ")
        : isSample ? [station.city, stationState, "Sample rail node"].filter(Boolean).join(" · ") : [station.city, stationState, "Railway station"].filter(Boolean).join(" · "),
    });
    const cityKey = `city:${station.city.toLowerCase()}`;
    if (!byKey.has(cityKey)) byKey.set(cityKey, {
      id: `city:${station.city.toLowerCase()}`, name: station.city, displayName: station.city,
      state: displayText(station.state), type: "city", code: null, source: isSample ? "DEMO" : "DATABASE",
      detail: [stationState, isSample ? "Sample city location" : "City"].filter(Boolean).join(" · "),
    });
  }
  for (const stop of stops) {
    const displayName = displayText(stop.name);
    const stopKey = `bus_terminal:${displayName.toLowerCase()}:${stop.city.toLowerCase()}`;
    const isSample = stop.code.startsWith("DEMO-") || (stop.landmark || "").toLowerCase().includes("sample");
    if (!byKey.has(stopKey)) byKey.set(stopKey, {
      id: stopKey, name: stop.city, displayName,
      state: null, type: "bus_terminal", code: stop.code.replace(/demo/gi, "SAMPLE"), source: isSample ? "DEMO" : "DATABASE",
      detail: isSample ? `${stop.city} · Sample bus terminal` : `${stop.city} · Bus terminal`,
    });
    const key = `city:${stop.city.toLowerCase()}`;
    if (!byKey.has(key)) byKey.set(key, {
      id: key, name: stop.city, displayName: stop.city,
      state: null, type: "city", code: null, source: "DATABASE", detail: "City",
    });
  }
  for (const record of datasetRecords) {
    const locationType = record.mode === "train" ? "railway_station" : record.mode === "flight" ? "airport" : "bus_terminal";
    const label = record.mode === "train" ? "Sample railway station" : record.mode === "flight" ? "Sample airport" : "Sample bus terminal";
    for (const side of ["source", "destination"]) {
      const isSource = side === "source";
      const city = isSource ? record.sourceCity : record.destinationCity;
      const displayName = displayText(isSource ? record.sourceName : record.destinationName);
      const rawCode = isSource ? record.sourceCode : record.destinationCode;
      const code = rawCode?.replace(/demo/gi, "SAMPLE");
      const state = displayText(isSource ? record.sourceState : record.destinationState);
      const key = `${locationType}:${displayName.toLowerCase()}:${city.toLowerCase()}`;
      if (!byKey.has(key) || (!byKey.get(key).code && code)) byKey.set(key, {
        id: key, name: city, displayName, state, type: locationType, code: code || null, source: "DEMO",
        detail: `${state ? `${state} · ` : ""}${label} · sample dataset`,
      });
      const cityKey = `city:${city.toLowerCase()}`;
      if (!byKey.has(cityKey)) byKey.set(cityKey, {
        id: cityKey, name: city, displayName: city, state: state || null, type: "city", code: null,
        source: "DEMO", detail: `${state ? `${state} · ` : ""}City in sample transport dataset`,
      });
    }
  }
  const normalize = (value) => String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const queryKey = normalize(q);
  const values = [...byKey.values()];
  const score = (item) => {
    if (browseIndia) return 0;
    const name = normalize(item.name);
    const display = normalize(item.displayName);
    const code = normalize(item.code);
    if (name === queryKey || display === queryKey || code === queryKey) return 0;
    if (name.startsWith(queryKey)) return 1;
    if (display.startsWith(queryKey)) return 2;
    if (code.startsWith(queryKey)) return 3;
    if (name.includes(queryKey)) return 4;
    if (display.includes(queryKey) || code.includes(queryKey)) return 5;
    return Number.POSITIVE_INFINITY;
  };
  const types = ["city", "railway_station", "airport", "bus_terminal"];
  const ranked = [];
  for (let scoreLevel = 0; scoreLevel <= (browseIndia ? 3 : 5); scoreLevel += 1) {
    const groups = types.map((type) => values
      .filter((item) => item.type === type && score(item) === scoreLevel)
      .sort((a, b) => a.displayName.localeCompare(b.displayName)));
    while (groups.some((group) => group.length)) {
      for (const group of groups) if (group.length) ranked.push(group.shift());
    }
  }
  return ranked.slice(0, take).map((item) => browseIndia ? { ...item, recommendationContext: "INDIA" } : item);
};

exports.isKnownLocation = async (query) => {
  const q = String(query || "").trim();
  if (!q || q.length > 80) return false;
  const normalized = q.toLowerCase();
  const [stations, stops, datasetRecords] = await Promise.all([
    prisma.station.findMany({ where: { OR: [{ code: { contains: q } }, { name: { contains: q } }, { city: { contains: q } }] }, take: 30 }),
    prisma.busStop.findMany({ where: { OR: [{ code: { contains: q } }, { name: { contains: q } }, { city: { contains: q } }] }, take: 30 }),
    prisma.transportDatasetRecord.findMany({ where: { OR: [
      { sourceCity: { contains: q } }, { sourceName: { contains: q } }, { sourceCode: { contains: q } },
      { destinationCity: { contains: q } }, { destinationName: { contains: q } }, { destinationCode: { contains: q } },
    ] }, take: 100 }),
  ]);
  return stations.some((item) => [item.code, item.name, item.city].some((value) => value.toLowerCase() === normalized)) ||
    stops.some((item) => [item.code, item.name, item.city].some((value) => value.toLowerCase() === normalized)) ||
    datasetRecords.some((item) => [item.sourceCity, item.sourceName, item.sourceCode, item.destinationCity, item.destinationName, item.destinationCode].some((value) => value?.toLowerCase() === normalized));
};
