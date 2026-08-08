const HOME_LAT = 51.41;
const HOME_LON = -0.83;
const RADIUS_NM = 15;

let map, homeMarker;
let aircraftMarkers = {};

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

function getHeadingDirection(track) {
  if (track === undefined || track === null) return "N/A";
  const dirs = ["N ⬆️", "NE ↗️", "E ➡️", "SE ↘️", "S ⬇️", "SW ↙️", "W ⬅️", "NW ↖️"];
  const index = Math.round(track / 45) % 8;
  return `${Math.round(track)}° ${dirs[index]}`;
}

async function getAircraftPhoto(registration) {
  if (!registration) return null;
  try {
    const res = await fetch(`https://api.planespotters.net/pub/photos/reg/${registration.trim()}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.photos && data.photos.length > 0) {
      return data.photos[0].thumbnail_large.src;
    }
  } catch (e) {
    console.error("Photo fetch error:", e);
  }
  return null;
}

function initMap() {
  if (map) return;
  map = L.map('map').setView([HOME_LAT, HOME_LON], 10);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    maxZoom: 19
  }).addTo(map);

  homeMarker = L.circleMarker([HOME_LAT, HOME_LON], {
    color: '#38bdf8',
    fillColor: '#38bdf8',
    fillOpacity: 0.8,
    radius: 8
  }).addTo(map).bindPopup("<b>Home Radar</b>");
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

  const url = `https://api.airplanes.live/v2/point/${HOME_LAT}/${HOME_LON}/${RADIUS_NM}`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
    const data = await response.json();

    if (!data.ac || data.ac.length === 0) {
      grid.innerHTML = '<div class="loading-state">No active aircraft within range</div>';
      return;
    }

    const sortedFlights = data.ac
      .map(ac => {
        const callsign = ac.flight ? ac.flight.trim() : "PRIVATE";
        const reg = ac.r || "";
        const type = ac.t || "Aircraft";
        const lat = ac.lat;
        const lon = ac.lon;
        const altFeet = typeof ac.alt_baro === "number" ? ac.alt_baro : (ac.alt_geom || 0);
        const speedKnots = Math.round(ac.gs || 0);
        const heading = getHeadingDirection(ac.track);
        const distance = (lat && lon) ? parseFloat(getDistanceInMiles(HOME_LAT, HOME_LON, lat, lon)) : 999;

        return { callsign, reg, type, lat, lon, altFeet, speedKnots, heading, distance };
      })
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 4);

    // Update Map Markers
    Object.keys(aircraftMarkers).forEach(key => map.removeLayer(aircraftMarkers[key]));
    aircraftMarkers = {};

    sortedFlights.forEach(f => {
      if (f.lat && f.lon) {
        const marker = L.marker([f.lat, f.lon]).addTo(map)
          .bindPopup(`<b>${f.callsign}</b><br>${f.type}<br>Alt: ${f.altFeet} ft`);
        aircraftMarkers[f.callsign] = marker;
      }
    });

    // Build Cards & Fetch Photos
    const cardsHtml = await Promise.all(sortedFlights.map(async f => {
      const photoUrl = await getAircraftPhoto(f.reg);
      const imgHtml = photoUrl 
        ? `<img class="plane-img" src="${photoUrl}" alt="${f.type}" />`
        : `<div class="plane-img" style="display:flex;align-items:center;justify-content:center;color:#475569;font-size:0.75rem;">No Photo</div>`;

      return `
        <div class="flight-card">
          <div class="card-top">
            <div>
              <div class="callsign">${f.callsign}</div>
              <div class="ac-type">${f.type} ${f.reg ? `(${f.reg})` : ''}</div>
            </div>
            ${imgHtml}
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
            <div>
              <div class="metric-label">Heading</div>
              <div class="metric-value">${f.heading}</div>
            </div>
          </div>
        </div>
      `;
    }));

    grid.innerHTML = cardsHtml.join('');

  } catch (err) {
    console.error("Fetch error:", err);
  }
}

setInterval(updateClock, 1000);
updateClock();

initMap();
fetchFlights();
setInterval(fetchFlights, 12000);
