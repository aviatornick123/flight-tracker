// 1. Updated map view targeting the Wokingham -> Heathrow corridor
function initMap() {
  const mapContainer = document.getElementById('map');
  if (!mapContainer || map) return;

  // Centered between Wokingham (51.41, -0.83) and Heathrow (51.47, -0.45) at Zoom Level 11
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
}

// 2. Streamlined Featured Card HTML inside fetchFlights()
// Replace the return statement for `if (isClosest)` with this block:
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
}
