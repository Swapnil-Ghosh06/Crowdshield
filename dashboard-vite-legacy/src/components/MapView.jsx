.
import React, { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import { Navigation } from 'lucide-react';
import { ZONES as VENUE_ZONES } from '../constants/zones';
import { getRiskColor, RISK_COLORS } from '../constants/theme';

if (typeof window !== 'undefined' && !window.L) {
  window.L = L;
}

function HeatmapOverlay({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !points?.length) return;
    const heatLayerFunc = L.heatLayer || window.L?.heatLayer;
    if (typeof heatLayerFunc !== 'function') return;

    const heatLayer = heatLayerFunc(points, {
      radius: 48, blur: 26, maxZoom: 17, max: 1.0,
      gradient: { 0.2: RISK_COLORS.low, 0.5: RISK_COLORS.medium, 0.75: RISK_COLORS.high, 1.0: RISK_COLORS.critical }
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
    const density = eventData?.density_per_sqm ?? 0;
    return [zone.coords[0], zone.coords[1], Math.min(density / 8.0, 1.0)];
  });

  return (
    <div className="cs-card p-4 border border-slate-200 space-y-3 h-full flex flex-col bg-white">
      {/* Map header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <Navigation className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Spatial Density &amp; Risk Heatmap</h2>
            <p className="text-[11px] text-slate-500">Live GPS telemetry from venue perimeter gates</p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium text-slate-600">
          {[
            { color: RISK_COLORS.low, label: 'Low' },
            { color: RISK_COLORS.medium, label: 'Medium' },
            { color: RISK_COLORS.high, label: 'High' },
            { color: RISK_COLORS.critical, label: 'Critical' },
            { color: RISK_COLORS.none, label: 'No Data' },
          ].map(({ color, label }) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full ring-1 ring-slate-200" style={{ background: color }} />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Map container */}
      <div className="w-full flex-1 rounded-xl overflow-hidden relative z-0 min-h-[400px] border border-slate-200 shadow-2xs">
        <MapContainer
          center={mapCenter}
          zoom={16}
          scrollWheelZoom={false}
          style={{ height: '100%', width: '100%' }}
        >
          {/* Crisp modern light map tiles */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />

          <HeatmapOverlay points={heatmapPoints} />

          {VENUE_ZONES.map((zone) => {
            const eventData = events.get(zone.id);
            const riskLevel = eventData?.risk_level || 'no data';
            const riskColor = getRiskColor(riskLevel);
            const riskScoreFormatted = eventData?.risk_score != null
              ? Number(eventData.risk_score).toFixed(2) : 'N/A';
            const zoneName = eventData?.zone_name || zone.name;
            const etaMinutes = eventData?.eta_minutes != null
              ? `${eventData.eta_minutes} min` : 'N/A';
            const firstRec = eventData?.recommendations?.[0] || 'Standard monitoring active';

            return (
              <CircleMarker
                key={zone.id}
                center={zone.coords}
                radius={20}
                pathOptions={{
                  color: riskColor,
                  fillColor: riskColor,
                  fillOpacity: 0.7,
                  weight: 3,
                }}
              >
                <Tooltip permanent direction="top" offset={[0, -22]}>
                  <span className="font-mono font-bold text-[10px] text-slate-800 bg-white px-2 py-0.5 rounded shadow-sm border border-slate-200">
                    {zone.name}
                  </span>
                </Tooltip>

                <Popup>
                  <div className="p-1 min-w-[200px] font-sans">
                    <div className="font-bold text-sm text-slate-900 border-b border-slate-200 pb-1.5 mb-2 flex justify-between items-center">
                      {zoneName}
                      <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded uppercase">
                        {zone.id}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-600">
                      <div className="flex justify-between">
                        <span>Risk Score:</span>
                        <span className="font-bold font-mono text-slate-900">{riskScoreFormatted}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Risk Status:</span>
                        <span className="font-bold uppercase" style={{ color: riskColor }}>{riskLevel}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>ETA to Threshold:</span>
                        <span className="font-bold font-mono text-slate-900">{etaMinutes}</span>
                      </div>

                      <div className="mt-2 pt-2 border-t border-slate-100 text-[11px]">
                        <span className="font-bold text-slate-700 block mb-0.5 uppercase text-[9px]">Intervention:</span>
                        <p className="italic text-slate-600 leading-snug">"{firstRec}"</p>
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
