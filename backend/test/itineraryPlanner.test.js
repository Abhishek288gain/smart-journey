const test = require("node:test");
const assert = require("node:assert/strict");
const { dijkstraRoute, datasetEdges } = require("../src/services/itineraryPlanner");
const { toAirportCode } = require("../src/providers/SerpApiFlightsProvider");

const at = (hour, minute = 0) => new Date(`2026-10-21T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00.000Z`);
const edge = (from, to, mode, departureHour, arrivalHour, departureMinute = 0) => ({
  from, to, mode, departureTime: at(departureHour, departureMinute), arrivalTime: at(arrivalHour), fare: 100,
});

test("builds a time-feasible multimodal path with the minimum transfer buffer", () => {
  const path = dijkstraRoute([
    edge("Gwalior", "New Delhi", "train", 8, 12),
    edge("New Delhi", "Rishikesh", "bus", 13, 18, 15),
  ], "Gwalior", "Rishikesh", "fastest");
  assert.deepEqual(path.map((leg) => leg.mode), ["train", "bus"]);
});

test("rejects a transfer connection that is shorter than the configured interchange time", () => {
  const path = dijkstraRoute([
    edge("Gwalior", "New Delhi", "train", 8, 12),
    edge("New Delhi", "Rishikesh", "bus", 13, 18),
  ], "Gwalior", "Rishikesh", "fastest");
  assert.equal(path, null);
});

test("does not return paths with repeated cities", () => {
  const path = dijkstraRoute([
    edge("A", "B", "train", 8, 9),
    edge("B", "A", "bus", 11, 12),
    edge("A", "C", "train", 13, 14),
  ], "A", "C");
  assert.deepEqual(path.map((leg) => leg.to), ["C"]);
});

test("keeps a three-mode itinerary connected in chronological transport order", () => {
  const path = dijkstraRoute([
    edge("Gwalior", "Delhi", "train", 8, 9),
    edge("Delhi", "Dehradun", "flight", 11, 12),
    edge("Dehradun", "Rishikesh", "bus", 14, 15),
  ], "Gwalior", "Rishikesh", "fastest");
  assert.deepEqual(path.map((leg) => leg.mode), ["train", "flight", "bus"]);
  assert.deepEqual(path.map((leg) => leg.to), ["Delhi", "Dehradun", "Rishikesh"]);
});

test("supports the requested train, flight, and bus transfer combinations", () => {
  const cases = [
    ["train", "train"], ["train", "flight"], ["flight", "train"], ["bus", "train"],
    ["bus", "flight", "train"],
  ];
  for (const modes of cases) {
    const edges = modes.map((mode, index) => edge(`P${index}`, `P${index + 1}`, mode, 7 + index * 4, 8 + index * 4));
    const route = dijkstraRoute(edges, "P0", `P${modes.length}`, "fastest");
    assert.deepEqual(route.map((leg) => leg.mode), modes, `expected ordered route for ${modes.join("+")}`);
  }
});

test("maps nearby towns to their closest airport for live flight planning", () => {
  assert.equal(toAirportCode("Gwalior"), "GWL");
  assert.equal(toAirportCode("Rishikesh"), "DED");
  assert.equal(toAirportCode("Haridwar"), "DED");
});

test("resolves demo transport endpoints and stops from saved station coordinates", () => {
  const [result] = datasetEdges([{
    id: "route-1", mode: "train", serviceNumber: "DEMO1", serviceName: "Demo Express", sourceCity: "Jabalpur", sourceName: "Jabalpur Demo Station", sourceCode: "JBP", destinationCity: "Mumbai", destinationName: "Mumbai Demo Station", destinationCode: "BOM", departureTime: "08:00", durationMinutes: 120, estimatedFareINR: 500, distanceKm: 400, runningDaysJson: "[]", stopsJson: JSON.stringify([{ stationCode: "BPL", stationName: "Bhopal" }]), recordJson: JSON.stringify({ trainName: "Demo Express", source: {}, destination: {} }),
  }], "2026-10-21", 1, [
    { code: "JBP", name: "Jabalpur Junction", latitude: 23.1815, longitude: 79.9864 },
    { code: "BPL", name: "Bhopal Junction", latitude: 23.2599, longitude: 77.4126 },
    { code: "BOM", name: "Mumbai CSMT", latitude: 18.9401, longitude: 72.8354 },
  ]);
  assert.deepEqual(result.originLocation, { name: "Jabalpur Junction", code: "JBP", latitude: 23.1815, longitude: 79.9864, coordinateAccuracy: "SAVED_LOCATION" });
  assert.deepEqual(result.destinationLocation, { name: "Mumbai CSMT", code: "BOM", latitude: 18.9401, longitude: 72.8354, coordinateAccuracy: "SAVED_LOCATION" });
  assert.deepEqual(result.intermediateStops[0].coordinates, { latitude: 23.2599, longitude: 77.4126, name: "Bhopal", code: "BPL" });
});

test("labels generated city coordinates as approximate instead of calling them stations", () => {
  const [result] = datasetEdges([{
    id: "route-city-fallback", mode: "train", serviceNumber: "DEMO2", serviceName: "Demo Express", sourceCity: "Gwalior", sourceName: "Gwalior Demo Station", sourceCode: "GWL-X", destinationCity: "Rishikesh", destinationName: "Rishikesh Demo Station", destinationCode: "RKSH-X", departureTime: "08:00", durationMinutes: 120, estimatedFareINR: 500, distanceKm: 400, runningDaysJson: "[]", stopsJson: "[]", recordJson: JSON.stringify({ source: {}, destination: {} }),
  }], "2026-10-21", 1, [
    { code: "DEMO-GWALIOR", name: "Gwalior Demo Rail Node", city: "Gwalior", latitude: 26.2183, longitude: 78.1828 },
    { code: "DEMO-RISHIKESH", name: "Rishikesh Demo Rail Node", city: "Rishikesh", latitude: 30.0869, longitude: 78.2676 },
  ]);
  assert.equal(result.originLocation.coordinateAccuracy, "CITY_APPROXIMATE");
  assert.match(result.originLocation.name, /city area/);
  assert.equal(result.originLocation.code, undefined);
  assert.equal(result.destinationLocation.coordinateAccuracy, "CITY_APPROXIMATE");
});
