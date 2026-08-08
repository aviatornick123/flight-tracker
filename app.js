const HOME_LAT = 51.41;
const HOME_LON = -0.83;
const RADIUS_NM = 20;

// Color palette linking map markers, flight trails, and card accents
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

// Airport database with GPS coordinates for accurate Time-To-Destination calculations
const AIRPORT_DB = {
  LHR: { city: "London", name: "Heathrow Airport", lat: 51.4700, lon: -0.4543 },
  LGW: { city: "London", name: "Gatwick Airport", lat: 51.1537, lon: -0.1821 },
  STN: { city: "London", name: "Stansted Airport", lat: 51.8860, lon: 0.2389 },
  LTN: { city: "London", name: "Luton Airport", lat: 51.8747, lon: -0.3683 },
  MAN: { city: "Manchester", name: "Manchester Airport", lat: 53.3537, lon: -2.2750 },
  EDI: { city: "Edinburgh", name: "Edinburgh Airport", lat: 55.9500, lon: -3.3725 },
  DUB: { city: "Dublin", name: "Dublin Airport", lat: 53.4264, lon: -6.2499 },
  GRU: { city: "São Paulo", name: "Guarulhos Int'l", lat: -23.4356, lon: -46.4731 },
  BOM: { city: "Mumbai", name: "Chhatrapati Shivaji Int'l", lat: 19.0896, lon: 72.8656 },
  ICN: { city: "Seoul", name: "Incheon Int'l", lat: 37.4602, lon: 126.4407 },
  KUL: { city: "Kuala Lumpur", name: "Kuala Lumpur Int'l", lat: 2.7456, lon: 101.7099 },
  JFK: { city: "New York", name: "John F. Kennedy Int'l", lat: 40.6413, lon: -73.7781 },
  LAX: { city: "Los Angeles", name: "Los Angeles Int'l", lat: 33.9416, lon: -118.4085 },
  DXB: { city: "Dubai", name: "Dubai Int'l", lat: 25.2532, lon: 55.3657 },
  CDG: { city: "Paris", name: "Charles de Gaulle", lat: 49.0097, lon: 2.5479 },
  AMS: { city: "Amsterdam", name: "Schiphol Airport", lat: 52.3105, lon: 4.7683 },
  MAD: { city: "Madrid", name: "Barajas Airport", lat: 40.4839, lon: -3.5680 },
  BCN: { city: "Barcelona", name: "El Prat Airport", lat: 41.2974, lon: 2.0785 }
};

// ICAO prefix to IATA code map for reliable logo rendering
const ICAO_TO_IATA = {
  BAW: "BA", RYR: "FR", EZY: "U2", VIR: "VS", SWR: "LX",
  DLH: "LH", UAE: "EK", QFA: "QF", AAL: "AA", DAL: "DL",
  UAL: "UA", AFR: "AF", KLM: "KL", SAS: "SK", FIN: "AY",
  THY: "TK", TAP: "TP", AZA: "AZ", EIN: "EI", TAM: "JJ",
  SWA: "WN", ACA: "AC", QTR: "QR", ETD: "EY"
};

function getDistanceInMiles(lat1, lon1, lat2, lon2) {
  if (!lat2 || !lon2) return "0.0";
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

async function getRoute(callsign) {
  if (!callsign || callsign === "PRIVATE") return { origin: "N/A", dest: "N/A", destLat: null, destLon: null };
  try {
    const res = await fetch(`https://api.adsbdb.com/v0/callsign/${callsign.trim()}`);
    if (res.ok) {
      const data = await res.json();
      const flightRoute = data?.response?.flightroute;
      if (flightRoute?.origin?.iata_code && flightRoute?.destination?.iata_code) {
        return {
          origin: flightRoute.origin.iata_code,
          dest: flightRoute.destination.iata_code,
          destLat: flightRoute.destination.latitude || null,
          destLon: flightRoute.destination.longitude || null
        };
      }
    }
  } catch (e) {}
  return { origin: "N/A", dest: "N/A", destLat: null, destLon: null };
}

function getAirportInfo(code) {
  if (!code || code === "N/A" || code === "???") {
    return { code: "N/A", city: "Unknown", name: "Airport Info N/A", lat: null, lon: null };
  }
  const clean = code.trim().toUpperCase();
  const info = AIRPORT_DB[clean] || { city: clean, name: `${clean} Airport`, lat: null, lon: null };
  return { code: clean, ...info };
}

// Calculate actual remaining time to destination airport
function calculateTimeToDest(planeLat, planeLon, destObj, speedKnots) {
  if (!speedKnots || speedKnots < 50) return "N/A";
  
  let targetLat = destObj.destLat || destObj.lat;
  let targetLon = destObj.destLon || destObj.lon;
  
  if (!targetLat || !targetLon) return "N/A";

  const distToDestMiles = parseFloat(getDistanceInMiles(planeLat, planeLon, targetLat, targetLon));
  const speedMph = speedKnots * 1.15078;
  const hours = distToDestMiles / speedMph;
  const minutes = Math.round(hours * 60);

  if (minutes < 60) return `${minutes} mins`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m < 10 ? '0' : ''}${m}m`;
}

// Returns logo CDN URL using IATA lookup first, then Flightradar24 fallback
function getAirlineLogoUrl(callsign) {
  if (!callsign || callsign.length < 3) return null;
  const icao = callsign.substring(0, 3).toUpperCase();
  const iata = ICAO_TO_IATA[icao];

  if (iata) {
    return `https://images.kiwi.com/airlines/64/${iata}.png`;
  }
  return `https://www.flightradar24.com/static/images/data/operators/${icao}_logo.png`;
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

  map = L.map('map').setView([HOME_LAT, HOME_LON], 10);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    maxZoom: 19
  }).addTo(map);

  L.circleMarker([HOME_LAT, HOME_LON], {
    radius: 7,
    fillColor: '#ffffff',
    color: '#38bdf8',
    weight: 3,
    opacity: 1,
    fillOpacity: 1
  }).addTo(map).bindPopup("Radar Center");
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

    const cardsHtml = await Promise.all(flights.map(async (f, idx) => {
      const isClosest = idx === 0;
      const routeInfo = await getRoute(f.callsign);
      
      const orig = getAirportInfo(routeInfo.origin);
      const dest = {
        ...getAirportInfo(routeInfo.dest),
        destLat: routeInfo.destLat,
        destLon: routeInfo.destLon
      };

      const timeToDest = calculateTimeToDest(f.lat, f.lon, dest, f.speed);
      const logoUrl = getAirlineLogoUrl(f.callsign);

      if (isClosest) {
        const photoUrl = await getPlanePhotoUrl(f.reg);

        return `
          <div class="flight-card featured-card" id="card-${f.hex}" style="--accent-color: ${f.color};">
            <div class="featured-badge">⚡ CLOSEST IN RANGE</div>
            
            <div class="card-header">
              <div class="callsign-box">
                <span class="callsign">${f.callsign}</span>
                ${logoUrl ? `<img src="${logoUrl}" class="airline-logo" alt="Airline" referrerpolicy="no-referrer" onerror="this.style.display='none'">` : ''}
              </div>
              <div class="ac-type">${f.type} ${f.reg ? `(${f.reg})` : ''}</div>
            </div>

            <div class="featured-media">
              <img src="${photoUrl}" class="plane-photo" alt="Aircraft photo" onerror="this.src='https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=300&q=80'">
              <div class="route-panel">
                <div class="route-airports">
                  <div class="airport-node">
                    <div class="airport-code">${orig.code}</div>
                    <div class="airport-name">${orig.name}</div>
                    <div class="airport-city">${orig.city}</div>
                  </div>
                  <div class="route-arrow">✈️</div>
                  <div class="airport-node" style="text-align: right;">
                    <div class="airport-code">${dest.code}</div>
                    <div class="airport-name">${dest.name}</div>
                    <div class="airport-city">${dest.city}</div>
                  </div>
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
      } else {
        return `
          <div class="flight-card" id="card-${f.hex}" style="--accent-color: ${f.color};">
            <div class="card-header">
              <div class="callsign-box">
                <span class="callsign">${f.callsign}</span>
                ${logoUrl ? `<img src="${logoUrl}" class="airline-logo" alt="Airline" referrerpolicy="no-referrer" onerror="this.style.display='none'">` : ''}
              </div>
              <div class="ac-type">${f.type} ${f.reg ? `(${f.reg})` : ''}</div>
            </div>

            <div class="route-panel">
              <div class="route-airports">
                <div class="airport-node">
                  <span class="airport-code">${orig.code}</span>
                  <span class="airport-city"> (${orig.city})</span>
                </div>
                <div class="route-arrow">✈️</div>
                <div class="airport-node" style="text-align: right;">
                  <span class="airport-code">${dest.code}</span>
                  <span class="airport-city"> (${dest.city})</span>
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
