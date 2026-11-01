const prisma = require("../config/prisma");
const displayText = (value) => String(value || "").replace(/demo/gi, "").replace(/\s+/g, " ").replace(/^[-\s]+|[-\s]+$/g, "").trim();

const normalize = (value) => {
  const key = String(value || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");
  const aliases = { delhi: "newdelhi", bombay: "mumbai", bengaluru: "bangalore", calcutta: "kolkata", madras: "chennai" };
  return aliases[key] || key;
};
const parseJson = (value, fallback = []) => { try { return JSON.parse(value || ""); } catch { return fallback; } };
const matchesPlace = (query, city, name, code) => {
  const key = normalize(query);
  return Boolean(key) && [city, name, code].some((value) => normalize(value) === key);
};
const parseTime = (value) => {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour <= 23 && minute <= 59 ? { hour, minute } : null;
};
const weekdayCode = (date) => ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][new Date(`${date}T00:00:00.000Z`).getUTCDay()];

class TransportDatasetProvider {
  async search({ mode, origin, destination, travelDate }) {
    if (!mode || !origin || !destination) return [];
    const rows = await prisma.transportDatasetRecord.findMany({ where: { mode, dataStatus: "DEMO" } });
    const dayCode = weekdayCode(travelDate);
    const results = [];
    for (const row of rows) {
      const sourceMatches = matchesPlace(origin, row.sourceCity, row.sourceName, row.sourceCode);
      const destinationMatches = matchesPlace(destination, row.destinationCity, row.destinationName, row.destinationCode);
      if (!sourceMatches || !destinationMatches) continue;
      const runningDays = parseJson(row.runningDaysJson, []);
      if (runningDays.length && !runningDays.includes(dayCode)) continue;
      const departure = parseTime(row.departureTime);
      if (!departure) continue;
      const departureAt = new Date(`${travelDate}T${String(departure.hour).padStart(2, "0")}:${String(departure.minute).padStart(2, "0")}:00.000Z`);
      const arrivalAt = new Date(departureAt.getTime() + row.durationMinutes * 60000);
      const source = row.mode === "flight" ? "airport" : row.mode === "train" ? "station" : "terminal";
      const stops = parseJson(row.stopsJson, []);
      const amenities = parseJson(row.amenitiesJson, []);
      const classes = parseJson(row.classesJson, []);
      const original = parseJson(row.recordJson, {});
      const status = row.mode === "train" ? "Sample schedule · running status not supplied" : "Sample schedule";
      const displayName = row.mode === "train"
        ? displayText(original.trainName || row.serviceName) || `Train ${displayText(row.serviceNumber)}`
        : row.mode === "bus"
          ? `${row.sourceCity} → ${row.destinationCity} Bus`
          : `Flight ${displayText(original.flightNumber || row.serviceNumber)}`;

      results.push({
        id: `dataset-${row.id}-${travelDate}`,
        routeId: null,
        scheduleId: null,
        type: row.mode,
        source: "Attached sample dataset",
        dataSource: "Supplied sample data · not operator-verified",
        dataStatus: "DEMO",
        bookingSupported: false,
        numberOrCode: displayText(row.serviceNumber),
        name: displayName,
        operator: row.mode === "train" ? "Rail operator not verified" : row.mode === "bus" ? "Bus operator not verified" : "Airline not verified",
        origin: {
          code: row.sourceCode,
          name: displayText(row.sourceName),
          city: row.sourceCity,
          departureTime: departureAt.toISOString(),
          [source === "station" ? "platform" : source === "airport" ? "terminal" : "terminal"]: null,
        },
        destination: {
          code: row.destinationCode,
          name: displayText(row.destinationName),
          city: row.destinationCity,
          arrivalTime: arrivalAt.toISOString(),
        },
        durationMinutes: row.durationMinutes,
        durationFormatted: `${Math.floor(row.durationMinutes / 60)}h ${row.durationMinutes % 60}m`,
        totalDistanceKm: row.distanceKm,
        classes: [],
        classCodes: classes,
        busLayoutType: mode === "bus" ? original.busType || null : null,
        minFare: row.estimatedFareINR,
        amenities,
        intermediateStops: stops,
        totalAvailableSeats: null,
        status,
        availabilityNotice: "Seat availability and operator booking are not included in the supplied sample dataset.",
        bookingUrl: null,
        lastUpdatedAt: null,
      });
    }
    return results;
  }
}

module.exports = new TransportDatasetProvider();
