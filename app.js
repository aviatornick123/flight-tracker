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

function getAirportInfo(code) {
  if (!code || code === "N/A") return { code: "???", city: "Unknown", name: "Unknown Airport" };
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

function initMap() {
  if (map) return;
  map = L.map('map').setView([HOME_LAT, HOME_LON], 10);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO'
  }).addTo(map);
}

async function fetchFlights() {
  const grid = document.getElementById("flight-grid");
  if (!grid) return;

  try {
    const res = await fetch(`https://api.airplanes.live/v2/point/${HOME_LAT}/${HOME_LON}/${RADIUS_NM}`);
    const data = await res.json();

    if (!data.ac || data.ac.length === 0) {
      grid.innerHTML = '<div class="loading-state">No airborne aircraft within radar range</div>';
      return;
    }

    // Filter airborne flights & sort by distance
    const flights = data.ac
      .filter(ac => ac.alt_baro !== "ground" && (ac.alt_baro || 0) > 200)
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

    const cardsHtml = await Promise.all(flights.map(async (f, idx) => {
      const isClosest = idx === 0;
      const routeData = await getRoute(f.callsign, f.hex); // Returns e.g. "LHR ✈️ GRU" or "Route N/A"
      const parts = routeData.split("✈️").map(s => s.trim());
      
      const orig = getAirportInfo(parts[0]);
      const dest = getAirportInfo(parts[1]);
      const eta = calculateETA(f.distance, f.speed);

      return `
        <div class="flight-card ${isClosest ? 'featured-card' : ''}" id="card-${f.callsign}">
          ${isClosest ? '<div class="featured-badge">⚡ CLOSEST IN RANGE</div>' : ''}
          
          <div class="card-top">
            <div>
              <div class="callsign-header">
                <span class="callsign">${f.callsign}</span>
              </div>
              <div class="ac-type">${f.type} ${f.reg ? `(${f.reg})` : ''}</div>
            </div>
          </div>

          <!-- Expanded Origin & Destination Panel -->
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
  }
}
