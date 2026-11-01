const { PrismaClient } = require("../node_modules/.prisma/smart-journey-client-v3");
const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding Smart Journey Database...");

  // 1. Clean existing records (in reverse dependency order)
  await prisma.notification.deleteMany();
  await prisma.refund.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.bookingPassenger.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.savedRoute.deleteMany();
  await prisma.searchHistory.deleteMany();
  await prisma.passenger.deleteMany();
  await prisma.route.deleteMany();
  await prisma.busStop.deleteMany();
  await prisma.station.deleteMany();
  await prisma.user.deleteMany();

  // 2. Seed Demo User & Frequent Passengers
  const demoUser = await prisma.user.create({
    data: {
      phone: "+919876543210",
      email: "aryan@smartjourney.com",
      fullName: "Aryan Sharma",
      role: "user",
      passengers: {
        create: [
          {
            fullName: "Aryan Sharma",
            age: 28,
            gender: "male",
            berthPreference: "lower",
            idProofType: "AADHAAR",
            idProofNumber: "9876-5432-1098",
          },
          {
            fullName: "Pooja Sharma",
            age: 26,
            gender: "female",
            berthPreference: "middle",
            idProofType: "AADHAAR",
            idProofNumber: "4321-8765-2109",
          },
          {
            fullName: "Ramesh Sharma",
            age: 58,
            gender: "male",
            berthPreference: "lower",
            idProofType: "PAN",
            idProofNumber: "ABCPS1234F",
          },
        ],
      },
      savedRoutes: {
        create: [
          {
            transportMode: "all",
            originCode: "JBP",
            originName: "Jabalpur",
            destCode: "BOM",
            destName: "Mumbai",
          },
          {
            transportMode: "train",
            originCode: "JBP",
            originName: "Jabalpur",
            destCode: "BPL",
            destName: "Bhopal",
          },
        ],
      },
    },
  });

  console.log(`✅ Demo User created: ${demoUser.email} (ID: ${demoUser.id})`);

  // 3. Seed Railway Stations
  const stationsData = [
    { code: "JBP", name: "Jabalpur Junction", city: "Jabalpur", state: "Madhya Pradesh", latitude: 23.1815, longitude: 79.9864, totalPlatforms: 6 },
    { code: "BOM", name: "Mumbai CSMT", city: "Mumbai", state: "Maharashtra", latitude: 18.9401, longitude: 72.8354, totalPlatforms: 18 },
    { code: "BPL", name: "Bhopal Junction", city: "Bhopal", state: "Madhya Pradesh", latitude: 23.2599, longitude: 77.4126, totalPlatforms: 6 },
    { code: "NDLS", name: "New Delhi Railway Station", city: "New Delhi", state: "Delhi", latitude: 28.6429, longitude: 77.2195, totalPlatforms: 16 },
    { code: "ET", name: "Itarsi Junction", city: "Itarsi", state: "Madhya Pradesh", latitude: 22.6139, longitude: 77.7634, totalPlatforms: 7 },
    { code: "KYN", name: "Kalyan Junction", city: "Kalyan / Mumbai", state: "Maharashtra", latitude: 19.2437, longitude: 73.1355, totalPlatforms: 8 },
  ];

  for (const s of stationsData) {
    await prisma.station.create({ data: s });
  }
  console.log(`✅ Seeded ${stationsData.length} railway stations`);

  // 4. Seed Bus Stops
  const busStopsData = [
    { code: "JBP-ISBT", name: "Deendayal Bus Stand (ISBT)", city: "Jabalpur", landmark: "Near ISBT Flyover", latitude: 23.1950, longitude: 79.9120 },
    { code: "BOM-BOR", name: "Borivali West Bus Station", city: "Mumbai", landmark: "Opp. Gokul Hotel, Western Express Hwy", latitude: 19.2288, longitude: 72.8541 },
    { code: "BOM-DAD", name: "Dadar TT Circle Bus Stand", city: "Mumbai", landmark: "Near Swami Narayan Temple", latitude: 19.0178, longitude: 72.8478 },
    { code: "BPL-HAB", name: "Habibganj Bus Terminal", city: "Bhopal", landmark: "Near Rani Kamlapati Station", latitude: 23.2167, longitude: 77.4333 },
    { code: "NDLS-KAS", name: "Kashmiri Gate ISBT", city: "New Delhi", landmark: "Gate 1, Ring Road", latitude: 28.6675, longitude: 77.2282 },
    { code: "PUN-SWG", name: "Swargate Bus Station", city: "Pune", landmark: "Swargate Chowk", latitude: 18.5018, longitude: 73.8586 },
  ];

  for (const b of busStopsData) {
    await prisma.busStop.create({ data: b });
  }
  console.log(`✅ Seeded ${busStopsData.length} bus stops`);

  // 5. Seed Train Routes & Schedules
  const trainRoutes = [
    {
      mode: "train",
      routeNumber: "12189",
      routeName: "Mahakaushal Garib Rath Express",
      operator: "Indian Railways",
      originStationCode: "JBP",
      destStationCode: "BOM",
      totalDistanceKm: 980,
      estimatedDurationMins: 495, // 8h 15m
      intermediateStopsJson: JSON.stringify([
        { code: "JBP", name: "Jabalpur", haltMins: 0, day: 1, distKm: 0, arrTime: "06:30 AM", depTime: "06:30 AM", platform: "2" },
        { code: "ET", name: "Itarsi Junction", haltMins: 10, day: 1, distKm: 245, arrTime: "09:50 AM", depTime: "10:00 AM", platform: "3" },
        { code: "BPL", name: "Bhopal Junction", haltMins: 5, day: 1, distKm: 335, arrTime: "11:20 AM", depTime: "11:25 AM", platform: "1" },
        { code: "KYN", name: "Kalyan Junction", haltMins: 3, day: 1, distKm: 928, arrTime: "02:10 PM", depTime: "02:13 PM", platform: "5" },
        { code: "BOM", name: "Mumbai CSMT", haltMins: 0, day: 1, distKm: 980, arrTime: "02:45 PM", depTime: "02:45 PM", platform: "4" },
      ]),
      amenitiesJson: JSON.stringify(["E-Catering", "Bedroll Included", "Charging Sockets", "Bio-Toilets"]),
    },
    {
      mode: "train",
      routeNumber: "12062",
      routeName: "Jabalpur Janshatabdi Express",
      operator: "Indian Railways",
      originStationCode: "JBP",
      destStationCode: "BPL",
      totalDistanceKm: 335,
      estimatedDurationMins: 330, // 5h 30m
      intermediateStopsJson: JSON.stringify([
        { code: "JBP", name: "Jabalpur", haltMins: 0, day: 1, distKm: 0, arrTime: "05:30 AM", depTime: "05:30 AM", platform: "4" },
        { code: "ET", name: "Itarsi Junction", haltMins: 8, day: 1, distKm: 245, arrTime: "09:05 AM", depTime: "09:13 AM", platform: "2" },
        { code: "BPL", name: "Bhopal Junction", haltMins: 0, day: 1, distKm: 335, arrTime: "11:00 AM", depTime: "11:00 AM", platform: "6" },
      ]),
      amenitiesJson: JSON.stringify(["Onboard Catering", "Pushback Seats", "Large Windows"]),
    },
  ];

  for (const tr of trainRoutes) {
    const route = await prisma.route.create({ data: tr });

    // Create 7 days of schedules for each train
    const baseDate = new Date();
    for (let i = 0; i < 7; i++) {
      const travelDateObj = new Date(baseDate);
      travelDateObj.setDate(baseDate.getDate() + i);
      const dateStr = travelDateObj.toISOString().split("T")[0];

      const depTime = new Date(`${dateStr}T06:30:00.000Z`);
      const arrTime = new Date(depTime.getTime() + tr.estimatedDurationMins * 60 * 1000);

      await prisma.schedule.create({
        data: {
          routeId: route.id,
          travelDate: dateStr,
          departureTime: depTime,
          arrivalTime: arrTime,
          status: i === 0 ? "DELAYED" : "ON_TIME",
          delayMinutes: i === 0 ? 15 : 0,
          currentLocation: i === 0 ? "Approaching Itarsi Junction (ET)" : "Not Departed",
          seatInventoryJson: JSON.stringify({
            "1A": { available: 8, waiting: 0, status: "AVAILABLE" },
            "2A": { available: 22, waiting: 0, status: "AVAILABLE" },
            "3A": { available: 54, waiting: 0, status: "AVAILABLE" },
            "SL": { available: 112, waiting: 0, status: "AVAILABLE" },
          }),
          pricingTiersJson: JSON.stringify({
            "1A": 2480,
            "2A": 1560,
            "3A": 1080,
            "SL": 420,
          }),
        },
      });
    }
  }
  console.log(`✅ Seeded Train Routes & 7-day Schedules`);

  // 6. Seed Bus Routes & Schedules
  const busRoutes = [
    {
      mode: "bus",
      routeNumber: "ZG-4412",
      routeName: "Zingbus Bharat Benz AC Multi-Axle Sleeper (2+1)",
      operator: "Zingbus",
      originBusStopCode: "JBP-ISBT",
      destBusStopCode: "BOM-BOR",
      totalDistanceKm: 1040,
      estimatedDurationMins: 870, // 14h 30m
      busLayoutType: "2+1",
      intermediateStopsJson: JSON.stringify([
        { code: "JBP-ISBT", name: "Deendayal ISBT Jabalpur", time: "06:00 PM", landmark: "Platform 1" },
        { code: "NAG-BYPASS", name: "Nagpur Bypass Food Court", time: "11:30 PM", landmark: "Midway Rest Stop (30 mins)" },
        { code: "BOM-DAD", name: "Dadar TT Circle", time: "07:45 AM", landmark: "Opp Swami Narayan" },
        { code: "BOM-BOR", name: "Borivali West", time: "08:30 AM", landmark: "National Park Bridge" },
      ]),
      amenitiesJson: JSON.stringify(["AC", "Blanket", "Water Bottle", "Charging Point", "Reading Light", "Emergency Exit", "Live GPS Tracking"]),
    },
    {
      mode: "bus",
      routeNumber: "INTR-8820",
      routeName: "IntrCity SmartBus Volvo 9600 AC Sleeper (2+1)",
      operator: "IntrCity SmartBus",
      originBusStopCode: "JBP-ISBT",
      destBusStopCode: "BOM-DAD",
      totalDistanceKm: 1020,
      estimatedDurationMins: 840, // 14h 00m
      busLayoutType: "2+1",
      intermediateStopsJson: JSON.stringify([
        { code: "JBP-ISBT", name: "Deendayal ISBT Jabalpur", time: "07:30 PM", landmark: "IntrCity Boarding Lounge" },
        { code: "BOM-DAD", name: "Dadar TT Circle", time: "09:30 AM", landmark: "Dadar West Flyover" },
      ]),
      amenitiesJson: JSON.stringify(["AC", "Smart Clean Washroom", "Luggage Tag", "Live Tracking", "WiFi"]),
    },
    {
      mode: "bus",
      routeNumber: "VRL-2201",
      routeName: "VRL Travels Multi-Axle I-Shift Seater (2+2)",
      operator: "VRL Travels",
      originBusStopCode: "JBP-ISBT",
      destBusStopCode: "BOM-BOR",
      totalDistanceKm: 1040,
      estimatedDurationMins: 930, // 15h 30m
      busLayoutType: "2+2",
      intermediateStopsJson: JSON.stringify([
        { code: "JBP-ISBT", name: "Deendayal ISBT Jabalpur", time: "05:00 PM", landmark: "VRL Office" },
        { code: "BOM-BOR", name: "Borivali West", time: "08:30 AM", landmark: "Borivali East Bridge" },
      ]),
      amenitiesJson: JSON.stringify(["AC", "Pushback Seats", "CCTV", "Bottle Holder"]),
    },
  ];

  for (const br of busRoutes) {
    const route = await prisma.route.create({ data: br });

    // Generate lower and upper deck seat map
    const lowerDeckSeats = [];
    const upperDeckSeats = [];

    // Lower deck (15 seats)
    for (let r = 1; r <= 5; r++) {
      lowerDeckSeats.push({ seatNo: `L${r}A`, type: "SLEEPER", price: 1350, status: "AVAILABLE", gender: "ANY" });
      lowerDeckSeats.push({ seatNo: `L${r}B`, type: "SLEEPER", price: 1350, status: r === 2 ? "BOOKED" : "AVAILABLE", gender: r === 2 ? "FEMALE" : "ANY" });
      lowerDeckSeats.push({ seatNo: `L${r}C`, type: "SLEEPER", price: 1450, status: "AVAILABLE", gender: "ANY" }); // Single window
    }

    // Upper deck (15 seats)
    for (let r = 1; r <= 5; r++) {
      upperDeckSeats.push({ seatNo: `U${r}A`, type: "SLEEPER", price: 1400, status: "AVAILABLE", gender: "ANY" });
      upperDeckSeats.push({ seatNo: `U${r}B`, type: "SLEEPER", price: 1400, status: "AVAILABLE", gender: "ANY" });
      upperDeckSeats.push({ seatNo: `U${r}C`, type: "SLEEPER", price: 1550, status: "AVAILABLE", gender: "ANY" }); // Single window upper
    }

    // Create 7 days of schedules for each bus
    const baseDate = new Date();
    for (let i = 0; i < 7; i++) {
      const travelDateObj = new Date(baseDate);
      travelDateObj.setDate(baseDate.getDate() + i);
      const dateStr = travelDateObj.toISOString().split("T")[0];

      const depTime = new Date(`${dateStr}T18:00:00.000Z`);
      const arrTime = new Date(depTime.getTime() + br.estimatedDurationMins * 60 * 1000);

      await prisma.schedule.create({
        data: {
          routeId: route.id,
          travelDate: dateStr,
          departureTime: depTime,
          arrivalTime: arrTime,
          status: "ON_TIME",
          delayMinutes: 0,
          currentLocation: "Boarding at Jabalpur ISBT",
          seatInventoryJson: JSON.stringify({
            lowerDeck: lowerDeckSeats,
            upperDeck: upperDeckSeats,
            totalAvailable: 29,
          }),
          pricingTiersJson: JSON.stringify({
            SLEEPER_LOWER_DOUBLE: 1350,
            SLEEPER_LOWER_SINGLE: 1450,
            SLEEPER_UPPER_DOUBLE: 1400,
            SLEEPER_UPPER_SINGLE: 1550,
            SEATER: 890,
          }),
        },
      });
    }
  }
  console.log(`✅ Seeded Bus Routes with Real 2+1 & 2+2 Decks & 7-day Schedules`);

  console.log("🎉 Seeding complete! Database is primed and ready.");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
