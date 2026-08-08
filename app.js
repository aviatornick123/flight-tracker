* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  background-color: #0b0f17;
  color: #f8fafc;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  padding: 20px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid #1e293b;
}

.header h1 {
  font-size: 1.5rem;
  letter-spacing: 1px;
  color: #38bdf8;
  font-weight: 700;
}

.clock {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 1.25rem;
  color: #94a3b8;
  background: #0f172a;
  padding: 4px 12px;
  border-radius: 6px;
  border: 1px solid #1e293b;
}

.dashboard-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

@media (max-width: 900px) {
  .dashboard-container {
    grid-template-columns: 1fr;
  }
}

#map {
  height: 650px;
  width: 100%;
  border-radius: 12px;
  border: 1px solid #1e293b;
  overflow: hidden;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}

.flight-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.flight-card {
  background-color: #0f172a;
  border: 1px solid #1e293b;
  border-radius: 12px;
  padding: 16px;
  transition: transform 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
}

.flight-card:hover, .flight-card.highlighted {
  transform: translateY(-2px);
  background-color: #152035;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4);
}

.card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 10px;
}

.callsign-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.index-badge {
  font-size: 0.8rem;
  font-weight: 800;
  padding: 2px 8px;
  border-radius: 6px;
  letter-spacing: 0.5px;
  display: inline-block;
}

.callsign {
  font-size: 1.4rem;
  font-weight: 800;
  color: #ffffff;
  letter-spacing: 0.5px;
}

.airline-logo {
  height: 24px;
  max-width: 90px;
  object-fit: contain;
  filter: drop-shadow(0 1px 2px rgba(0,0,0,0.5));
}

.ac-type {
  font-size: 0.85rem;
  color: #94a3b8;
  margin-top: 4px;
  font-weight: 500;
}

.route-badge {
  display: inline-block;
  font-size: 0.8rem;
  color: #fbbf24;
  margin-top: 6px;
  font-weight: 600;
  background-color: rgba(251, 191, 36, 0.08);
  padding: 3px 8px;
  border-radius: 4px;
  border: 1px solid rgba(251, 191, 36, 0.2);
}

.plane-img {
  width: 110px;
  height: 72px;
  object-fit: cover;
  border-radius: 8px;
  background-color: #1e293b;
  border: 1px solid #334155;
  flex-shrink: 0;
}

.telemetry {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  background-color: #090d16;
  padding: 12px;
  border-radius: 8px;
  text-align: center;
  margin-top: 10px;
  border: 1px solid rgba(255, 255, 255, 0.03);
}

.metric-label {
  font-size: 0.68rem;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  margin-bottom: 3px;
  font-weight: 600;
}

.metric-value {
  font-size: 0.95rem;
  font-weight: 700;
  color: #f1f5f9;
}

.loading-state {
  text-align: center;
  padding: 50px 20px;
  color: #64748b;
  font-size: 1.1rem;
  background: #0f172a;
  border-radius: 12px;
  border: 1px dashed #1e293b;
}

/* Custom Map Plane Marker & Label Tag */
.plane-marker-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
}

.plane-svg-icon {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  filter: drop-shadow(0px 3px 6px rgba(0,0,0,0.85));
  transition: transform 0.3s ease;
}

.plane-marker-tag {
  margin-top: 2px;
  padding: 2px 7px;
  border-radius: 12px;
  font-size: 0.72rem;
  font-weight: 800;
  white-space: nowrap;
  box-shadow: 0 3px 8px rgba(0,0,0,0.7);
  border: 1px solid rgba(255, 255, 255, 0.25);
  letter-spacing: 0.4px;
}
