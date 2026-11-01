const trainDataProvider = require("../providers/TrainDataProvider");
const busDataProvider = require("../providers/BusDataProvider");
const cacheService = require("../config/cache");
const accountController = require("../controllers/accountController");
const otherTransportProvider = require("../providers/OtherTransportProvider");
const aviationStackProvider = require("../providers/AviationStackProvider");
const serpApiFlightsProvider = require("../providers/SerpApiFlightsProvider");
const transportDatasetProvider = require("../providers/TransportDatasetProvider");

class SearchService {
  async search({ from, to, date, mode = "all", sortBy = "fastest", passengers = 1, userId }) {
    if (!from || !to) {
      throw new Error("Both source ('from') and destination ('to') locations are required");
    }

    const travelDate = date || new Date().toISOString().split("T")[0];
    const cacheKey = `search:v8:${from.toLowerCase()}:${to.toLowerCase()}:${travelDate}:${mode}:${sortBy}:${passengers}`;

    // 1. Check Cache
    const cachedResults = await cacheService.get(cacheKey);
    if (cachedResults) {
      console.log(`⚡ Serving cached search for ${from} -> ${to}`);
      await accountController.evaluatePriceAlerts({ userId, from, to, date: travelDate, mode, results: cachedResults.results });
      return {
        ...cachedResults,
        fromCache: true,
      };
    }

    // 2. Fetch from Train & Bus providers concurrently
    let trainResults = [];
    let busResults = [];
    let flightResults = [];
    let cabResults = [];

    if (mode === "all" || mode === "train") {
      try {
        const [catalogResults, datasetResults] = await Promise.all([
          trainDataProvider.searchTrains({
          origin: from,
          destination: to,
          travelDate,
          }),
          transportDatasetProvider.search({ mode: "train", origin: from, destination: to, travelDate }),
        ]);
        trainResults = [...catalogResults, ...datasetResults];
      } catch (err) {
        console.error("Train search error:", err.message);
      }
    }

    if (mode === "all" || mode === "bus") {
      try {
        const [catalogResults, datasetResults] = await Promise.all([
          busDataProvider.searchBuses({
          origin: from,
          destination: to,
          travelDate,
          }),
          transportDatasetProvider.search({ mode: "bus", origin: from, destination: to, travelDate }),
        ]);
        busResults = [...catalogResults, ...datasetResults];
      } catch (err) {
        console.error("Bus search error:", err.message);
      }
    }

    let flightNotice = null;
    if (mode === "all" || mode === "flight") {
      try {
        flightResults = await transportDatasetProvider.search({ mode: "flight", origin: from, destination: to, travelDate });
        if (serpApiFlightsProvider.configured) {
          const flightData = await serpApiFlightsProvider.search({ origin: from, destination: to, travelDate, passengers });
          flightResults = [...flightData.results, ...flightResults];
          flightNotice = flightData.notice;
        } else if (aviationStackProvider.configured) {
          const flightData = await aviationStackProvider.search({ origin: from, destination: to, travelDate });
          flightResults = [...flightData.results, ...flightResults];
          flightNotice = flightData.notice;
        } else {
          flightNotice = "Showing imported flight schedules where available. Add SERPAPI_API_KEY to backend/.env to search live fares and flight options.";
        }
      } catch (err) {
        console.error("Flight search error:", err.message);
        // Keep any imported route schedules visible when a live API credential or
        // provider request fails. Those records remain clearly marked as sample data.
        flightNotice = /invalid|access key|api key|unauthorized|forbidden/i.test(err.message)
          ? "Live flight data is unavailable because the configured flight API key was rejected. Imported route schedules are shown where available. Check the provider key in backend/.env and restart the backend."
          : `Live flight data is temporarily unavailable. Imported route schedules are shown where available. (${err.message})`;
      }
    }
    if (mode === "all" || mode === "cab") {
      cabResults = await otherTransportProvider.search({ origin: from, destination: to, travelDate, mode: "cab" });
    }

    // Combine
    let allJourneys = [...trainResults, ...busResults, ...flightResults, ...cabResults];

    // Sorting logic
    if (sortBy === "cheapest") {
      allJourneys.sort((a, b) => (a.minFare ?? Number.POSITIVE_INFINITY) - (b.minFare ?? Number.POSITIVE_INFINITY));
    } else if (sortBy === "fastest") {
      allJourneys.sort((a, b) => a.durationMinutes - b.durationMinutes);
    } else if (sortBy === "departure") {
      allJourneys.sort((a, b) => new Date(a.origin.departureTime) - new Date(b.origin.departureTime));
    } else if (sortBy === "recommended") {
      const pricedJourneys = allJourneys.filter((item) => Number.isFinite(item.minFare));
      const minFare = pricedJourneys.length ? Math.min(...pricedJourneys.map((item) => item.minFare)) : 0;
      const maxFare = pricedJourneys.length ? Math.max(...pricedJourneys.map((item) => item.minFare)) : 0;
      const minDuration = Math.min(...allJourneys.map((item) => item.durationMinutes));
      const maxDuration = Math.max(...allJourneys.map((item) => item.durationMinutes));
      const score = (item) => {
      const price = !Number.isFinite(item.minFare) ? 1 : maxFare === minFare ? 0 : (item.minFare - minFare) / (maxFare - minFare);
        const duration = maxDuration === minDuration ? 0 : (item.durationMinutes - minDuration) / (maxDuration - minDuration);
        const reliability = item.status === "DELAYED" ? 1 : 0;
        return price * 0.4 + duration * 0.45 + reliability * 0.15;
      };
      allJourneys.sort((a, b) => score(a) - score(b));
    }

    // Tag the best overall, fastest, and cheapest
    if (allJourneys.length > 0) {
      const fastest = [...allJourneys].sort((a, b) => a.durationMinutes - b.durationMinutes)[0];
      const cheapest = [...allJourneys].filter((item) => Number.isFinite(item.minFare)).sort((a, b) => a.minFare - b.minFare)[0];
      const recommended = allJourneys[0];

      allJourneys = allJourneys.map((j) => {
        let tag = "standard";
        let tagNote = "";
        if (j.id === recommended.id) {
          tag = "recommended";
          tagNote = "Smart pick";
        } else if (j.id === fastest.id) {
          tag = "fastest";
          tagNote = "Fastest connection";
        } else if (cheapest && j.id === cheapest.id) {
          tag = "cheapest";
          tagNote = `Best value • From ₹${j.minFare}`;
        }
        return {
          ...j,
          tag,
          tagNote,
        };
      });
    }

    const response = {
      query: { from, to, date: travelDate, mode, sortBy },
      summary: {
        totalFound: allJourneys.length,
        trainCount: allJourneys.filter((j) => j.type === "train").length,
        busCount: allJourneys.filter((j) => j.type === "bus").length,
        flightCount: allJourneys.filter((j) => j.type === "flight").length,
        cabCount: allJourneys.filter((j) => j.type === "cab").length,
        minPrice: allJourneys.some((j) => Number.isFinite(j.minFare)) ? Math.min(...allJourneys.filter((j) => Number.isFinite(j.minFare)).map((j) => j.minFare)) : null,
      },
      results: allJourneys,
      dataNotice: "Items marked SAMPLE ESTIMATE are illustrative values and are not live services, fares, schedules, or availability.",
      flightNotice,
      lastUpdatedAt: new Date().toISOString(),
      fromCache: false,
    };

    // Cache results for 5 minutes (300 seconds)
    await cacheService.set(cacheKey, response, 300);

    await accountController.evaluatePriceAlerts({ userId, from, to, date: travelDate, mode, results: allJourneys });

    return response;
  }
}

module.exports = new SearchService();
