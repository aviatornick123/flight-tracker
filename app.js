const HOME_LAT = 51.41;
const HOME_LON = -0.83;
const RADIUS_NM = 20;

let map;
let aircraftMarkers = {};

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
  DXB: { city: "Dubai", name: "Dubai International" },
  CDG: { city: "Paris", name: "Charles de Gaulle" }
};

// Calculate distance in miles between coordinates
function getDistanceInMiles(lat1, lon1, lat2, lon2) {
  if (!lat2 || !lon2) return "0.0";
  const R = 3958.8; // Radius of Earth in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return (R * c).toFixed(1);
}

// Fetch live route data with safe fallback
async function getRoute(callsign, hex) {
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
  } catch (e) {
    // API timeout or network fallback
  }
  return "N/A ✈️ N/A";
}

function getAirportInfo(code) {
  if (!code || code === "N/A" || code === "???") {
    return { code: "N/A", city: "Unknown City", name: "Unknown Airport" };
  }
  const clean = code.trim().toUpperCase();
  const info = AIRPORT_DB[clean] || { city: clean, name: `${clean} Airport` };
  return { code: clean, ...info };
}

function calculateETA(distanceMiles, speedKnots) {
  if (!speedKnots || speedKnots < 50) return "N/A";
  const hours = distanceMiles / (speedKnots * 1.15078);
  const minutes = Math.round(hours * 60);
  if (minutes < 60) return `~${minutes}m en route`;
  return `~${Math.floor(minutes / 60)}h ${minutes % 60}m`;
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

  // Home marker dot
  L.circleMarker([HOME_LAT, HOME_LON], {
    radius: 8,
    fillColor: '#38bdf8',
    color: '#ffffff',
    weight: 2,
    opacity: 1,
    fillOpacity: 0.8
  }).addTo(map).bindPopup("Radar Center");
}

function updateMapMarkers(flights) {
  if (!map) return;

  const currentHexes = new Set();

  flights.forEach(f => {
    currentHexes.add(f.hex);

    if (aircraftMarkers[f.hex]) {
      aircraftMarkers[f.hex].setLatLng([f.lat, f.lon]);
    } else {
      const marker = L.circleMarker([f.lat, f.lon], {
        radius: 6,
        fillColor: '#fbbf24',
        color: '#ffffff',
        weight: 1,
        opacity: 1,
        fillOpacity: 0.9
      }).addTo(map);

      marker.bindPopup(`<b>${f.callsign}</b><br>${f.type}<br>Alt: ${f.alt.toLocaleString()} ft`);
      aircraftMarkers[f.hex] = marker;
    }
  });

  // Remove markers for aircraft that moved out of range
  Object.keys(aircraftMarkers).forEach(hex => {
    if (!currentHexes.has(hex)) {
      map.removeLayer(aircraftMarkers[hex]);
      delete aircraftMarkers[hex];
    }
  });
}

async function fetchFlights() {
  const grid = document.getElementById("flight-grid");
  if (!grid) return;

  try {
    const res = await fetch(`https://api.airplanes.live/v2/point/${HOME_LAT}/${HOME_LON}/${RADIUS_NM}`);
    if (!res.ok) throw new Error("API network response was not ok");
    
    const data = await res.json();

    if (!data.ac || data.ac.length === 0) {
      grid.innerHTML = '<div class="loading-state">No airborne aircraft within radar range</div>';
      return;
    }

    // Filter airborne aircraft & sort by closest distance
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
      .sort((a, b) => a.distance - b.distance);

    updateMapMarkers(flights);

    const cardsHtml = await Promise.all(flights.map(async (f, idx) => {
      const isClosest = idx === 0;
      const routeData = await getRoute(f.callsign, f.hex);
      const parts = routeData.split("✈️").map(s => s.trim());
      
      const orig = getAirportInfo(parts[0]);
      const dest = getAirportInfo(parts[1]);
      const eta = calculateETA(f.distance, f.speed);

      return `
        <div class="flight-card ${isClosest ? 'featured-card' : ''}" id="card-${f.hex}">
          ${isClosest ? '<div class="featured-badge">⚡ CLOSEST IN RANGE</div>' : ''}
          
          <div class="card-top">
            <div>
              <div class="callsign-header">
                <span class="callsign">${f.callsign}</span>
              </div>
              <div class="ac-type">${f.type} ${f.reg ? `(${f.reg})` : ''}</div>
            </div>
          </div>

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
              <div class="metric-label">Est. Time</div>
              <div class="metric-value" style="color:#38bdf8;">${eta}</div>
            </div>
          </div>
        </div>
      `;
    }));

    grid.innerHTML = cardsHtml.join('');
  } catch (e) {
    console.error("Flight fetch error:", e);
    grid.innerHTML = '<div class="loading-state">Error loading live radar data. Retrying...</div>';
  }
}

// Automatic Initialization on Page Load
document.addEventListener("DOMContentLoaded", () => {
  initMap();
  updateClock();
  setInterval(updateClock, 1000);
  fetchFlights();
  setInterval(fetchFlights, 10000);
});
