const test = require("node:test");
const assert = require("node:assert/strict");
const { enrichSegment } = require("../src/services/routeGeometry");

const fromCoordinates = { latitude: 28.6, longitude: 77.2, name: "Delhi Airport" };
const toCoordinates = { latitude: 30.2, longitude: 78.2, name: "Dehradun Airport" };
const base = { from: "Delhi", to: "Dehradun", fromCoordinates, toCoordinates, dataStatus: "DEMO" };

test("flight segment gets a curved geodesic and is labeled approximate", async () => {
  const result = await enrichSegment({ ...base, transportMode: "flight" });
  assert.equal(result.geometryStatus, "APPROXIMATE");
  assert.equal(result.routeGeometry.type, "LineString");
  assert.ok(result.routeGeometry.coordinates.length > 2);
});

test("flight with airport codes gets mapped airport pins and a great-circle line", async () => {
  const result = await enrichSegment({
    from: "New Delhi", to: "Jaipur", fromCity: "New Delhi", toCity: "Jaipur",
    fromCoordinates: null, toCoordinates: null, fromCoordinatesAccuracy: "UNAVAILABLE", toCoordinatesAccuracy: "UNAVAILABLE",
    fromLocationCode: "DEL", toLocationCode: "JAI", fromLocationName: "Indira Gandhi International Airport", toLocationName: "Jaipur International Airport",
    transportMode: "flight", serviceName: "Test flight", serviceReference: "TEST", dataStatus: "LIVE",
  });
  assert.deepEqual([result.fromCoordinates.latitude, result.fromCoordinates.longitude], [28.55563, 77.09519]);
  assert.deepEqual([result.toCoordinates.latitude, result.toCoordinates.longitude], [26.8242, 75.8122]);
  assert.equal(result.fromCoordinatesAccuracy, "AIRPORT_DATASET");
  assert.equal(result.toCoordinatesAccuracy, "AIRPORT_DATASET");
  assert.equal(result.routeGeometry.type, "LineString");
  assert.match(result.dataSource, /OurAirports reference coordinates/);
});

test("bus segment uses returned road geometry and keeps it approximate", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: true, json: async () => ({ routes: [{ geometry: { type: "LineString", coordinates: [[77.2, 28.6], [78.2, 30.2]] } }] }) });
  try {
    const result = await enrichSegment({ ...base, fromCoordinates: { latitude: 11.1, longitude: 71.1 }, toCoordinates: { latitude: 11.8, longitude: 71.8 }, transportMode: "bus" });
    assert.equal(result.geometryStatus, "APPROXIMATE");
    assert.equal(result.routeGeometry.coordinates.length, 2);
    assert.match(result.dataSource, /OSRM/);
  } finally { global.fetch = originalFetch; }
});

test("routing service failures omit the bus line and return a clear fallback", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: false, json: async () => ({ code: "NoRoute" }) });
  try {
    const result = await enrichSegment({ ...base, fromCoordinates: { latitude: 10.1, longitude: 70.1 }, toCoordinates: { latitude: 10.8, longitude: 70.8 }, transportMode: "bus" });
    assert.equal(result.routeGeometry, null);
    assert.equal(result.geometryStatus, "UNAVAILABLE");
    assert.match(result.geometryMessage, /No straight-line road route is drawn/);
  } finally { global.fetch = originalFetch; }
});

test("missing coordinates do not generate a route line", async () => {
  const result = await enrichSegment({ ...base, transportMode: "train", fromCoordinates: null, serviceReference: null, serviceName: null });
  assert.equal(result.routeGeometry, null);
  assert.equal(result.geometryStatus, "UNAVAILABLE");
});

test("train segment uses a matching railway relation and never substitutes a straight line", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: true, json: async () => ({ elements: [{ members: [{ type: "way", geometry: [{ lat: 28.6, lon: 77.2 }, { lat: 29.1, lon: 77.5 }, { lat: 30.2, lon: 78.2 }] }] }] }) });
  try {
    const result = await enrichSegment({ ...base, transportMode: "train", serviceReference: "T123", serviceName: "Test Express" });
    assert.equal(result.routeGeometry.type, "MultiLineString");
    assert.equal(result.geometryStatus, "VERIFIED");
    assert.match(result.dataSource, /OpenStreetMap railway/);
  } finally { global.fetch = originalFetch; }
});

test("train falls back to an explicitly approximate path on mapped rail tracks", async () => {
  const originalFetch = global.fetch;
  let requestCount = 0;
  global.fetch = async () => {
    requestCount += 1;
    if (requestCount === 1) return { ok: true, json: async () => ({ elements: [] }) };
    return { ok: true, json: async () => ({ elements: [{ type: "way", geometry: [
      { lat: 28.6, lon: 77.2 }, { lat: 29.2, lon: 77.5 }, { lat: 29.7, lon: 77.8 }, { lat: 30.2, lon: 78.2 },
    ] }] }) };
  };
  try {
    const result = await enrichSegment({ ...base, transportMode: "train", serviceReference: "DEMO123", serviceName: "Demo Train" });
    assert.equal(result.geometryStatus, "APPROXIMATE");
    assert.equal(result.routeGeometry.type, "LineString");
    assert.match(result.dataSource, /railway network/);
    assert.match(result.geometryMessage, /not railway track/);
  } finally { global.fetch = originalFetch; }
});

test("city-area train pins produce a visible connector clearly marked as non-track", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: true, json: async () => ({ elements: [] }) });
  try {
    const result = await enrichSegment({ ...base, transportMode: "train", serviceReference: "DEMO5", serviceName: "Demo Express", dataStatus: "DEMO", fromCoordinatesAccuracy: "SAVED_LOCATION", toCoordinatesAccuracy: "CITY_APPROXIMATE" });
    assert.equal(result.geometryStatus, "APPROXIMATE");
    assert.equal(result.routeGeometry.type, "LineString");
    assert.match(result.geometryMessage, /not railway track/);
    assert.match(result.geometryMessage, /city area/);
  } finally { global.fetch = originalFetch; }
});

test("mixed journey keeps independent bus and flight geometry and labels fallback rail connector as approximate", async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url) => String(url).includes("router.project-osrm.org")
    ? ({ ok: true, json: async () => ({ routes: [{ geometry: { type: "LineString", coordinates: [[77.2, 28.6], [78.2, 30.2]] } }] }) })
    : ({ ok: true, json: async () => ({ elements: [] }) });
  try {
    const [bus, flight, train] = await Promise.all([
      enrichSegment({ ...base, transportMode: "bus" }),
      enrichSegment({ ...base, transportMode: "flight" }),
      enrichSegment({ ...base, fromCoordinates: { latitude: 8.1, longitude: 60.1 }, toCoordinates: { latitude: 8.8, longitude: 60.8 }, transportMode: "train", serviceReference: "MISSING" }),
    ]);
    assert.ok(bus.routeGeometry);
    assert.equal(flight.geometryStatus, "APPROXIMATE");
    assert.equal(train.routeGeometry.type, "LineString");
    assert.equal(train.geometryStatus, "APPROXIMATE");
    assert.match(train.geometryMessage, /not railway track/);
  } finally { global.fetch = originalFetch; }
});
