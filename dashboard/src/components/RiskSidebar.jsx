import React, { useState } from 'react';
import { AlertTriangle, ShieldAlert, Clock, Globe, ArrowRight } from 'lucide-react';

const VENUE_ZONES = [
  { id: 'gate_1', name: 'South Entrance' },
  { id: 'gate_2', name: 'North Gate' },
  { id: 'gate_3', name: 'East Pavilion' },
  { id: 'gate_4', name: 'West Exit' },
  { id: 'gate_5', name: 'Main Arena' },
];

function getRiskBadgeCls(level) {
  switch (level?.toLowerCase()) {
    case 'critical': return 'badge badge-risk-critical animate-pulse-slow';
    case 'high':     return 'badge badge-risk-high';
    case 'medium':   return 'badge badge-risk-medium';
    case 'low':      return 'badge badge-risk-low';
    default:         return 'badge badge-slate';
  }
}

function getRiskBarColor(level) {
  switch (level?.toLowerCase()) {
    case 'critical': return '#DC2626';
    case 'high':     return '#EA580C';
    case 'medium':   return '#F59E0B';
    case 'low':      return '#10B981';
    default:         return '#94A3B8';
  }
}

function getRiskBarBg(level) {
  switch (level?.toLowerCase()) {
    case 'critical': return '#FEE2E2';
    case 'high':     return '#FFEDD5';
    case 'medium':   return '#FEF3C7';
    case 'low':      return '#D1FAE5';
    default:         return '#F1F5F9';
  }
}

function formatEta(eta) {
  if (eta === null || eta === undefined) return '—';
  if (eta < 3) return 'Imminent (<3m)';
  return `${eta} min`;
}

export function RiskSidebar({ events }) {
  const [langMap, setLangMap] = useState({});

  const zoneList = VENUE_ZONES.map((zone) => {
    const event = events.get(zone.id);
    return {
      id:              zone.id,
      name:            event?.zone_name || zone.name,
      risk_score:      event?.risk_score ?? 0,
      risk_level:      event?.risk_level || 'no data',
      eta_minutes:     event?.eta_minutes,
      recommendations: event?.recommendations || [],
      announcement:    event?.announcement || { en: '', hi: '' },
    };
  }).sort((a, b) => b.risk_score - a.risk_score);

  const affectedZones = zoneList.filter(
    (z) => z.risk_level === 'high' || z.risk_level === 'critical'
  );

  const toggleLang = (zoneId) =>
    setLangMap((prev) => ({ ...prev, [zoneId]: prev[zoneId] === 'hi' ? 'en' : 'hi' }));

  return (
    <div className="cs-card p-4 flex flex-col h-full overflow-hidden bg-white">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-200">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
          <ShieldAlert className="w-4 h-4 text-blue-600" />
          Risk Priority Queue
        </h2>
        <span className="badge badge-slate font-mono text-[10px]">
          Ranked by threat
        </span>
      </div>

      {/* ── Critical Threat Banner ── */}
      {affectedZones.length > 0 && (
        <div className="mb-3 rounded-xl p-3 shrink-0 flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-900 shadow-2xs">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-600 animate-pulse-slow" />
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-red-700">
              High Risk Surge Detected ({affectedZones.length} Gate{affectedZones.length > 1 ? 's' : ''})
            </h4>
            <p className="text-xs text-red-800 mt-0.5 font-medium">
              {affectedZones.map((z) => z.name).join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* ── Scrollable Zone List ── */}
      <div className="overflow-y-auto space-y-2.5 pr-1 flex-1 min-h-0">
        {zoneList.map((zone) => {
          const scorePercent  = Math.min(Math.max(zone.risk_score * 100, 0), 100);
          const currentLang   = langMap[zone.id] || 'en';
          const annText = currentLang === 'hi'
            ? zone.announcement?.hi || zone.announcement?.en
            : zone.announcement?.en || zone.announcement?.hi;
          const firstRec = zone.recommendations?.[0];
          const barColor = getRiskBarColor(zone.risk_level);
          const barBg    = getRiskBarBg(zone.risk_level);

          return (
            <div
              key={zone.id}
              className="rounded-xl p-3.5 border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-slate-300 transition-all duration-200 shadow-2xs"
            >
              {/* Name + Badge */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <h3 className="text-xs font-bold text-slate-900">{zone.name}</h3>
                  <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                    {zone.id}
                  </span>
                </div>
                <span className={getRiskBadgeCls(zone.risk_level)}>
                  {zone.risk_level}
                </span>
              </div>

              {/* Risk Progress Bar */}
              <div className="mb-2.5">
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-500 font-medium">Risk Score</span>
                  <span className="font-bold text-slate-800 font-mono">
                    {Number(zone.risk_score).toFixed(2)}
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: barBg }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${scorePercent}%`, background: barColor }}
                  />
                </div>
              </div>

              {/* ETA */}
              <div className="flex items-center justify-between text-xs py-1.5 border-t border-b border-slate-200/80 mb-2">
                <span className="flex items-center gap-1 text-slate-500 text-[11px]">
                  <Clock className="w-3 h-3 text-slate-400" />
                  Time to Critical
                </span>
                <span
                  className="font-bold text-[11px] font-mono"
                  style={{
                    color: zone.eta_minutes != null && zone.eta_minutes < 3 ? '#DC2626' : '#0F172A',
                  }}
                >
                  {formatEta(zone.eta_minutes)}
                </span>
              </div>

              {/* First Recommendation */}
              {firstRec && (
                <div className="text-[11px] p-2 rounded-lg mb-2 bg-white border border-slate-200 text-slate-700 font-medium">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-blue-600 block mb-0.5">
                    Recommended Action
                  </span>
                  "{firstRec}"
                </div>
              )}

              {/* Bilingual Announcement */}
              {annText && (
                <div className="flex items-start justify-between gap-2 bg-blue-50/60 p-2 rounded-lg border border-blue-100">
                  <p className="text-[11px] text-slate-700 leading-snug flex-1">
                    <span className="font-bold mr-1 text-blue-600 font-mono text-[10px]">
                      [{currentLang.toUpperCase()}]
                    </span>
                    {annText}
                  </p>
                  <button
                    onClick={() => toggleLang(zone.id)}
                    className="btn-ghost shrink-0 flex items-center gap-1 bg-white text-[10px] py-1 px-1.5 border-slate-200"
                    title="Toggle language"
                  >
                    <Globe className="w-3 h-3 text-blue-600" />
                    {currentLang === 'en' ? 'HI' : 'EN'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
