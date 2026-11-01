const AIRPORTS = {
  agra: "AGR", ahmedabad: "AMD", amritsar: "ATQ", ayodhya: "AYJ", bangalore: "BLR", bengaluru: "BLR",
  bhopal: "BHO", bhubaneswar: "BBI", chandigarh: "IXC", chennai: "MAA", coimbatore: "CJB", dehradun: "DED",
  delhi: "DEL", "new delhi": "DEL", goa: "GOI", guwahati: "GAU", hyderabad: "HYD", indore: "IDR", jabalpur: "JLR", jaipur: "JAI",
  jammu: "IXJ", jodhpur: "JDH", kanpur: "KNU", kochi: "COK", kolkata: "CCU", lucknow: "LKO", madurai: "IXM",
  mangalore: "IXE", mumbai: "BOM", nagpur: "NAG", patna: "PAT", pune: "PNQ", ranchi: "IXR", srinagar: "SXR",
  surat: "STV", thiruvananthapuram: "TRV", trivandrum: "TRV", udaipur: "UDR", vadodara: "BDQ", varanasi: "VNS",
  visakhapatnam: "VTZ", vizag: "VTZ", gwalior: "GWL",
};

const toAirportCode = (location) => {
  const raw = String(location || "").trim();
  if (/^[A-Za-z]{3}$/.test(raw)) return raw.toUpperCase();
  const key = raw.toLowerCase().replace(/\([^)]*\)/g, " ")
    .replace(/\b(airport|international|domestic|junction|railway station|rail station|station|city)\b/g, " ")
    .replace(/\s+/g, " ").trim();
  return AIRPORTS[raw.toLowerCase()] || AIRPORTS[key] || null;
};

const flightTime = (value) => value || null;
const flightDateTime = (value) => value ? String(value).replace(" ", "T") : null;
const flightCode = (flight) => String(flight.flight_number || "").replace(/\s+/g, "-");

class SerpApiFlightsProvider {
  constructor() {
    this.apiKey = process.env.SERPAPI_API_KEY || process.env.SERPAPI_KEY || "";
    this.baseUrl = (process.env.SERPAPI_BASE_URL || "https://serpapi.com/search.json").replace(/\/$/, "");
  }

  get configured() { return Boolean(this.apiKey); }

  async request(params) {
    if (!this.configured) throw new Error("SerpApi is not configured. Add SERPAPI_API_KEY to backend/.env.");
    const url = new URL(this.baseUrl);
    url.searchParams.set("engine", "google_flights");
    url.searchParams.set("api_key", this.apiKey);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    try {
      const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.error || payload.search_metadata?.status === "Error") {
        const providerMessage = payload.error || `HTTP ${response.status}`;
        if (/api key|api_key|unauthori[sz]ed|invalid/i.test(providerMessage)) {
          throw new Error("SerpApi rejected the configured API key. Check SERPAPI_API_KEY in backend/.env and your SerpApi account quota.");
        }
        throw new Error(`SerpApi flight search failed: ${providerMessage}`);
      }
      return payload;
    } catch (error) {
      if (error.name === "AbortError") throw new Error("SerpApi flight search timed out. Please retry.");
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async search({ origin, destination, travelDate, passengers = 1 }) {
    const departureId = toAirportCode(origin);
    const arrivalId = toAirportCode(destination);
    if (!departureId || !arrivalId) {
      return { results: [], notice: `Flight search needs an airport code. Mapping is unavailable for ${!departureId ? origin : destination}.` };
    }
    const data = await this.request({
      departure_id: departureId,
      arrival_id: arrivalId,
      outbound_date: travelDate,
      type: 2,
      adults: Math.min(9, Math.max(1, Number.parseInt(passengers, 10) || 1)),
      currency: "INR",
      gl: "in",
      hl: "en",
    });
    const options = [...(data.best_flights || []), ...(data.other_flights || [])];
    const results = options.slice(0, 30).map((option, index) => {
      const segments = Array.isArray(option.flights) ? option.flights : [];
      const first = segments[0] || {};
      const last = segments[segments.length - 1] || first;
      const airlineNames = [...new Set(segments.map((segment) => segment.airline).filter(Boolean))];
      const flightNumbers = segments.map(flightCode).filter(Boolean);
      const scheduledDate = first.departure_airport?.time?.slice(0, 10) || travelDate;
      const flightQuery = `Flights from ${departureId} to ${arrivalId} on ${scheduledDate}`;
      const bookingUrl = new URL("https://www.google.com/travel/flights");
      bookingUrl.searchParams.set("q", flightQuery);
      bookingUrl.searchParams.set("hl", "en");
      bookingUrl.searchParams.set("curr", "INR");
      const stops = Array.isArray(option.layovers) ? option.layovers : [];
      const durationMinutes = Number(option.total_duration) || segments.reduce((total, segment) => total + (Number(segment.duration) || 0), 0);
      const price = Number(option.price);
      const serviceNumber = flightNumbers.join(" / ") || `Option ${index + 1}`;
      const status = stops.length ? `${stops.length} stop${stops.length === 1 ? "" : "s"}` : "Nonstop";
      return {
        id: `serpapi-${departureId}-${arrivalId}-${scheduledDate}-${index}-${serviceNumber.replace(/[^a-z0-9]/gi, "")}`,
        routeId: null,
        scheduleId: null,
        type: "flight",
        dataStatus: "LIVE",
        source: "SerpApi · Google Flights",
        dataSource: "Google Flights search results via SerpApi",
        bookingSupported: true,
        numberOrCode: serviceNumber,
        name: airlineNames.length ? `${airlineNames.join(" + ")} · ${serviceNumber}` : `Flight ${serviceNumber}`,
        operator: airlineNames.join(" + ") || "Airline information unavailable",
        airlineLogo: option.airline_logo || first.airline_logo || null,
        origin: {
          code: first.departure_airport?.id || departureId,
          name: first.departure_airport?.name || origin,
          city: origin,
          departureTime: flightDateTime(flightTime(first.departure_airport?.time)),
        },
        destination: {
          code: last.arrival_airport?.id || arrivalId,
          name: last.arrival_airport?.name || destination,
          city: destination,
          arrivalTime: flightDateTime(flightTime(last.arrival_airport?.time)),
        },
        durationMinutes,
        durationFormatted: `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m`,
        totalDistanceKm: null,
        classes: [],
        minFare: Number.isFinite(price) ? price : null,
        amenities: option.extensions || [],
        intermediateStops: stops.map((stop) => ({ name: stop.name, code: stop.id, durationMinutes: stop.duration })),
        totalAvailableSeats: null,
        status,
        flightDate: scheduledDate,
        bookingUrl: bookingUrl.toString(),
        availabilityNotice: "Price and itinerary are from Google Flights search results. Confirm current fare, baggage rules, and availability with the airline or seller before purchase.",
        lastUpdatedAt: data.search_metadata?.processed_at || new Date().toISOString(),
      };
    });
    return { results, notice: results.length ? null : `No Google Flights options were returned for ${departureId} → ${arrivalId} on ${travelDate}.` };
  }
}

module.exports = new SerpApiFlightsProvider();
