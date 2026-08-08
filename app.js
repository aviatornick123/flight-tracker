// Expanded ICAO to IATA lookup
const ICAO_TO_IATA = {
  BAW: "BA", RYR: "FR", EZY: "U2", VIR: "VS", SWR: "LX",
  DLH: "LH", UAE: "EK", QFA: "QF", AAL: "AA", DAL: "DL",
  UAL: "UA", AFR: "AF", KLM: "KL", SAS: "SK", FIN: "AY",
  THY: "TK", TAP: "TP", AZA: "AZ", EIN: "EI", TAM: "JJ",
  SWA: "WN", ACA: "AC", QTR: "QR", ETD: "EY", AMX: "AM",
  IBE: "IB", ANA: "NH", JAL: "JL", CPA: "CX", SIA: "SQ"
};

// Hardcoded fallback database for callsigns frequently missing in adsbdb
const KNOWN_ROUTES = {
  AMX008: {
    airline: "Aeromexico",
    origin: { code: "LHR", name: "Heathrow Airport", city: "London", country: "United Kingdom", lat: 51.4700, lon: -0.4543 },
    dest: { code: "MEX", name: "Mexico City International", city: "Mexico City", country: "Mexico", lat: 19.4363, lon: -99.0721 }
  },
  AMX8: {
    airline: "Aeromexico",
    origin: { code: "LHR", name: "Heathrow Airport", city: "London", country: "United Kingdom", lat: 51.4700, lon: -0.4543 },
    dest: { code: "MEX", name: "Mexico City International", city: "Mexico City", country: "Mexico", lat: 19.4363, lon: -99.0721 }
  }
};

async function fetchRouteFromApi(callsignQuery) {
  try {
    const res = await fetch(`https://api.adsbdb.com/v0/callsign/${callsignQuery}`);
    if (res.ok) {
      const data = await res.json();
      const flightRoute = data?.response?.flightroute;
      if (flightRoute?.origin && flightRoute?.destination) {
        return {
          airline: flightRoute.airline?.name || "",
          origin: {
            code: flightRoute.origin.iata_code || flightRoute.origin.icao_code || "N/A",
            name: flightRoute.origin.name || "Unknown Airport",
            city: flightRoute.origin.municipality || "Unknown City",
            country: flightRoute.origin.country_name || flightRoute.origin.country_iso_name || "",
            lat: flightRoute.origin.latitude || null,
            lon: flightRoute.origin.longitude || null
          },
          dest: {
            code: flightRoute.destination.iata_code || flightRoute.destination.icao_code || "N/A",
            name: flightRoute.destination.name || "Unknown Airport",
            city: flightRoute.destination.municipality || "Unknown City",
            country: flightRoute.destination.country_name || flightRoute.destination.country_iso_name || "",
            lat: flightRoute.destination.latitude || null,
            lon: flightRoute.destination.longitude || null
          }
        };
      }
    }
  } catch (e) {}
  return null;
}

// Dynamically extracts route with leading zero strip & hardcoded fallback checks
async function getRoute(callsign) {
  if (!callsign || callsign === "PRIVATE") return null;
  const cleanCallsign = callsign.trim().toUpperCase();

  // 1. Try primary API call
  let route = await fetchRouteFromApi(cleanCallsign);
  if (route) return route;

  // 2. Try removing padded zeroes (e.g., AMX008 -> AMX8)
  const unpaddedCallsign = cleanCallsign.replace(/^([A-Z]+)0+(?=\d)/, '$1');
  if (unpaddedCallsign !== cleanCallsign) {
    route = await fetchRouteFromApi(unpaddedCallsign);
    if (route) return route;
  }

  // 3. Check local fallback map
  if (KNOWN_ROUTES[cleanCallsign]) {
    return KNOWN_ROUTES[cleanCallsign];
  }
  if (KNOWN_ROUTES[unpaddedCallsign]) {
    return KNOWN_ROUTES[unpaddedCallsign];
  }

  return null;
}
