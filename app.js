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

const AIRPORT_DB = {
  LHR: { city: "London", name: "Heathrow Airport" },
  LGW: { city: "London", name: "Gatwick Airport" },
  STN: { city: "London", name: "Stansted Airport" },
  LTN: { city: "London", name: "Luton Airport" },
  GRU: { city: "São Paulo", name: "Guarulhos Int'l" },
  BOM: { city: "Mumbai", name: "Chhatrapati Shivaji Int'l" },
  ICN: { city: "Seoul", name: "Incheon Int'l" },
  KUL: { city: "Kuala Lumpur", name: "Kuala Lumpur Int'l" },
  JFK: { city: "New York", name: "John F. Kennedy Int'l" },
  LAX: { city: "Los Angeles", name: "Los Angeles Int'l" },
  DXB: { city: "Dubai", name: "Dubai Int'l" },
  CDG: { city: "Paris", name: "Charles de Gaulle" }
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
  if (!callsign || callsign === "PRIVATE") return "N/A ✈️ N/A";
  try {
    const res = await fetch(`https://api.adsbdb.com/v0/callsign/${callsign.trim()}`);
    if (res.ok) {
      const data = await res.json();
      const flightRoute = data?.response?.flightroute;
      if (flightRoute?.origin?.iata_code && flightRoute?.destination?.iata_code) {
        return `${flightRoute.origin.iata_code} ✈️ ${flightRoute.destination.iata_code}`;
      }
    }
  } catch (e) {}
  return "N/A ✈️ N/A";
}

function getAirportInfo(code) {
  if (!code || code === "N/A" || code === "???") {
    return { code: "N/A", city: "Unknown", name: "Airport Info N/A" };
  }
  const clean = code.trim().toUpperCase();
  const info = AIRPORT_DB[clean] || { city: clean, name: `${clean} Airport` };
  return { code: clean, ...info };
}

function calculateTimeToDest(distanceMiles, speedKnots) {
  if (!speedKnots || speedKnots < 50) return "N/A";
  const speedMph = speedKnots * 1.15078;
  const hours = distanceMiles / speedMph;
  const minutes = Math.round(hours * 60);
  if (minutes < 60) return `${minutes} mins`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function getAirlineLogoUrl(callsign) {
  if (!callsign || callsign.length < 3) return null;
  const icao = callsign.substring(0, 3).toUpperCase();
  if (/^[A-Z]{3}$/.test(icao)) {
    return `https://www.flightradar24.com/static/images/data/operators/${icao}_logo.png`;
  }
  return null;
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

// Rotated Airplane SVG Icon generator for Leaflet
function createPlaneSvgIcon(heading, color, isFeatured) {
  const size = isFeatured ? 30 : 22;
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

  // Home marker
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

    // Track position history for flight path polylines
    if (!aircraftHistory[f.hex]) {
      aircraftHistory[f.hex] = [];
    }
    const history = aircraftHistory[f.hex];
    if (history.length === 0 || history[history.length - 1][0] !== f.lat || history[history.length - 1][1] !== f.lon) {
      history.push([f.lat, f.lon]);
      if (history.length > 20) history.shift();
    }

    // Update or create Rotated Airplane Marker
    const icon = createPlaneSvgIcon(f.heading, f.color, isFeatured);
    if (aircraftMarkers[f.hex]) {
      aircraftMarkers[f.hex].setLatLng([f.lat, f.lon]);
      aircraftMarkers[f.hex].setIcon(icon);
    } else {
      const marker = L.marker([f.lat, f.lon], { icon }).addTo(map);
      marker.bindPopup(`<b>${f.callsign}</b><br>${f.type}<br>Alt: ${f.alt.toLocaleString()} ft<br>Speed: ${f.speed} kts`);
      aircraftMarkers[f.hex] = marker;
    }

    // Update or create Flight Path Polyline matching card color
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

  // Cleanup markers and flight paths for out-of-range aircraft
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

    // Filter airborne aircraft & sort by proximity
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
      const routeData = await getRoute(f.callsign);
      const parts = routeData.split("✈️").map(s => s.trim());
      
      const orig = getAirportInfo(parts[0]);
      const dest = getAirportInfo(parts[1]);
      const timeToDest = calculateTimeToDest(f.distance, f.speed);
      const logoUrl = getAirlineLogoUrl(f.callsign);

      if (isClosest) {
        const photoUrl = await getPlanePhotoUrl(f.reg);

        return `
          <div class="flight-card featured-card" id="card-${f.hex}" style="--accent-color: ${f.color};">
            <div class="featured-badge">⚡ CLOSEST IN RANGE</div>
            
            <div class="card-header">
              <div class="callsign-box">
                <span class="callsign">${f.callsign}</span>
                ${logoUrl ? `<img src="${logoUrl}" class="airline-logo" alt="Airline" onerror="this.style.display='none'">` : ''}
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
        // Compact Non-Featured Flight Card
        return `
          <div class="flight-card" id="card-${f.hex}" style="--accent-color: ${f.color};">
            <div class="card-header">
              <div class="callsign-box">
                <span class="callsign">${f.callsign}</span>
                ${logoUrl ? `<img src="${logoUrl}" class="airline-logo" alt="Airline" onerror="this.style.display='none'">` : ''}
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
