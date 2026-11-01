const prisma = require("../config/prisma");
const displayText = (value) => String(value || "").replace(/demo/gi, "").replace(/\s+/g, " ").replace(/^[-\s]+|[-\s]+$/g, "").trim();

class BusDataProvider {
  constructor(mode = "mock") {
    this.mode = mode; // "mock" | "aggregator"
  }

  async searchBuses({ origin, destination, travelDate, filters = {} }) {
    // Search database for bus routes
    const originStops = await prisma.busStop.findMany({
      where: {
        OR: [
          { code: { contains: origin.toUpperCase() } },
          { city: { contains: origin } },
          { name: { contains: origin } },
        ],
      },
    });

    const destStops = await prisma.busStop.findMany({
      where: {
        OR: [
          { code: { contains: destination.toUpperCase() } },
          { city: { contains: destination } },
          { name: { contains: destination } },
        ],
      },
    });

    const originCodes = originStops.map((s) => s.code);
    const destCodes = destStops.map((s) => s.code);

    // Query routes matching any origin/dest stop in those cities
    const routes = await prisma.route.findMany({
      where: {
        mode: "bus",
        OR: [
          {
            originBusStopCode: { in: originCodes.length > 0 ? originCodes : [origin.toUpperCase()] },
            destBusStopCode: { in: destCodes.length > 0 ? destCodes : [destination.toUpperCase()] },
          },
          {
            originBusStop: { city: { contains: origin } },
            destBusStop: { city: { contains: destination } },
          },
        ],
      },
      include: {
        originBusStop: true,
        destBusStop: true,
        schedules: {
          where: travelDate ? { travelDate } : undefined,
          take: 3,
        },
      },
    });

    const results = [];
    for (const route of routes) {
      const schedule = route.schedules[0] || null;
      if (travelDate && !schedule) continue;
      let seatInventory = { totalAvailable: 24 };
      let pricingTiers = {};

      if (schedule) {
        try {
          seatInventory = JSON.parse(schedule.seatInventoryJson);
          pricingTiers = JSON.parse(schedule.pricingTiersJson);
        } catch (e) {}
      }

      const amenities = JSON.parse(route.amenitiesJson || "[]");
      const intermediateStops = JSON.parse(route.intermediateStopsJson || "[]");

      const boardingPoints = intermediateStops.filter((s, i) => i < 2).map((s) => ({
        id: `bp_${s.code}`,
        name: s.name,
        time: s.time,
        landmark: s.landmark,
      }));

      const droppingPoints = intermediateStops.filter((s, i) => i >= 2).map((s) => ({
        id: `dp_${s.code}`,
        name: s.name,
        time: s.time,
        landmark: s.landmark,
      }));

      const minPrice = pricingTiers.SLEEPER_LOWER_DOUBLE || pricingTiers.SEATER || null;

      results.push({
        id: schedule ? schedule.id : `mock_${route.id}`,
        routeId: route.id,
        type: "bus",
        source: route.dataStatus === "VERIFIED" ? route.dataSource : "Sample transport dataset",
        dataStatus: route.dataStatus || "DEMO",
        numberOrCode: displayText(route.routeNumber),
        name: displayText(route.routeName),
        operator: route.dataStatus === "VERIFIED" ? displayText(route.operator || "Intercity Bus Express") : "Bus operator not verified",
        rating: 4.8,
        ratingCount: 312,
        busLayoutType: route.busLayoutType || "2+1",
        hasUpperDeck: route.busLayoutType === "2+1",
        origin: {
          code: displayText(route.originBusStopCode),
          name: displayText(route.originBusStop ? route.originBusStop.name : route.originBusStopCode),
          city: route.originBusStop ? route.originBusStop.city : origin,
          departureTime: schedule ? schedule.departureTime.toISOString() : "06:00 PM",
        },
        destination: {
          code: displayText(route.destBusStopCode),
          name: displayText(route.destBusStop ? route.destBusStop.name : route.destBusStopCode),
          city: route.destBusStop ? route.destBusStop.city : destination,
          arrivalTime: schedule ? schedule.arrivalTime.toISOString() : "08:30 AM",
        },
        durationMinutes: route.estimatedDurationMins,
        durationFormatted: `${Math.floor(route.estimatedDurationMins / 60)}h ${route.estimatedDurationMins % 60}m`,
        totalDistanceKm: route.totalDistanceKm,
        totalAvailableSeats: schedule?.status === "DEMO_ESTIMATE" ? null : seatInventory.totalAvailable || null,
        minFare: minPrice,
        amenities,
        boardingPoints,
        droppingPoints,
        intermediateStops,
        lastUpdatedAt: route.lastUpdatedAt,
        bookingUrl: route.bookingUrl,
        cancellationPolicy: [
          { timeFrame: "Before 24h", deduction: "10%" },
          { timeFrame: "12h to 24h", deduction: "25%" },
          { timeFrame: "4h to 12h", deduction: "50%" },
          { timeFrame: "Under 4h", deduction: "No Refund" },
        ],
      });
    }

    return results;
  }

  async getSeatMap(scheduleId) {
    const schedule = await prisma.schedule.findUnique({
      where: { id: scheduleId },
      include: {
        route: {
          include: {
            originBusStop: true,
            destBusStop: true,
          },
        },
      },
    });

    if (!schedule) {
      // Fallback generator for interactive seat map
      return this.generateMockSeatMap("2+1");
    }

    try {
      const inventory = JSON.parse(schedule.seatInventoryJson);
      const intermediateStops = JSON.parse(schedule.route.intermediateStopsJson || "[]");

      return {
        scheduleId: schedule.id,
        busNumber: schedule.route.routeNumber,
        busName: schedule.route.routeName,
        operator: schedule.route.operator,
        layoutType: schedule.route.busLayoutType || "2+1",
        hasUpperDeck: schedule.route.busLayoutType === "2+1",
        decks: {
          lower: inventory.lowerDeck || [],
          upper: inventory.upperDeck || [],
        },
        boardingPoints: intermediateStops.filter((s, i) => i < 2),
        droppingPoints: intermediateStops.filter((s, i) => i >= 2),
        lastUpdated: new Date().toISOString(),
      };
    } catch (e) {
      return this.generateMockSeatMap(schedule.route.busLayoutType || "2+1");
    }
  }

  generateMockSeatMap(layout = "2+1") {
    const lower = [];
    const upper = [];

    for (let r = 1; r <= 5; r++) {
      lower.push({ seatNo: `L${r}A`, type: "SLEEPER", price: 1350, status: "AVAILABLE", gender: "ANY" });
      lower.push({ seatNo: `L${r}B`, type: "SLEEPER", price: 1350, status: r === 2 ? "BOOKED" : "AVAILABLE", gender: r === 2 ? "FEMALE" : "ANY" });
      lower.push({ seatNo: `L${r}C`, type: "SLEEPER", price: 1450, status: "AVAILABLE", gender: "ANY" });

      upper.push({ seatNo: `U${r}A`, type: "SLEEPER", price: 1400, status: "AVAILABLE", gender: "ANY" });
      upper.push({ seatNo: `U${r}B`, type: "SLEEPER", price: 1400, status: "AVAILABLE", gender: "ANY" });
      upper.push({ seatNo: `U${r}C`, type: "SLEEPER", price: 1550, status: "AVAILABLE", gender: "ANY" });
    }

    return {
      layoutType: layout,
      hasUpperDeck: true,
      decks: { lower, upper },
    };
  }

  async getLiveBusTracking(busId) {
    // Dynamic GPS simulator along the highway
    const now = Date.now();
    // Simulate slight movement along NH44 / Mumbai-Nagpur highway
    const baseLat = 21.1458;
    const baseLng = 79.0882;
    const offset = (Math.sin(now / 10000) * 0.02).toFixed(5);

    return {
      busId,
      status: "RUNNING",
      speedKmH: Math.floor(70 + Math.random() * 15),
      heading: "South-West",
      coordinates: {
        latitude: parseFloat(baseLat) + parseFloat(offset),
        longitude: parseFloat(baseLng) + parseFloat(offset),
      },
      currentLandmark: "Nagpur Bypass Express Tollway",
      nextStop: {
        name: "Amravati Midway Food Plaza",
        eta: "11:45 PM",
        distanceKm: 42,
      },
      driverContact: {
        name: "Rajeshwar Singh",
        phone: "+91 98220 11984",
      },
      lastUpdated: new Date().toISOString(),
    };
  }
}

const busDataProvider = new BusDataProvider(process.env.BUS_DATA_PROVIDER || "mock");
module.exports = busDataProvider;
