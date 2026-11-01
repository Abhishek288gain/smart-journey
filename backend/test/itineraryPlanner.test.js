const test = require("node:test");
const assert = require("node:assert/strict");
const { dijkstraRoute } = require("../src/services/itineraryPlanner");

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
