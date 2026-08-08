const HOME_LAT = 51.41;
const HOME_LON = -0.83;
const RADIUS_NM = 20;

const TILE_COLORS = [
  '#38bdf8', // Cyan (Closest)
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#ec4899', // Pink
  '#a855f7', // Purple
  '#f97316', // Orange
  '#06b6d4', // Teal
  '#84cc16'  // Lime
];

let map;
let aircraftMarkers = {};
let aircraftTrails = {};
let aircraftHistory = {};

const ICAO_TO_IATA = {
  CPA: "CX", HDA: "KA", SIA: "SQ", ANA: "NH", JAL: "JL", EVA: "BR", 
  CAL: "CI", THA: "TG", MAS: "MH", PAL: "PR", CEB: "5J", QFA: "QF", 
  VOZ: "VA", ANZ: "NZ", UAE: "EK", ETD: "EY", QTR: "QR", SVD: "SV", 
  ETH: "ET", RAM: "AT", BAW: "BA", RYR: "FR", EZY: "U2", VIR: "VS", 
  SWR: "LX", DLH: "LH", AFR: "AF", KLM: "KL", SAS: "SK", FIN: "AY", 
  THY: "TK", TAP: "TP", AZA: "AZ", EIN: "EI", IBE: "IB", AEE: "A3", 
  WZZ: "W6", BCS: "QY", EXS: "LS", TOM: "BY", LOG: "LM", AAL: "AA", 
  DAL: "DL", UAL: "UA", SWA: "WN", ACA: "AC", AMX: "AM", TAM: "JJ", 
  AVA: "AV", GOL: "G3", CMP: "CM"
};

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

function getDistanceInMiles(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return "0.0";
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return (R * c).toFixed(1);
}

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

async function getRoute(callsign) {
  if (!callsign || callsign === "PRIVATE") return null;
  const cleanCallsign = callsign.trim().toUpperCase();

  let route = await fetchRouteFromApi(cleanCallsign);
  if (route) return route;

  const unpaddedCallsign = cleanCallsign.replace(/^([A-Z]+)0+(?=\d)/, '$1');
  if (unpaddedCallsign !== cleanCallsign) {
    route = await fetchRouteFromApi(unpaddedCallsign);
    if (route) return route;
  }

  if (KNOWN_ROUTES[cleanCallsign]) return KNOWN_ROUTES[cleanCallsign];
  if (KNOWN_ROUTES[unpaddedCallsign]) return KNOWN_ROUTES[unpaddedCallsign];

  return null;
}

function calculateTimeToDest(planeLat, planeLon, destObj, speedKnots) {
  if (!speedKnots || speedKnots < 50 || !destObj || !destObj.lat || !destObj.lon) return "N/A";

  const distToDestMiles = parseFloat(getDistanceInMiles(planeLat, planeLon, destObj.lat, destObj.lon));
  const speedMph = speedKnots * 1.15078;
  const hours = distToDestMiles / speedMph;
  const minutes = Math.round(hours * 60);

  if (minutes < 60) return `${minutes} mins`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m < 10 ? '0' : ''}${m}m`;
}

function getAirlineLogoUrl(callsign) {
  if (!callsign || callsign.length < 3) return null;
  const icao = callsign.substring(0, 3).toUpperCase();
  const iata = ICAO_TO_IATA[icao];

  if (iata) {
    return `https://images.kiwi.com/airlines/64/${iata}.png`;
  }
  return `https://assets.duffel.com/img/airlines/for-floor/sq/${icao}.png`;
}

async function getPlanePhotoUrl(reg) {
  if (!reg) return "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=300&q=80";
  try {
    const res = await fetch(`https://api.planespotters.net/pub/photos/reg/${reg}`);
    if (res.ok) {
      const data = await res.json();
      if (data.photos && data.photos.length > 0) {
        return data.photos[0].thumbnail_large.src;
      }
    }
  } catch (e) {}
  return "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=300&q=80";
}

function createPlaneSvgIcon(heading, color, isFeatured) {
  const size = isFeatured ? 32 : 22;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="${color}" style="transform: rotate(${heading}deg); filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.8));">
      <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
    </svg>`;
  return L.divIcon({
    html: svg,
    className: 'plane-marker-icon',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  });
}

function updateClock() {
  const clockEl = document.getElementById('current-time');
  if (clockEl) {
    const now = new Date();
    clockEl.textContent = now.toTimeString().split(' ')[0];
  }
}

function initMap() {
  const mapContainer = document.getElementById('map');
  if (!mapContainer || map) return;

  // Widescreen view: centered on Wokingham-LHR corridor at zoom level 11
  map = L.map('map').setView([51.44, -0.64], 11);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    maxZoom: 19
  }).addTo(map);

  // Home / Wokingham Marker
  L.circleMarker([HOME_LAT, HOME_LON], {
    radius: 7,
    fillColor: '#38bdf8',
    color: '#ffffff',
    weight: 2,
    opacity: 1,
    fillOpacity: 0.9
  }).addTo(map).bindPopup("<b>Wokingham</b><br>Radar Center");

  // Heathrow Airport Reference Marker
  L.circleMarker([51.47, -0.4543], {
    radius: 5,
    fillColor: '#f59e0b',
    color: '#ffffff',
    weight: 1,
    opacity: 0.8,
    fillOpacity: 0.7
  }).addTo(map).bindPopup("<b>London Heathrow Airport (LHR)</b>");

  // Invalidate size on window resize for optimal full-width rendering
  window.addEventListener('resize', () => map.invalidateSize());
}

function updateMapVisuals(flights) {
  if (!map) return;

  const currentHexes = new Set();

  flights.forEach((f, idx) => {
    currentHexes.add(f.hex);
    const isFeatured = idx === 0;

    if (!aircraftHistory[f.hex]) {
      aircraftHistory[f.hex] = [];
    }
    const history = aircraftHistory[f.hex];
    if (history.length === 0 || history[history.length - 1][0] !== f.lat || history[history.length - 1][1] !== f.lon) {
      history.push([f.lat, f.lon]);
      if (history.length > 20) history.shift();
    }

    const icon = createPlaneSvgIcon(f.heading, f.color, isFeatured);
    if (aircraftMarkers[f.hex]) {
      aircraftMarkers[f.hex].setLatLng([f.lat, f.lon]);
      aircraftMarkers[f.hex].setIcon(icon);
    } else {
      const marker = L.marker([f.lat, f.lon], { icon }).addTo(map);
      marker.bindPopup(`<b>${f.callsign}</b><br>${f.type}<br>Alt: ${f.alt.toLocaleString()} ft<br>Speed: ${f.speed} kts`);
      aircraftMarkers[f.hex] = marker;
    }

    if (aircraftTrails[f.hex]) {
      aircraftTrails[f.hex].setLatLngs(history);
      aircraftTrails[f.hex].setStyle({ color: f.color });
    } else if (history.length >= 1) {
      const polyline = L.polyline(history, {
        color: f.color,
        weight: isFeatured ? 3 : 2,
        opacity: 0.8,
        dashArray: '4, 6'
      }).addTo(map);
      aircraftTrails[f.hex] = polyline;
    }
  });

  Object.keys(aircraftMarkers).forEach(hex => {
    if (!currentHexes.has(hex)) {
      map.removeLayer(aircraftMarkers[hex]);
      delete aircraftMarkers[hex];

      if (aircraftTrails[hex]) {
        map.removeLayer(aircraftTrails[hex]);
        delete aircraftTrails[hex];
      }
      delete aircraftHistory[hex];
    }
  });
}

async function fetchFlights() {
  const grid = document.getElementById("flight-grid");
  if (!grid) return;

  try {
    const res = await fetch(`https://api.airplanes.live/v2/point/${HOME_LAT}/${HOME_LON}/${RADIUS_NM}`);
    if (!res.ok) throw new Error("API response error");

    const data = await res.json();

    if (!data.ac || data.ac.length === 0) {
      grid.innerHTML = '<div class="loading-state">No airborne aircraft within radar range</div>';
      return;
    }

    const flights = data.ac
      .filter(ac => ac.lat && ac.lon && ac.alt_baro !== "ground")
      .map(ac => ({
        callsign: ac.flight ? ac.flight.trim() : "PRIVATE",
        hex: ac.hex,
        type: ac.desc || ac.t || "Aircraft",
        reg: ac.r || "",
        lat: ac.lat,
        lon: ac.lon,
        alt: ac.alt_baro || 0,
        speed: Math.round(ac.gs || 0),
        heading: ac.track || 0,
        distance: parseFloat(getDistanceInMiles(HOME_LAT, HOME_LON, ac.lat, ac.lon))
      }))
      .sort((a, b) => a.distance - b.distance)
      .map((f, idx) => ({
        ...f,
        color: TILE_COLORS[idx % TILE_COLORS.length]
      }));

    updateMapVisuals(flights);

    const defaultAirport = { code: "N/A", name: "Route Info N/A", city: "Unknown City", country: "", lat: null, lon: null };

    const cardsHtml = await Promise.all(flights.map(async (f, idx) => {
      const isClosest = idx === 0;
      const route = await getRoute(f.callsign);

      const airlineName = route?.airline || "";
      const orig = route?.origin || defaultAirport;
      const dest = route?.dest || defaultAirport;

      const timeToDest = calculateTimeToDest(f.lat, f.lon, dest, f.speed);
      const logoUrl = getAirlineLogoUrl(f.callsign);

      if (isClosest) {
        const photoUrl = await getPlanePhotoUrl(f.reg);

        return `
          <div class="flight-card featured-card" id="card-${f.hex}" style="--accent-color: ${f.color};">
            <div class="featured-header-bar">
              <div class="featured-badge">⚡ CLOSEST IN RANGE</div>
              <div class="callsign-box">
                <span class="callsign">${f.callsign}</span>
                ${logoUrl ? `<img src="${logoUrl}" class="airline-logo" alt="Airline logo" referrerpolicy="no-referrer" onerror="this.style.display='none'">` : ''}
              </div>
            </div>

            <div class="featured-body">
              <div class="photo-wrapper">
                <img src="${photoUrl}" class="plane-photo" alt="Aircraft photo" onerror="this.src='https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=300&q=80'">
                <div class="ac-type-tag">${f.type} ${f.reg ? `(${f.reg})` : ''}</div>
              </div>

              <div class="featured-details">
                <div class="route-panel">
                  <div class="route-airports">
                    <div class="airport-node">
                      <div class="airport-code">${orig.code}</div>
                      <div class="airport-name">${orig.name}</div>
                      <div class="airport-city">${orig.city}${orig.country ? `, ${orig.country}` : ''}</div>
                    </div>
                    <div class="route-arrow">✈️</div>
                    <div class="airport-node" style="text-align: right;">
                      <div class="airport-code">${dest.code}</div>
                      <div class="airport-name">${dest.name}</div>
                      <div class="airport-city">${dest.city}${dest.country ? `, ${dest.country}` : ''}</div>
                    </div>
                  </div>
                </div>

                <div class="telemetry">
                  <div>
                    <div class="metric-label">Distance</div>
                    <div class="metric-value">${f.distance} mi</div>
                  </div>
                  <div>
                    <div class="metric-label">Altitude</div>
                    <div class="metric-value">${f.alt.toLocaleString()} ft</div>
                  </div>
                  <div>
                    <div class="metric-label">Speed</div>
                    <div class="metric-value">${f.speed} kts</div>
                  </div>
                  <div>
                    <div class="metric-label">Time to Dest.</div>
                    <div class="metric-value" style="color: ${f.color};">${timeToDest}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `;
      } else {
        return `
          <div class="flight-card" id="card-${f.hex}" style="--accent-color: ${f.color};">
            <div class="card-header">
              <div class="callsign-box">
                <span class="callsign">${f.callsign}</span>
                ${logoUrl ? `<img src="${logoUrl}" class="airline-logo" alt="Airline logo" referrerpolicy="no-referrer" onerror="this.style.display='none'">` : ''}
              </div>
              ${airlineName ? `<div class="airline-name">${airlineName}</div>` : ''}
              <div class="ac-type">${f.type} ${f.reg ? `(${f.reg})` : ''}</div>
            </div>

            <div class="route-panel">
              <div class="route-airports">
                <div class="airport-node">
                  <div class="airport-code">${orig.code}</div>
                  <div class="airport-name">${orig.name}</div>
                  <div class="airport-city">${orig.city}${orig.country ? `, ${orig.country}` : ''}</div>
                </div>
                <div class="route-arrow">✈️</div>
                <div class="airport-node" style="text-align: right;">
                  <div class="airport-code">${dest.code}</div>
                  <div class="airport-name">${dest.name}</div>
                  <div class="airport-city">${dest.city}${dest.country ? `, ${dest.country}` : ''}</div>
                </div>
              </div>
            </div>

            <div class="telemetry">
              <div>
                <div class="metric-label">Distance</div>
                <div class="metric-value">${f.distance} mi</div>
              </div>
              <div>
                <div class="metric-label">Altitude</div>
                <div class="metric-value">${f.alt.toLocaleString()} ft</div>
              </div>
              <div>
                <div class="metric-label">Speed</div>
                <div class="metric-value">${f.speed} kts</div>
              </div>
              <div>
                <div class="metric-label">Time to Dest.</div>
                <div class="metric-value" style="color: ${f.color};">${timeToDest}</div>
              </div>
            </div>
          </div>
        `;
      }
    }));

    grid.innerHTML = cardsHtml.join('');
  } catch (e) {
    console.error("Flight fetch error:", e);
    grid.innerHTML = '<div class="loading-state">Error loading live radar data. Retrying...</div>';
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initMap();
  updateClock();
  setInterval(updateClock, 1000);
  fetchFlights();
  setInterval(fetchFlights, 10000);
});
