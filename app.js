// Expanded ICAO-to-IATA database covering Cathay Pacific and major global carriers
const ICAO_TO_IATA = {
  // Asia-Pacific & Australasia
  CPA: "CX", HDA: "KA", SIA: "SQ", ANA: "NH", JAL: "JL", EVA: "BR", 
  CAL: "CI", THA: "TG", MAS: "MH", PAL: "PR", CEB: "5J", QFA: "QF", 
  VOZ: "VA", ANZ: "NZ",
  // Middle East & Africa
  UAE: "EK", ETD: "EY", QTR: "QR", SVD: "SV", ETH: "ET", RAM: "AT",
  // Europe
  BAW: "BA", RYR: "FR", EZY: "U2", VIR: "VS", SWR: "LX", DLH: "LH",
  AFR: "AF", KLM: "KL", SAS: "SK", FIN: "AY", THY: "TK", TAP: "TP",
  AZA: "AZ", EIN: "EI", IBE: "IB", AEE: "A3", WZZ: "W6",
  // Americas
  AAL: "AA", DAL: "DL", UAL: "UA", SWA: "WN", ACA: "AC", AMX: "AM",
  TAM: "JJ", AVA: "AV", GOL: "G3", CMP: "CM"
};

function getAirlineLogoUrl(callsign) {
  if (!callsign || callsign.length < 3) return null;
  const icao = callsign.substring(0, 3).toUpperCase();
  const iata = ICAO_TO_IATA[icao];

  // 1. Primary: High-res Kiwi CDN (Fast, transparent PNGs via IATA)
  if (iata) {
    return `https://images.kiwi.com/airlines/64/${iata}.png`;
  }

  // 2. Fallback: Open vector/PNG airline logo repository (Works via 3-letter ICAO)
  return `https://assets.duffel.com/img/airlines/for-floor/sq/${icao}.png`;
}
