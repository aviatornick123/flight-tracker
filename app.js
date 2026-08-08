// Home Coordinates (Wokingham area)
const HOME_LAT = 51.41;
const HOME_LON = -0.83;
const BOUNDING_BOX = { lamin: 51.30, lomin: -1.05, lamax: 51.52, lomax: -0.63 };

// ICAO 3-letter to IATA 2-letter mapping
const ICAO_TO_IATA = {
  BAW: "BA", ACA: "AC", EIN: "EI", EZY: "U2", EJU: "EC",
  RYR: "FR", VIR: "VS", DLH: "LH", AAL: "AA", DAL: "DL",
  UAE: "EK", QTR: "QR", SWR: "LX", KLM: "KL", AFR: "AF"
};

function getDistanceInMiles(lat1, lon1, lat2, lon2) {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return (R * c).toFixed(1);
}

function getLogoUrl(callsign) {
  if (!callsign) return "";
  const trimmed = callsign.trim();
  const icao = trimmed.substring(0, 3).toUpperCase();
  const iata = ICAO_TO_IATA[icao] || trimmed.substring(0, 2).toUpperCase();
  return `https://pics.avs.io/200/80/${iata}.png`;
}

function updateClock() {
  const timeEl = document.getElementById("current-time");
  if (timeEl) {
    timeEl.innerText = new Date().toLocaleTimeString();
  }
}

async function fetchFlights() {
  const grid = document.getElementById("flight-grid");
  if (!grid) return;

  const targetUrl = `https://opensky-network.org/api/states/all?lamin=${BOUNDING_BOX.lamin}&lomin=${BOUNDING_BOX.lomin}&lamax=${BOUNDING_BOX.lamax}&lomax=${BOUNDING_BOX.lomax}`;
  const url = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
    
    const data = await response.json();

    if (!data.states || data.states.length === 0) {
      grid.innerHTML = '<div class="loading-state">No active aircraft within 15 miles</div>';
      return;
    }

    const flights = data.states
      .map(state => {
        const callsign = state[1] ? state[1].trim() : "PRIVATE";
        const lon = state[5];
        const lat = state[6];
        const altMeters = state[7] || 0;
        const velocityMS = state[9] || 0;
        const country = state[2] || "Unknown";

        const distance = (lat && lon) ? parseFloat(getDistanceInMiles(HOME_LAT, HOME_LON, lat, lon)) : 999;
        const altFeet = Math.round(altMeters * 3.28084);
        const speedKnots = Math.round(velocityMS * 1.94384);

        return { callsign, country, distance, altFeet, speedKnots };
      })
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 4);

    grid.innerHTML = flights.map(f => `
      <div class="flight-card">
        <div class="card-top">
          <div>
            <div class="callsign">${f.callsign}</div>
            <div class="country">${f.country}</div>
          </div>
          <div class="logo-badge">
            <img src="${getLogoUrl(f.callsign)}" 
                 alt="${f.callsign}" 
                 onerror="this.style.display='none'" />
          </div>
        </div>
        <div class="telemetry">
          <div>
            <div class="metric-label">Distance</div>
            <div class="metric-value">${f.distance} mi</div>
          </div>
          <div>
            <div class="metric-label">Altitude</div>
            <div class="metric-value">${f.altFeet.toLocaleString()} ft</div>
          </div>
          <div>
            <div class="metric-label">Speed</div>
            <div class="metric-value">${f.speedKnots} kts</div>
          </div>
        </div>
      </div>
    `).join('');

  } catch (err) {
    console.error("Fetch error:", err);
    grid.innerHTML = '<div class="loading-state">Connecting to radar...</div>';
  }
}

setInterval(updateClock, 1000);
updateClock();

fetchFlights();
setInterval(fetchFlights, 12000);