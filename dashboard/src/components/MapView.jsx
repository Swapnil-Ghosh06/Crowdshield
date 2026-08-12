import React, { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';

if (typeof window !== 'undefined' && !window.L) {
  window.L = L;
}

const VENUE_ZONES = [
  { id: 'gate_1', name: 'South Entrance', coords: [28.6139, 77.2090] },
  { id: 'gate_2', name: 'North Gate',     coords: [28.6155, 77.2090] },
  { id: 'gate_3', name: 'East Pavilion',  coords: [28.6147, 77.2105] },
  { id: 'gate_4', name: 'West Exit',      coords: [28.6147, 77.2075] },
  { id: 'gate_5', name: 'Main Arena',     coords: [28.6147, 77.2090] },
];

const getRiskColor = (riskLevel) => {
  switch (riskLevel?.toLowerCase()) {
    case 'low':      return '#4A9B6F';
    case 'medium':   return '#C08B3A';
    case 'high':     return '#C4582A';
    case 'critical': return '#B02828';
    default:         return '#BF897F';
  }
};

function HeatmapOverlay({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !points?.length) return;
    const heatLayerFunc = L.heatLayer || window.L?.heatLayer;
    if (typeof heatLayerFunc !== 'function') return;

    const heatLayer = heatLayerFunc(points, {
      radius: 45, blur: 25, maxZoom: 17, max: 1.0,
      gradient: { 0.2: '#4A9B6F', 0.5: '#C08B3A', 0.75: '#C4582A', 1.0: '#B02828' }
    });
    heatLayer.addTo(map);
    return () => map.removeLayer(heatLayer);
  }, [map, points]);
  return null;
}

export function MapView({ events }) {
  const mapCenter = [28.6147, 77.2090];

  const heatmapPoints = VENUE_ZONES.map((zone) => {
    const eventData = events.get(zone.id);
    const density   = eventData?.density_per_sqm ?? 0;
    return [zone.coords[0], zone.coords[1], Math.min(density / 8.0, 1.0)];
  });

  return (
    <div className="cs-card p-4 border space-y-3 h-full flex flex-col" style={{ borderColor: 'var(--card-border)' }}>
      {/* Map header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2.5">
          <span
            className="relative flex h-3 w-3 shrink-0"
          >
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: 'var(--cs-salmon)' }} />
            <span className="relative inline-flex rounded-full h-3 w-3" style={{ background: 'var(--cs-salmon)' }} />
          </span>
          <h2 className="text-base font-bold text-primary">Live Venue Risk & Density Heatmap</h2>
          <span className="badge badge-slate">5 gates</span>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-secondary" style={{ fontFamily: 'Google Sans, sans-serif' }}>
          {[
            { color: '#4A9B6F', label: 'Low' },
            { color: '#C08B3A', label: 'Medium' },
            { color: '#C4582A', label: 'High' },
            { color: '#B02828', label: 'Critical' },
            { color: '#BF897F', label: 'No Data' },
          ].map(({ color, label }) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Map container */}
      <div
        className="w-full flex-1 rounded-2xl overflow-hidden relative z-0 min-h-[400px]"
        style={{ border: '1px solid var(--card-border)' }}
      >
        <MapContainer
          center={mapCenter}
          zoom={16}
          scrollWheelZoom={false}
          style={{ height: '100%', width: '100%' }}
        >
          {/* Light map tiles from CartoDB Positron */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />

          <HeatmapOverlay points={heatmapPoints} />

          {VENUE_ZONES.map((zone) => {
            const eventData          = events.get(zone.id);
            const riskLevel          = eventData?.risk_level || 'no data';
            const riskColor          = getRiskColor(riskLevel);
            const riskScoreFormatted = eventData?.risk_score != null
              ? Number(eventData.risk_score).toFixed(2) : 'N/A';
            const zoneName           = eventData?.zone_name || zone.name;
            const etaMinutes         = eventData?.eta_minutes != null
              ? `${eventData.eta_minutes} min` : 'N/A';
            const firstRec           = eventData?.recommendations?.[0] || 'No active recommendations';

            return (
              <CircleMarker
                key={zone.id}
                center={zone.coords}
                radius={20}
                pathOptions={{
                  color:       riskColor,
                  fillColor:   riskColor,
                  fillOpacity: 0.65,
                  weight:      3,
                }}
              >
                <Tooltip permanent direction="top" offset={[0, -22]}>
                  <span
                    style={{
                      fontFamily:    'Google Sans, monospace',
                      fontWeight:    700,
                      fontSize:      10,
                      color:         'var(--cs-pewter)',
                      background:    '#FFFFFF',
                      padding:       '2px 6px',
                      borderRadius:  6,
                      border:        '1px solid var(--card-border)',
                      boxShadow:     'var(--card-shadow)',
                    }}
                  >
                    {zone.name}
                  </span>
                </Tooltip>

                <Popup>
                  <div style={{ minWidth: 200, fontFamily: 'Montserrat, sans-serif' }}>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 14,
                        color: 'var(--cs-pewter)',
                        borderBottom: '1px solid var(--card-border)',
                        paddingBottom: 8,
                        marginBottom: 10,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      {zoneName}
                      <span
                        style={{
                          fontSize: 10,
                          fontFamily: 'Google Sans, monospace',
                          background: 'var(--page-bg)',
                          color: 'var(--cs-slate)',
                          padding: '2px 8px',
                          borderRadius: 6,
                          border: '1px solid var(--card-border)',
                          fontWeight: 500,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                        }}
                      >
                        {zone.id}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                      {[
                        { label: 'Risk Score', value: riskScoreFormatted, mono: true },
                        { label: 'Risk Level', value: riskLevel.toUpperCase(), color: riskColor },
                        { label: 'ETA', value: etaMinutes, mono: true },
                      ].map(({ label, value, mono, color }) => (
                        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                          <span style={{ color: 'var(--cs-slate)', fontWeight: 500 }}>{label}</span>
                          <span
                            style={{
                              fontFamily: mono ? 'Google Sans, monospace' : 'Montserrat, sans-serif',
                              fontWeight: 700,
                              color: color || 'var(--cs-pewter)',
                            }}
                          >
                            {value}
                          </span>
                        </div>
                      ))}

                      <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--card-border)' }}>
                        <div style={{ fontSize: 10, color: 'var(--cs-slate)', fontWeight: 600, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          Recommendation
                        </div>
                        <p style={{ fontSize: 11, color: 'var(--cs-pewter-light)', fontStyle: 'italic', lineHeight: 1.5 }}>
                          "{firstRec}"
                        </p>
                      </div>
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}
