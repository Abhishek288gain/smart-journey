require("dotenv").config();
const prisma = require("../src/config/prisma");

const SAMPLE_CITIES = [
  ["Gwalior", "Madhya Pradesh", 26.2183, 78.1828], ["New Delhi", "Delhi", 28.6139, 77.209],
  ["Agra", "Uttar Pradesh", 27.1767, 78.0081], ["Rishikesh", "Uttarakhand", 30.0869, 78.2676],
  ["Haridwar", "Uttarakhand", 29.9457, 78.1642], ["Dehradun", "Uttarakhand", 30.3165, 78.0322],
  ["Jaipur", "Rajasthan", 26.9124, 75.7873], ["Lucknow", "Uttar Pradesh", 26.8467, 80.9462],
  ["Kanpur", "Uttar Pradesh", 26.4499, 80.3319], ["Varanasi", "Uttar Pradesh", 25.3176, 82.9739],
  ["Prayagraj", "Uttar Pradesh", 25.4358, 81.8463], ["Ahmedabad", "Gujarat", 23.0225, 72.5714],
  ["Surat", "Gujarat", 21.1702, 72.8311], ["Mumbai", "Maharashtra", 19.076, 72.8777],
  ["Pune", "Maharashtra", 18.5204, 73.8567], ["Nagpur", "Maharashtra", 21.1458, 79.0882],
  ["Bhopal", "Madhya Pradesh", 23.2599, 77.4126], ["Indore", "Madhya Pradesh", 22.7196, 75.8577],
  ["Jabalpur", "Madhya Pradesh", 23.1815, 79.9864], ["Bengaluru", "Karnataka", 12.9716, 77.5946],
  ["Hyderabad", "Telangana", 17.385, 78.4867], ["Chennai", "Tamil Nadu", 13.0827, 80.2707],
  ["Kolkata", "West Bengal", 22.5726, 88.3639], ["Chandigarh", "Chandigarh", 30.7333, 76.7794],
  ["Amritsar", "Punjab", 31.634, 74.8723], ["Jodhpur", "Rajasthan", 26.2389, 73.0243],
  ["Udaipur", "Rajasthan", 24.5854, 73.7125], ["Patna", "Bihar", 25.5941, 85.1376],
  ["Ranchi", "Jharkhand", 23.3441, 85.3096], ["Raipur", "Chhattisgarh", 21.2514, 81.6296],
  ["Goa", "Goa", 15.2993, 74.124], ["Kochi", "Kerala", 9.9312, 76.2673],
  ["Thiruvananthapuram", "Kerala", 8.5241, 76.9366], ["Mysuru", "Karnataka", 12.2958, 76.6394],
  ["Ajmer", "Rajasthan", 26.4499, 74.6399], ["Nashik", "Maharashtra", 19.9975, 73.7898],
];

const slug = (name) => name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);

async function ensureSampleLocations() {
  for (const [city, state, latitude, longitude] of SAMPLE_CITIES) {
    const code = `DEMO-${slug(city)}`;
    await prisma.station.upsert({ where: { code }, update: { city, state, latitude, longitude }, create: {
      code, name: `${city} Demo Rail Node`, city, state, latitude, longitude, totalPlatforms: 0,
    } });
    const busCode = `${code}-BUS`;
    const existingStop = await prisma.busStop.findFirst({ where: { code: busCode } });
    const stopData = { code: busCode, name: `${city} Demo Bus Terminal`, city, latitude, longitude, landmark: "Sample terminal · not operator-verified" };
    if (existingStop) await prisma.busStop.update({ where: { id: existingStop.id }, data: stopData });
    else await prisma.busStop.create({ data: stopData });
  }
}

function routeKm(a, b, detour) {
  const radians = (value) => value * Math.PI / 180;
  const dLat = radians((b.latitude || 0) - (a.latitude || 0));
  const dLon = radians((b.longitude || 0) - (a.longitude || 0));
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.latitude || 0)) * Math.cos(radians(b.latitude || 0)) * Math.sin(dLon / 2) ** 2;
  return Math.max(70, Math.round(6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)) * detour));
}

function datesForNextWeek() {
  const dates = [];
  const today = new Date();
  for (let day = 0; day < 7; day += 1) {
    const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + day));
    dates.push(date.toISOString().slice(0, 10));
  }
  return dates;
}

async function upsertService({ mode, number, name, source, destination, dateList, duration, fare, distance, busLayoutType }) {
  const isTrain = mode === "train";
  const data = {
    mode,
    routeNumber: number,
    routeName: name,
    operator: "Smart Journey sample dataset",
    originStationCode: isTrain ? source.code : null,
    destStationCode: isTrain ? destination.code : null,
    originBusStopCode: isTrain ? null : source.code,
    destBusStopCode: isTrain ? null : destination.code,
    totalDistanceKm: distance,
    estimatedDurationMins: duration,
    intermediateStopsJson: "[]",
    amenitiesJson: JSON.stringify(["Sample data · no operator confirmation"]),
    busLayoutType: busLayoutType || null,
    dataSource: "SMART_JOURNEY_GENERATED_SAMPLE",
    dataStatus: "DEMO",
    lastUpdatedAt: new Date(),
    runningDaysJson: JSON.stringify(["Daily · sample schedule"]),
    bookingUrl: null,
  };
  const existingRoute = await prisma.route.findFirst({ where: { mode, routeNumber: number } });
  const route = existingRoute
    ? await prisma.route.update({ where: { id: existingRoute.id }, data })
    : await prisma.route.create({ data });

  for (const [index, travelDate] of dateList.entries()) {
    const hour = isTrain
      ? (number === "DEMO-TR-0001" ? 6 + index % 2 : 5 + ((Number(number.slice(-4)) + index * 3) % 17))
      : (number === "DEMO-BUS-0001" ? 17 + index % 2 : 16 + ((Number(number.slice(-4)) + index * 2) % 8));
    const minute = (Number(number.slice(-4)) * 7 + index * 11) % 60;
    const departureTime = new Date(`${travelDate}T${String(hour % 24).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00.000Z`);
    const arrivalTime = new Date(departureTime.getTime() + duration * 60000);
    const existing = await prisma.schedule.findFirst({ where: { routeId: route.id, travelDate } });
    const scheduleData = {
      routeId: route.id,
      travelDate,
      departureTime,
      arrivalTime,
      status: "DEMO_ESTIMATE",
      delayMinutes: 0,
      currentLocation: "Sample schedule · not live",
      seatInventoryJson: JSON.stringify({ sample: true, availability: "NOT_PROVIDED" }),
      pricingTiersJson: JSON.stringify(isTrain ? { SL: fare, "3A": Math.round(fare * 1.6), "2A": Math.round(fare * 2.3) } : { SEATER: fare, SLEEPER_LOWER_DOUBLE: Math.round(fare * 1.25) }),
    };
    if (existing) await prisma.schedule.update({ where: { id: existing.id }, data: scheduleData });
    else await prisma.schedule.create({ data: scheduleData });
  }
}

async function main() {
  await ensureSampleLocations();
  const [stations, busStops] = await Promise.all([
    prisma.station.findMany({ orderBy: { code: "asc" } }),
    prisma.busStop.findMany({ orderBy: { code: "asc" } }),
  ]);
  if (stations.length < 2 || busStops.length < 2) throw new Error("Run the base Prisma seed first so station and terminal locations exist.");
  const dateList = datesForNextWeek();

  for (let i = 0; i < 500; i += 1) {
    const source = i === 0 ? stations.find((station) => station.code === "DEMO-GWALIOR") : stations[i % stations.length];
    let destination = i === 0 ? stations.find((station) => station.code === "DEMO-NEWDELHI") : stations[(i * 7 + Math.floor(i / stations.length) + 1) % stations.length];
    if (destination.code === source.code) destination = stations[(stations.indexOf(source) + 1) % stations.length];
    const km = routeKm(source, destination, 1.16);
    const fare = Math.round(260 + km * 1.15);
    await upsertService({ mode: "train", number: `DEMO-TR-${String(i + 1).padStart(4, "0")}`, name: `DEMO Train Service ${String(i + 1).padStart(4, "0")}`, source, destination, dateList, duration: Math.round(km / 58 * 60 + 45), fare, distance: km });
  }

  for (let i = 0; i < 200; i += 1) {
    const source = i === 0 ? busStops.find((stop) => stop.code === "DEMO-NEWDELHI-BUS") : busStops[i % busStops.length];
    let destination = i === 0 ? busStops.find((stop) => stop.city === "Rishikesh" && stop.code.endsWith("-BUS")) : busStops[(i * 5 + Math.floor(i / busStops.length) + 1) % busStops.length];
    if (destination.code === source.code) destination = busStops[(busStops.indexOf(source) + 1) % busStops.length];
    const km = routeKm(source, destination, 1.25);
    const fare = Math.round(350 + km * 1.7);
    await upsertService({ mode: "bus", number: `DEMO-BUS-${String(i + 1).padStart(4, "0")}`, name: `DEMO Intercity Bus ${String(i + 1).padStart(4, "0")}`, source, destination, dateList, duration: Math.round(km / 52 * 60 + 30), fare, distance: km, busLayoutType: "Sample layout" });
  }

  const counts = await prisma.route.groupBy({ by: ["mode", "dataStatus"], _count: { _all: true } });
  console.log("Transport catalog totals (demo records are not live or operator-verified):");
  for (const row of counts) console.log(`${row.mode}/${row.dataStatus}: ${row._count._all}`);
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(async () => { await prisma.$disconnect(); });
