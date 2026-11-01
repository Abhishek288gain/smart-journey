const crypto = require("crypto");
const prisma = require("../config/prisma");

const codeFor = (value) => `D${crypto.createHash("sha1").update(value.toLowerCase()).digest("hex").slice(0, 6).toUpperCase()}`;
const modeOptions = {
  flight: [
    { suffix: "01", name: "Sample Flight Estimate 01", number: "SAMPLE-FLT-01", duration: 145, fare: 4250, classes: { ECONOMY: 4250 }, amenities: ["Illustrative estimate only"] },
    { suffix: "02", name: "Sample Flight Estimate 02", number: "SAMPLE-FLT-02", duration: 165, fare: 4890, classes: { ECONOMY: 4890 }, amenities: ["Illustrative estimate only"] },
  ],
  cab: [
    { suffix: "SDN", name: "Sample Sedan Estimate", number: "SAMPLE-CAB-SEDAN", duration: 600, fare: 1850, classes: { SEDAN: 1850 }, amenities: ["Illustrative estimate only"] },
    { suffix: "SUV", name: "Sample SUV Estimate", number: "SAMPLE-CAB-SUV", duration: 570, fare: 2650, classes: { SUV: 2650 }, amenities: ["Illustrative estimate only"] },
  ],
};

class OtherTransportProvider {
  async search({ origin, destination, travelDate, mode }) {
    const originCode = codeFor(origin);
    const destCode = codeFor(destination);
    const from = await prisma.station.upsert({ where: { code: originCode }, update: {}, create: {
      code: originCode, name: `${origin} ${mode === "flight" ? "Airport" : "Pickup"}`, city: origin, state: "Sample", totalPlatforms: 1,
    } });
    const to = await prisma.station.upsert({ where: { code: destCode }, update: {}, create: {
      code: destCode, name: `${destination} ${mode === "flight" ? "Airport" : "Drop-off"}`, city: destination, state: "Sample", totalPlatforms: 1,
    } });
    const results = [];
    for (const option of modeOptions[mode] || []) {
      let route = await prisma.route.findFirst({ where: { mode, routeNumber: option.number, originStationCode: from.code, destStationCode: to.code } });
      if (!route) route = await prisma.route.create({ data: {
        mode, routeNumber: option.number, routeName: option.name, operator: mode === "flight" ? option.name : "Smart Journey Sample Fleet",
        originStationCode: from.code, destStationCode: to.code,
        totalDistanceKm: mode === "flight" ? 900 : 450,
        estimatedDurationMins: option.duration,
        intermediateStopsJson: "[]", amenitiesJson: JSON.stringify(option.amenities),
        dataSource: "SMART_JOURNEY_DEMO_ESTIMATE", dataStatus: "DEMO", lastUpdatedAt: new Date(),
      } });
      let schedule = await prisma.schedule.findFirst({ where: { routeId: route.id, travelDate } });
      if (!schedule) {
        const depart = new Date(`${travelDate}T08:00:00.000Z`);
        schedule = await prisma.schedule.create({ data: {
          routeId: route.id, travelDate, departureTime: depart,
          arrivalTime: new Date(depart.getTime() + option.duration * 60000),
          status: "DEMO_ESTIMATE",
          seatInventoryJson: JSON.stringify({ available: 32 }),
          pricingTiersJson: JSON.stringify(option.classes),
        } });
      }
      const classes = Object.entries(option.classes).map(([code, fare]) => ({
        code, name: mode === "flight" ? (code === "ECONOMY" ? "Economy" : "Business") : code,
        fare, status: "AVAILABLE 32", availableCount: 32,
      }));
      results.push({
        id: schedule.id, scheduleId: schedule.id, type: mode, name: option.name, numberOrCode: option.number,
        source: "Sample estimate · no operator feed", dataStatus: "DEMO",
        operator: route.operator, origin: { code: from.code, name: from.name, city: origin, departureTime: schedule.departureTime.toISOString() },
        destination: { code: to.code, name: to.name, city: destination, arrivalTime: schedule.arrivalTime.toISOString() },
        durationMinutes: option.duration, durationFormatted: `${Math.floor(option.duration / 60)}h ${option.duration % 60}m`,
        totalDistanceKm: route.totalDistanceKm, classes, minFare: Math.min(...classes.map((item) => item.fare)),
        amenities: option.amenities, totalAvailableSeats: 32, status: "ON_TIME", source: "Sample provider",
      });
    }
    return results;
  }
}

module.exports = new OtherTransportProvider();
