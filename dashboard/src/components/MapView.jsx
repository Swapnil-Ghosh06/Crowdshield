import React, { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';

// Ensure L is on window for leaflet.heat if required in ESM environment
if (typeof window !== 'undefined' && !window.L) {
  window.L = L;
}

const VENUE_ZONES = [
  { id: 'gate_1', name: 'South Entrance', coords: [28.6139, 77.2090] },
  { id: 'gate_2', name: 'North Gate', coords: [28.6155, 77.2090] },
  { id: 'gate_3', name: 'East Pavilion', coords: [28.6147, 77.2105] },
  { id: 'gate_4', name: 'West Exit', coords: [28.6147, 77.2075] },
  { id: 'gate_5', name: 'Main Arena', coords: [28.6147, 77.2090] }
];

const getRiskColor = (riskLevel) => {
  switch (riskLevel?.toLowerCase()) {
    case 'low':
      return '#22c55e'; // green
    case 'medium':
      return '#eab308'; // yellow
    case 'high':
      return '#f97316'; // orange
    case 'critical':
      return '#ef4444'; // red
    default:
      return '#6b7280'; // grey (no data yet)
  }
};

/**
 * Custom Leaflet Heatmap Layer using leaflet.heat
 */
function HeatmapOverlay({ points }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !points || points.length === 0) return;

    const heatLayerFunc = L.heatLayer || (window.L && window.L.heatLayer);
    if (typeof heatLayerFunc !== 'function') {
      console.warn('[MapView] L.heatLayer is not available.');
      return;
    }

    const heatLayer = heatLayerFunc(points, {
      radius: 45,
      blur: 25,
      maxZoom: 17,
      max: 1.0,
      gradient: {
        0.2: '#3b82f6', // blue
        0.4: '#22c55e', // green
        0.6: '#eab308', // yellow
        0.8: '#f97316', // orange
        1.0: '#ef4444'  // red
      }
    });

    heatLayer.addTo(map);

    return () => {
      map.removeLayer(heatLayer);
    };
  }, [map, points]);

  return null;
}

export function MapView({ events }) {
  // Center map around stadium layout
  const mapCenter = [28.6147, 77.2090];

  // Build heatmap points array: [lat, lng, intensity]
  // Intensity = density_per_sqm normalized (max 8 people/sqm ceiling)
  const heatmapPoints = VENUE_ZONES.map((zone) => {
    const eventData = events.get(zone.id);
    const density = eventData?.density_per_sqm ?? 0;
    const intensity = Math.min(density / 8.0, 1.0);
    return [zone.coords[0], zone.coords[1], intensity];
  });

  return (
    <div className="glass-panel rounded-2xl p-4 border border-slate-800 space-y-3 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping" />
          <h2 className="text-base font-bold text-slate-100">
            Live Venue Risk & Density Heatmap
          </h2>
          <span className="text-xs text-slate-400 font-mono">
            (5 Monitored Gates)
          </span>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-slate-300">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#22c55e]" /> Low
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#eab308]" /> Medium
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#f97316]" /> High
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" /> Critical
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#6b7280]" /> No Data
          </span>
        </div>
      </div>

      {/* Leaflet Map */}
      <div className="w-full flex-1 rounded-xl overflow-hidden border border-slate-800 relative z-0 min-h-[420px]">
        <MapContainer
          center={mapCenter}
          zoom={16}
          scrollWheelZoom={false}
          style={{ height: '100%', width: '100%', background: '#090d16' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />

          {/* Dynamic Heatmap Overlay */}
          <HeatmapOverlay points={heatmapPoints} />

          {/* Realtime Zone Circle Markers */}
          {VENUE_ZONES.map((zone) => {
            const eventData = events.get(zone.id);
            const riskLevel = eventData?.risk_level || 'no data yet';
            const riskColor = getRiskColor(riskLevel);
            
            const riskScoreFormatted =
              eventData?.risk_score !== undefined && eventData?.risk_score !== null
                ? Number(eventData.risk_score).toFixed(2)
                : 'N/A';

            const zoneName = eventData?.zone_name || zone.name;
            const etaMinutes =
              eventData?.eta_minutes !== undefined && eventData?.eta_minutes !== null
                ? `${eventData.eta_minutes} min`
                : 'N/A';

            const firstRecommendation =
              eventData?.recommendations?.[0] || 'No active recommendations';

            return (
              <CircleMarker
                key={zone.id}
                center={zone.coords}
                radius={20}
                pathOptions={{
                  color: riskColor,
                  fillColor: riskColor,
                  fillOpacity: 0.7,
                  weight: 3
                }}
              >
                <Tooltip permanent direction="top" offset={[0, -20]}>
                  <span className="font-mono font-bold text-[10px] text-slate-100 bg-slate-900/90 px-1.5 py-0.5 rounded border border-slate-700 shadow-md">
                    {zone.name}
                  </span>
                </Tooltip>

                <Popup>
                  <div className="p-1 min-w-[210px] text-slate-900">
                    <div className="font-bold text-sm border-b pb-1 mb-2 flex items-center justify-between">
                      <span>{zoneName}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 uppercase">
                        {zone.id}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs font-sans">
                      <div className="flex justify-between">
                        <span className="font-semibold text-slate-600">Risk Score:</span>
                        <span className="font-mono font-bold text-slate-900">
                          {riskScoreFormatted}
                        </span>
                      </div>

                      <div className="flex justify-between">
                        <span className="font-semibold text-slate-600">Risk Level:</span>
                        <span
                          className="font-bold uppercase text-xs"
                          style={{ color: riskColor }}
                        >
                          {riskLevel}
                        </span>
                      </div>

                      <div className="flex justify-between">
                        <span className="font-semibold text-slate-600">ETA:</span>
                        <span className="font-mono text-slate-800">{etaMinutes}</span>
                      </div>

                      <div className="mt-2 pt-1.5 border-t border-slate-200">
                        <span className="font-semibold text-[11px] block text-slate-800 mb-0.5">
                          Top Recommendation:
                        </span>
                        <p className="italic text-[11px] text-slate-600 leading-snug">
                          "{firstRecommendation}"
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
