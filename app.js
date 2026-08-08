const HOME_LAT = 51.41;
const HOME_LON = -0.83;
const RADIUS_NM = 15;

let map, homeMarker;
let aircraftMarkers = {};
let flightTrails = {};
let trailPolylines = {};

const routeCache = {};
const photoCache = {};

// Palette used to color-code each flight card and its matching plane on the map
const FLIGHT_PALETTE = [
  { main: "#38bdf8", border: "#0284c7", text: "#38bdf8" }, // Flight #1: Cyan
  { main: "#f59e0b", border: "#d97706", text: "#fbbf24" }, // Flight #2: Amber
  { main: "#c084fc", border: "#9333ea", text: "#c084fc" }, // Flight #3: Purple
  { main: "#34d399", border: "#059669", text: "#34d399" }  // Flight #4: Emerald
];

const ICAO_TO_IATA = {
  BAW: "BA", ACA: "AC", EIN: "EI", EZY: "U2", EJU: "EC",
  RYR: "FR", VIR: "VS", DLH: "LH", AAL: "AA", DAL: "DL",
  UAE: "EK", QTR: "QR", SWR: "LX", KLM: "KL", AFR: "AF", RUK: "RK", TOM: "BY", AIC: "AI"
};

const TYPE_NAMES = {
  B738: "Boeing 737-800",
  B739: "Boeing 737-900",
  B772: "Boeing 777-200",
  B789: "Boeing 787-9 Dreamliner",
  A320: "Airbus A320",
  A20N: "Airbus A320neo",
  A321: "Airbus A321",
  A359: "Airbus A350-900",
  A388: "Airbus A380-800",
  PC12: "Pilatus PC-12",
  P28A: "Piper PA-28 Cherokee",
  DA42: "Diamond DA42 Twin Star",
  C172: "Cessna 172 Skyhawk"
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

function getHeadingDirection(track) {
  if (track === undefined || track === null) return "N/A";
  const dirs = ["N ⬆️", "NE ↗️", "E ➡️", "SE ↘️", "S ⬇️", "SW ↙️", "W ⬅️", "NW ↖️"];
  const index = Math.round(track / 45) % 8;
  return `${Math.round(track)}° ${dirs[index]}`;
}

function getLogoUrl(callsign) {
  if (!callsign) return "";
  const trimmed = callsign.trim();
  const icao = trimmed.substring(0, 3).toUpperCase();
  const iata = ICAO_TO_IATA[icao] || trimmed.substring(0, 2).toUpperCase();
  return `https://pics.avs.io/200/80/${iata}.png`;
}

function createPlaneMarkerIcon(heading, theme, index, callsign) {
  const angle = heading || 0;
  const html = `
    <div class="plane-marker-wrapper">
      <div class="plane-svg-icon" style="transform: rotate(${angle}deg);">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="${theme.main}" stroke="#0b0f17" stroke-width="1.5">
          <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
        </svg>
      </div>
      <div class="plane-marker-tag" style="background-color: ${theme.main}; color: #0b0f17;">
        #${index + 1} ${callsign}
      </div>
    </div>`;

  return L.divIcon({
    html: html,
    className: 'custom-plane-marker',
    iconSize: [60, 50],
    iconAnchor: [30, 20]
  });
}

async function getAircraftPhoto(registration) {
  if (!registration) return null;
  const regClean = registration.trim();
  if (photoCache[regClean] !== undefined) return photoCache[regClean];

  try {
    const res = await fetch(`https://api.planespotters.net/pub/photos/reg/${regClean}`);
    if (!res.ok) {
      photoCache[regClean] = null;
      return null;
    }
    const data = await res.json();
    if (data.photos && data.photos.length > 0) {
      const src = data.photos[0].thumbnail_large.src;
      photoCache[regClean] = src;
      return src;
    }
  } catch (e) {
    console.error("Photo error:", e);
  }
  photoCache[regClean] = null;
  return null;
}

async function getRoute(callsign, hex) {
  if (!callsign || callsign === "PRIVATE") return "Route N/A";
  const clean = callsign.trim().toUpperCase();

  if (routeCache[clean]) return routeCache[clean];

  const proxy = "https://corsproxy.io/?";

  // Method 1: HexDB by Callsign via Proxy
  try {
    const res = await fetch(`${proxy}${encodeURIComponent(`https://hexdb.io/api/v1/route/icao/${clean}`)}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.origin && data.destination) {
        const routeStr = `${data.origin} ✈️ ${data.destination}`;
        routeCache[clean] = routeStr;
        return routeStr;
      }
    }
  } catch (e) {}

  // Method 2: ADSB.lol via Proxy
  try {
    const res = await fetch(`${proxy}${encodeURIComponent(`https://api.adsb.lol/v2/callsign/${clean}`)}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.route) {
        const orig = data.route._origin || data.route.origin?.iata || data.route.origin?.icao || "";
        const dest = data.route._destination || data.route.destination?.iata || data.route.destination?.icao || "";
        if (orig && dest) {
          const routeStr = `${orig} ✈️ ${dest}`;
          routeCache[clean] = routeStr;
          return routeStr;
        }
      }
    }
  } catch (e) {}

  // Method 3: ADSBdb API via Proxy
  try {
    const res = await fetch(`${proxy}${encodeURIComponent(`https://api.adsbdb.com/v0/callsign/${clean}`)}`);
    if (res.ok) {
      const data = await res.json();
      const flight = data?.response?.flightroute;
      if (flight && flight.origin?.iata_code && flight.destination?.iata_code) {
        const routeStr = `${flight.origin.iata_code} ✈️ ${flight.destination.iata_code}`;
        routeCache[clean] = routeStr;
        return routeStr;
      }
    }
  } catch (e) {}

  routeCache[clean] = "Route N/A";
  return "Route N/A";
}

function highlightCard(callsign) {
  const card = document.getElementById(`card-${callsign}`);
  if (card) {
    card.classList.add('highlighted');
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function unhighlightCard(callsign) {
  const card = document.getElementById(`card-${callsign}`);
  if (card) {
    card.classList.remove('highlighted');
  }
}

function highlightMarker(callsign) {
  if (aircraftMarkers[callsign]) {
    aircraftMarkers[callsign].openPopup();
  }
}

function unhighlightMarker(callsign) {
  if (aircraftMarkers[callsign]) {
    aircraftMarkers[callsign].closePopup();
  }
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
  }).addTo(map).bindPopup("<b>Home Radar (Wokingham)</b>");
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
      grid.innerHTML = '<div class="loading-state">No airborne aircraft within range</div>';
      return;
    }

    const activeCallsigns = new Set();

    // Filter out ground planes and parse airborne flights
    const sortedFlights = data.ac
      .filter(ac => {
        const isGround =
          ac.alt_baro === "ground" ||
          ac.alt_geom === "ground" ||
          ac.gnd === 1 ||
          (typeof ac.alt_baro === "number" && ac.alt_baro < 150 && (ac.gs || 0) < 35);
        return !isGround;
      })
      .map(ac => {
        const callsign = ac.flight ? ac.flight.trim() : "PRIVATE";
        const hex = ac.hex || "";
        const reg = ac.r || "";
        const typeCode = ac.t || "Aircraft";
        const fullType = ac.desc || TYPE_NAMES[typeCode] || typeCode;
        const lat = ac.lat;
        const lon = ac.lon;
        const track = ac.track || 0;
        const altFeet = typeof ac.alt_baro === "number" ? ac.alt_baro : (ac.alt_geom || 0);
        const speedKnots = Math.round(ac.gs || 0);
        const vertRate = ac.baro_rate || ac.geom_rate || 0;
        const heading = getHeadingDirection(track);
        const distance = (lat && lon) ? parseFloat(getDistanceInMiles(HOME_LAT, HOME_LON, lat, lon)) : 999;

        return { callsign, hex, reg, typeCode, fullType, lat, lon, track, altFeet, speedKnots, vertRate, heading, distance };
      })
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 4);

    if (sortedFlights.length === 0) {
      grid.innerHTML = '<div class="loading-state">No airborne aircraft within range</div>';
      
      // Clear all existing map markers
      Object.keys(aircraftMarkers).forEach(cs => {
        map.removeLayer(aircraftMarkers[cs]);
        delete aircraftMarkers[cs];
        if (trailPolylines[cs]) {
          map.removeLayer(trailPolylines[cs]);
          delete trailPolylines[cs];
        }
        delete flightTrails[cs];
      });
      return;
    }

    // Update Map Markers & Trails with distinct color themes
    sortedFlights.forEach((f, idx) => {
      if (f.lat && f.lon) {
        activeCallsigns.add(f.callsign);
        const theme = FLIGHT_PALETTE[idx % FLIGHT_PALETTE.length];

        // Marker Creation & Updates
        if (aircraftMarkers[f.callsign]) {
          aircraftMarkers[f.callsign].setLatLng([f.lat, f.lon]);
          aircraftMarkers[f.callsign].setIcon(createPlaneMarkerIcon(f.track, theme, idx, f.callsign));
        } else {
          const marker = L.marker([f.lat, f.lon], {
            icon: createPlaneMarkerIcon(f.track, theme, idx, f.callsign)
          }).addTo(map).bindPopup(`<b>#${idx + 1} ${f.callsign}</b><br>${f.fullType}<br>Alt: ${f.altFeet.toLocaleString()} ft`);

          marker.on('mouseover', () => highlightCard(f.callsign));
          marker.on('mouseout', () => unhighlightCard(f.callsign));

          aircraftMarkers[f.callsign] = marker;
        }

        // Trail Polyline
        if (!flightTrails[f.callsign]) {
          flightTrails[f.callsign] = [];
        }
        flightTrails[f.callsign].push([f.lat, f.lon]);
        if (flightTrails[f.callsign].length > 20) flightTrails[f.callsign].shift();

        if (trailPolylines[f.callsign]) {
          trailPolylines[f.callsign].setLatLngs(flightTrails[f.callsign]);
          trailPolylines[f.callsign].setStyle({ color: theme.main });
        } else {
          trailPolylines[f.callsign] = L.polyline(flightTrails[f.callsign], {
            color: theme.main,
            weight: 3,
            opacity: 0.85,
            dashArray: '5, 5'
          }).addTo(map);
        }
      }
    });

    // Clean up stale markers/trails
    Object.keys(aircraftMarkers).forEach(cs => {
      if (!activeCallsigns.has(cs)) {
        map.removeLayer(aircraftMarkers[cs]);
        delete aircraftMarkers[cs];
        if (trailPolylines[cs]) {
          map.removeLayer(trailPolylines[cs]);
          delete trailPolylines[cs];
        }
        delete flightTrails[cs];
      }
    });

    // Build Cards with Matching Color Palette
    const cardsHtml = await Promise.all(sortedFlights.map(async (f, idx) => {
      const [photoUrl, route] = await Promise.all([
        getAircraftPhoto(f.reg),
        getRoute(f.callsign, f.hex)
      ]);

      const logoUrl = getLogoUrl(f.callsign);
      const theme = FLIGHT_PALETTE[idx % FLIGHT_PALETTE.length];
      
      let altTrend = "";
      if (f.vertRate > 250) altTrend = " ⬆️";
      else if (f.vertRate < -250) altTrend = " ⬇️";

      const imgHtml = photoUrl 
        ? `<img class="plane-img" src="${photoUrl}" alt="${f.fullType}" />`
        : `<div class="plane-img" style="display:flex;align-items:center;justify-content:center;color:#475569;font-size:0.75rem;">No Photo</div>`;

      return `
        <div class="flight-card" id="card-${f.callsign}" 
             style="border-left: 6px solid ${theme.main};" 
             onmouseover="highlightMarker('${f.callsign}')" 
             onmouseout="unhighlightMarker('${f.callsign}')">
          <div class="card-top">
            <div>
              <div class="callsign-header">
                <span class="index-badge" style="background-color: ${theme.main}; color: #0b0f17;">#${idx + 1}</span>
                <span class="callsign">${f.callsign}</span>
                <img class="airline-logo" src="${logoUrl}" onerror="this.style.display='none'" />
              </div>
              <div class="ac-type">${f.fullType} ${f.reg ? `(${f.reg})` : ''}</div>
              <div class="route-badge">${route}</div>
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
              <div class="metric-value" style="color: ${theme.main};">${f.altFeet.toLocaleString()} ft${altTrend}</div>
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
