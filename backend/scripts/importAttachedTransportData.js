require("dotenv").config();
const fs = require("node:fs");
const path = require("node:path");
const prisma = require("../src/config/prisma");

const dataDir = path.join(__dirname, "../data/transport-demo");
const DAILY = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const readArray = (filename) => {
  const value = JSON.parse(fs.readFileSync(path.join(dataDir, filename), "utf8"));
  if (!Array.isArray(value)) throw new Error(`${filename} must contain a JSON array`);
  return value;
};
const json = (value) => JSON.stringify(value ?? []);

function mapRecord(record, mode) {
  if (!record?._id || record.isDemo !== true || record.verified !== false || record.recordType !== "DEMO") {
    throw new Error(`Refusing to import a non-demo or malformed ${mode} record: ${record?._id || "missing _id"}`);
  }
  const source = record.source || {};
  const destination = record.destination || {};
  const serviceNumber = record.trainNumber || record.serviceId || record.flightNumber;
  const serviceName = record.trainName || record.operatorName || `${record.airline || "Flight"} ${record.flightNumber || ""}`.trim();
  const modeDays = record.runningDays || record.operatingDays || DAILY;
  const durationMinutes = Number(record.durationMinutes);
  if (!serviceNumber || !serviceName || !source.city || !destination.city || !durationMinutes) {
    throw new Error(`Required route fields missing in ${record._id}`);
  }

  return {
    id: record._id,
    mode,
    serviceNumber: String(serviceNumber),
    serviceName: String(serviceName),
    operator: record.operatorName || record.airline || "Demo service",
    sourceCity: String(source.city),
    sourceName: String(source.stationName || source.terminalName || source.airportName || source.city),
    sourceCode: source.stationCode || source.terminalCode || source.airportCode || null,
    sourceState: source.state || null,
    destinationCity: String(destination.city),
    destinationName: String(destination.stationName || destination.terminalName || destination.airportName || destination.city),
    destinationCode: destination.stationCode || destination.terminalCode || destination.airportCode || null,
    destinationState: destination.state || null,
    departureTime: String(record.departureTime),
    arrivalTime: String(record.arrivalTime),
    arrivalDayOffset: Number(record.arrivalDayOffset) || 0,
    durationMinutes,
    estimatedFareINR: Number.isFinite(Number(record.estimatedFareINR)) ? Number(record.estimatedFareINR) : null,
    distanceKm: Number.isFinite(Number(record.distanceKm)) ? Number(record.distanceKm) : null,
    runningDaysJson: json(modeDays),
    stopsJson: json(record.stops),
    classesJson: json(record.classes || record.cabinClasses),
    amenitiesJson: json(record.amenities),
    recordJson: JSON.stringify(record),
    dataStatus: "DEMO",
    bookingSupported: record.booking?.supported === true,
  };
}

async function main() {
  const files = [
    ["trains.json", "train"],
    ["buses.json", "bus"],
    ["flights.json", "flight"],
  ];
  let imported = 0;
  for (const [filename, mode] of files) {
    const records = readArray(filename).map((record) => mapRecord(record, mode));
    for (const record of records) {
      await prisma.transportDatasetRecord.upsert({
        where: { id: record.id },
        create: record,
        update: record,
      });
    }
    imported += records.length;
    console.log(`${mode}: ${records.length} demo records imported from ${filename}`);
  }
  const counts = await prisma.transportDatasetRecord.groupBy({ by: ["mode"], _count: { _all: true } });
  console.log(`Import complete (${imported} rows processed; existing route, booking and account tables were left intact).`);
  for (const row of counts) console.log(`${row.mode}: ${row._count._all} records`);
}

main().catch((error) => {
  console.error(`Transport dataset import failed: ${error.message}`);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
