const prisma = require("../config/prisma");
const displayText = (value) => String(value || "").replace(/demo/gi, "").replace(/\s+/g, " ").replace(/^[-\s]+|[-\s]+$/g, "").trim();

class TrainDataProvider {
  constructor(mode = "mock") {
    this.mode = mode; // "mock" | "rapidapi"
  }

  async searchTrains({ origin, destination, travelDate }) {
    // Search database for train routes between origin and destination
    // Supports matching by station code or city name
    const originStation = await prisma.station.findFirst({
      where: {
        OR: [
          { code: origin.toUpperCase() },
          { city: { contains: origin } },
          { name: { contains: origin } },
        ],
      },
    });

    const destStation = await prisma.station.findFirst({
      where: {
        OR: [
          { code: destination.toUpperCase() },
          { city: { contains: destination } },
          { name: { contains: destination } },
        ],
      },
    });

    const originCode = originStation ? originStation.code : origin.toUpperCase();
    const destCode = destStation ? destStation.code : destination.toUpperCase();

    // Find routes
    const routes = await prisma.route.findMany({
      where: {
        mode: "train",
        originStationCode: originCode,
        destStationCode: destCode,
      },
      include: {
        originStation: true,
        destStation: true,
        schedules: {
          where: travelDate ? { travelDate } : undefined,
          take: 3,
        },
      },
    });

    // Format into unified response
    const results = [];
    for (const route of routes) {
      const schedule = route.schedules[0] || null;
      if (travelDate && !schedule) continue;
      let seatInventory = {};
      let pricingTiers = {};

      if (schedule) {
        try {
          seatInventory = JSON.parse(schedule.seatInventoryJson);
          pricingTiers = JSON.parse(schedule.pricingTiersJson);
        } catch (e) {}
      }

      const classes = [
        {
          code: "3A",
          name: "AC 3 Tier",
          fare: pricingTiers["3A"] || 1080,
          status: schedule?.status === "DEMO_ESTIMATE" ? "Sample estimate · availability not supplied" : seatInventory["3A"] ? `${seatInventory["3A"].status} ${seatInventory["3A"].available}` : "Availability not supplied",
          availableCount: schedule?.status === "DEMO_ESTIMATE" ? null : seatInventory["3A"]?.available ?? null,
        },
        {
          code: "2A",
          name: "AC 2 Tier",
          fare: pricingTiers["2A"] || 1560,
          status: schedule?.status === "DEMO_ESTIMATE" ? "Sample estimate · availability not supplied" : seatInventory["2A"] ? `${seatInventory["2A"].status} ${seatInventory["2A"].available}` : "Availability not supplied",
          availableCount: schedule?.status === "DEMO_ESTIMATE" ? null : seatInventory["2A"]?.available ?? null,
        },
        {
          code: "SL",
          name: "Sleeper Class",
          fare: pricingTiers["SL"] || 420,
          status: schedule?.status === "DEMO_ESTIMATE" ? "Sample estimate · availability not supplied" : seatInventory["SL"] ? `${seatInventory["SL"].status} ${seatInventory["SL"].available}` : "Availability not supplied",
          availableCount: schedule?.status === "DEMO_ESTIMATE" ? null : seatInventory["SL"]?.available ?? null,
        },
      ];

      results.push({
        id: schedule ? schedule.id : `mock_${route.id}`,
        routeId: route.id,
        type: "train",
        source: route.dataStatus === "VERIFIED" ? route.dataSource : "Sample transport dataset",
        dataStatus: route.dataStatus || "DEMO",
        numberOrCode: displayText(route.routeNumber),
        trackingReference: route.routeNumber,
        name: displayText(route.routeName),
        operator: route.dataStatus === "VERIFIED" ? displayText(route.operator || "Indian Railways") : "Rail operator not verified",
        origin: {
          code: displayText(route.originStationCode),
          name: displayText(route.originStation ? route.originStation.name : originCode),
          city: route.originStation ? route.originStation.city : origin,
          departureTime: schedule ? schedule.departureTime.toISOString() : "06:30 AM",
          platform: "Platform 2",
        },
        destination: {
          code: displayText(route.destStationCode),
          name: displayText(route.destStation ? route.destStation.name : destCode),
          city: route.destStation ? route.destStation.city : destination,
          arrivalTime: schedule ? schedule.arrivalTime.toISOString() : "02:45 PM",
          platform: "Platform 4",
        },
        durationMinutes: route.estimatedDurationMins,
        durationFormatted: `${Math.floor(route.estimatedDurationMins / 60)}h ${route.estimatedDurationMins % 60}m`,
        totalDistanceKm: route.totalDistanceKm,
        classes,
        minFare: Math.min(...classes.map((c) => c.fare)),
        amenities: JSON.parse(route.amenitiesJson || "[]"),
        intermediateStops: JSON.parse(route.intermediateStopsJson || "[]"),
        lastUpdatedAt: route.lastUpdatedAt,
        bookingUrl: route.bookingUrl,
        status: schedule ? schedule.status : "ON_TIME",
        delayMinutes: schedule ? schedule.delayMinutes : 0,
      });
    }

    return results;
  }

  async getLiveRunningStatus(trainNo) {
    // The configured catalog contains schedule data only; it is not a live running-status feed.
    const route = await prisma.route.findFirst({
      where: { routeNumber: trainNo, mode: "train" },
      include: { originStation: true, destStation: true },
    });

    if (!route) throw new Error("Live status is unavailable: this service is not in the stored sample catalogue or a connected live provider.");
    const storedStops = JSON.parse(route.intermediateStopsJson || "[]");
    const stops = storedStops.length ? storedStops : [
      { code: route.originStationCode, name: route.originStation?.name || route.originStationCode, arrTime: "Origin" },
      { code: route.destStationCode, name: route.destStation?.name || route.destStationCode, arrTime: "Destination" },
    ];
    const timeline = stops.map((stop, index) => ({
        stationCode: stop.code,
        stationName: stop.name,
        scheduledArrival: stop.arrTime,
        scheduledDeparture: stop.depTime,
        platform: stop.platform || `${index + 1}`,
        status: "SCHEDULED",
      }));

    return {
      trainNumber: trainNo,
      trainName: route.routeName,
      liveState: "UNAVAILABLE",
      isLive: false,
      delayMinutes: null,
      currentStation: null,
      timeline,
      lastUpdatedAt: new Date().toISOString(),
      source: `${route.dataStatus || "DEMO"} catalogue schedule · no live railway feed connected`,
    };
  }

  async checkPnrStatus(pnrNumber) {
    const normalizedPnr = String(pnrNumber || "").trim().toUpperCase();
    if (!/^(?:\d{10}|SJ\d{8})$/.test(normalizedPnr)) {
      throw new Error("Enter a valid 10-digit railway PNR or Smart Journey PNR (SJ + 8 digits).");
    }

    // Check if we have an active booking with this PNR
    const booking = await prisma.booking.findFirst({
      where: { bookingPnr: normalizedPnr },
      include: {
        passengers: true,
        schedule: {
          include: {
            route: true,
          },
        },
      },
    });

    if (booking) {
      return {
        bookingReference: normalizedPnr,
        source: "Smart Journey internal booking record",
        mode: booking.transportMode,
        serviceReference: booking.schedule.route.routeNumber,
        serviceName: booking.schedule.route.routeName,
        dateOfJourney: booking.schedule.travelDate,
        from: booking.originName,
        to: booking.destinationName,
        chartStatus: booking.status,
        passengers: booking.passengers.map((p, i) => ({
          passengerNo: i + 1,
          name: p.fullName,
          bookingStatus: booking.status,
          currentStatus: booking.status,
          coach: p.coachOrDeck || "B4",
          berth: p.seatOrBerthNumber || `${28 + i}`,
          classType: p.classType,
        })),
        lastUpdated: new Date().toISOString(),
      };
    }

    return {
      bookingReference: normalizedPnr,
      status: "NOT_FOUND",
      chartStatus: "NOT_FOUND",
      message: /^\d{10}$/.test(normalizedPnr)
        ? "No railway PNR provider is connected; this number could not be verified."
        : "No Smart Journey booking matches this reference.",
      source: "No external railway PNR API configured",
      passengers: [],
      lastUpdated: new Date().toISOString(),
    };
  }
}

const trainDataProvider = new TrainDataProvider(process.env.TRAIN_DATA_PROVIDER || "mock");
module.exports = trainDataProvider;
