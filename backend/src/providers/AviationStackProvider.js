const AIRPORTS = {
  agra: "AGR", ahmedabad: "AMD", amritsar: "ATQ", ayodhya: "AYJ", bangalore: "BLR", bengaluru: "BLR",
  bhopal: "BHO", bhubaneswar: "BBI", chandigarh: "IXC", chennai: "MAA", coimbatore: "CJB", dehradun: "DED",
  delhi: "DEL", "new delhi": "DEL", goa: "GOI", guwahati: "GAU", hyderabad: "HYD", indore: "IDR", jaipur: "JAI", jammu: "IXJ",
  jodhpur: "JDH", kanpur: "KNU", kochi: "COK", kolkata: "CCU", lucknow: "LKO", madurai: "IXM", mangalore: "IXE",
  mumbai: "BOM", nagpur: "NAG", patna: "PAT", pune: "PNQ", ranchi: "IXR", rishikesh: "DED", srinagar: "SXR",
  surat: "STV", thiruvananthapuram: "TRV", trivandrum: "TRV", udaipur: "UDR", vadodara: "BDQ", varanasi: "VNS",
  visakhapatnam: "VTZ", vizag: "VTZ", gwalior: "GWL",
};

const airportCodeFor = (location) => {
  const value = String(location || "").trim();
  if (/^[A-Za-z]{3}$/.test(value)) return value.toUpperCase();
  const normalized = value.toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(airport|international|domestic|junction|railway station|rail station|station|city)\b/g, " ")
    .replace(/\s+/g, " ").trim();
  return AIRPORTS[value.toLowerCase()] || AIRPORTS[normalized] || null;
};

const parseDateTime = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

class AviationStackProvider {
  constructor() {
    this.accessKey = process.env.AVIATIONSTACK_ACCESS_KEY || "";
    this.baseUrl = (process.env.AVIATIONSTACK_BASE_URL || "https://api.aviationstack.com/v1").replace(/\/$/, "");
  }

  get configured() {
    return Boolean(this.accessKey);
  }

  async search({ origin, destination, travelDate }) {
    const depIata = airportCodeFor(origin);
    const arrIata = airportCodeFor(destination);
    if (!depIata || !arrIata) {
      return { results: [], notice: `Live flight search needs airport codes. Airport mapping is unavailable for ${!depIata ? origin : destination}.` };
    }

    const url = new URL(`${this.baseUrl}/flights`);
    url.searchParams.set("access_key", this.accessKey);
    url.searchParams.set("dep_iata", depIata);
    url.searchParams.set("arr_iata", arrIata);
    if (travelDate) url.searchParams.set("flight_date", travelDate);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    let response;
    try {
      response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    } catch (error) {
      if (error.name === "AbortError") throw new Error("Flight data provider timed out. Please retry shortly.");
      throw new Error("Could not connect to the flight data provider.");
    } finally {
      clearTimeout(timeout);
    }

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.error) {
      const providerMessage = payload.error?.message || payload.error?.info || `HTTP ${response.status}`;
      if (/invalid api access key|invalid_access_key|valid access key/i.test(providerMessage)) {
        throw new Error("Aviationstack rejected the configured API key. Replace AVIATIONSTACK_ACCESS_KEY in backend/.env with a valid key from your Aviationstack account, then restart the backend.");
      }
      throw new Error(`Flight data provider error: ${providerMessage}`);
    }

    const results = (Array.isArray(payload.data) ? payload.data : []).map((flight, index) => {
      const departureTime = parseDateTime(flight.departure?.estimated || flight.departure?.scheduled);
      const arrivalTime = parseDateTime(flight.arrival?.estimated || flight.arrival?.scheduled);
      let durationMinutes = departureTime && arrivalTime ? Math.round((arrivalTime - departureTime) / 60000) : 0;
      if (durationMinutes < 0) durationMinutes += 24 * 60;
      const flightCode = flight.flight?.iata || flight.flight?.number || `unknown-${index + 1}`;
      const status = String(flight.flight_status || "unknown").toUpperCase();
      const departureCity = flight.departure?.airport || origin;
      const arrivalCity = flight.arrival?.airport || destination;
      const departureIata = flight.departure?.iata || depIata;
      const arrivalIata = flight.arrival?.iata || arrIata;
      const flightDate = flight.flight_date || travelDate;
      const searchUrl = `https://www.google.com/travel/flights?q=${encodeURIComponent(`Flights from ${depIata} to ${arrIata} on ${flightDate}`)}`;

      return {
        id: `aviationstack-${flightCode}-${flightDate}-${index}`,
        routeId: null,
        scheduleId: null,
        type: "flight",
        dataStatus: "LIVE",
        source: "Aviationstack live flight data",
        numberOrCode: flightCode,
        name: `${flight.airline?.name || "Flight"} ${flightCode}`,
        operator: flight.airline?.name || "Airline not supplied",
        origin: {
          code: departureIata,
          name: departureCity,
          city: origin,
          departureTime: departureTime?.toISOString() || flight.departure?.scheduled || null,
          terminal: flight.departure?.terminal || null,
          gate: flight.departure?.gate || null,
          delayMinutes: flight.departure?.delay ?? null,
        },
        destination: {
          code: arrivalIata,
          name: arrivalCity,
          city: destination,
          arrivalTime: arrivalTime?.toISOString() || flight.arrival?.scheduled || null,
          terminal: flight.arrival?.terminal || null,
          gate: flight.arrival?.gate || null,
          delayMinutes: flight.arrival?.delay ?? null,
        },
        durationMinutes,
        durationFormatted: durationMinutes ? `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m` : "Duration not supplied",
        totalDistanceKm: null,
        classes: [],
        minFare: null,
        amenities: [],
        intermediateStops: [],
        status,
        flightDate,
        bookingUrl: searchUrl,
        availabilityNotice: "Fare and seat availability are not provided by this flight-status API.",
        lastUpdatedAt: new Date().toISOString(),
      };
    });

    return { results, notice: results.length ? null : `No flights were returned for ${depIata} → ${arrIata} on ${travelDate}. The provider's free plan may not include future flight schedules.` };
  }
}

module.exports = new AviationStackProvider();
