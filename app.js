:root {
  --bg-main: #090d16;
  --bg-card: #111827;
  --bg-card-hover: #1f2937;
  --border-color: rgba(255, 255, 255, 0.08);
  --text-primary: #f9fafb;
  --text-secondary: #9ca3af;
  --text-muted: #6b7280;
  --accent-cyan: #38bdf8;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  background-color: var(--bg-main);
  color: var(--text-primary);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* --- Header Bar --- */
header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 24px;
  background: rgba(17, 24, 39, 0.8);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border-color);
  position: sticky;
  top: 0;
  z-index: 1000;
}

h1 {
  font-size: 1.25rem;
  font-weight: 800;
  letter-spacing: 1.5px;
  color: var(--accent-cyan);
  text-transform: uppercase;
}

#current-time {
  font-family: "Courier New", Courier, monospace;
  font-size: 1.1rem;
  font-weight: 700;
  letter-spacing: 2px;
  color: var(--text-secondary);
  background: rgba(0, 0, 0, 0.4);
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
}

/* --- Dashboard Main Grid Layout --- */
.dashboard-container {
  display: grid;
  grid-template-columns: 380px 1fr; /* Compact map, expanded flight feed */
  gap: 20px;
  padding: 20px;
  max-width: 1800px;
  margin: 0 auto;
  width: 100%;
  flex: 1;
}

@media (max-width: 1024px) {
  .dashboard-container {
    grid-template-columns: 1fr; /* Stack vertically on smaller screens */
  }
}

/* --- Map Panel (Smaller & Sticky) --- */
.map-panel {
  position: sticky;
  top: 80px;
  height: calc(100vh - 120px);
  min-height: 400px;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid var(--border-color);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
}

#map {
  width: 100%;
  height: 100%;
  background: #000;
}

/* Custom leaflet popup style */
.leaflet-popup-content-wrapper {
  background: var(--bg-card) !important;
  color: var(--text-primary) !important;
  border: 1px solid var(--border-color);
  border-radius: 8px !important;
}
.leaflet-popup-tip {
  background: var(--bg-card) !important;
}

/* --- Flight Grid & Cards Feed --- */
.flight-feed {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

#flight-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

.loading-state {
  text-align: center;
  padding: 40px;
  color: var(--text-muted);
  font-size: 1.1rem;
  grid-column: 1 / -1;
}

/* --- Standard Flight Card --- */
.flight-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-left: 4px solid var(--accent-color, var(--accent-cyan));
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}

.flight-card:hover {
  transform: translateY(-2px);
  border-color: rgba(255, 255, 255, 0.2);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}

.card-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.callsign-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.callsign {
  font-size: 1.3rem;
  font-weight: 800;
  letter-spacing: 0.5px;
  color: #ffffff;
}

.airline-logo {
  height: 24px;
  max-width: 90px;
  object-fit: contain;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
}

.airline-name {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--accent-cyan);
}

.ac-type {
  font-size: 0.8rem;
  color: var(--text-muted);
}

/* Route display */
.route-panel {
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 8px;
  padding: 10px 12px;
}

.route-airports {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.airport-node {
  flex: 1;
}

.airport-code {
  font-size: 1.1rem;
  font-weight: 800;
  color: #ffffff;
}

.airport-name {
  font-size: 0.75rem;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
}

.airport-city {
  font-size: 0.7rem;
  color: var(--text-muted);
}

.route-arrow {
  font-size: 0.9rem;
  opacity: 0.6;
  padding: 0 8px;
}

/* Telemetry Grid */
.telemetry {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  background: rgba(0, 0, 0, 0.2);
  padding: 10px;
  border-radius: 8px;
  text-align: center;
}

.metric-label {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
  margin-bottom: 2px;
}

.metric-value {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--text-primary);
}

/* --- ⚡ FEATURED CARD (CLOSEST IN RANGE) --- */
.featured-card {
  grid-column: 1 / -1; /* Spans across all grid columns */
  background: linear-gradient(135deg, rgba(17, 24, 39, 0.95), rgba(30, 41, 59, 0.95));
  border: 2px solid var(--accent-color, var(--accent-cyan));
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.6), 0 0 20px rgba(56, 189, 248, 0.15);
  position: relative;
  gap: 16px;
}

.featured-badge {
  align-self: flex-start;
  background: var(--accent-color, var(--accent-cyan));
  color: #000000;
  font-size: 0.75rem;
  font-weight: 900;
  letter-spacing: 1px;
  padding: 4px 10px;
  border-radius: 20px;
  text-transform: uppercase;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
}

.featured-card .callsign {
  font-size: 1.8rem;
}

.featured-card .airline-logo {
  height: 32px;
  max-width: 120px;
}

.featured-card .airline-name {
  font-size: 1rem;
}

.featured-card .ac-type {
  font-size: 0.9rem;
}

/* Featured Media Section: Large Plane Photo + Route Box Side-by-Side */
.featured-media {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 16px;
  align-items: stretch;
}

@media (max-width: 640px) {
  .featured-media {
    grid-template-columns: 1fr;
  }
}

.plane-photo {
  width: 100%;
  height: 180px;
  object-fit: cover;
  border-radius: 12px;
  border: 1px solid var(--border-color);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.5);
}

.featured-card .route-panel {
  display: flex;
  align-items: center;
  padding: 16px 20px;
  background: rgba(0, 0, 0, 0.4);
}

.featured-card .airport-code {
  font-size: 1.6rem;
}

.featured-card .airport-name {
  font-size: 0.85rem;
  max-width: 200px;
}

.featured-card .airport-city {
  font-size: 0.8rem;
}

.featured-card .route-arrow {
  font-size: 1.4rem;
}

.featured-card .telemetry {
  padding: 14px;
  background: rgba(0, 0, 0, 0.3);
}

.featured-card .metric-label {
  font-size: 0.75rem;
}

.featured-card .metric-value {
  font-size: 1.25rem;
}
