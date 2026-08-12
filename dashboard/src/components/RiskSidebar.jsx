import React, { useState } from 'react';
import { AlertTriangle, ShieldAlert, Clock } from 'lucide-react';

const VENUE_ZONES = [
  { id: 'gate_1', name: 'South Entrance' },
  { id: 'gate_2', name: 'North Gate' },
  { id: 'gate_3', name: 'East Pavilion' },
  { id: 'gate_4', name: 'West Exit' },
  { id: 'gate_5', name: 'Main Arena' }
];

export function RiskSidebar({ events }) {
  // Per-zone language toggle state ('en' | 'hi')
  const [langMap, setLangMap] = useState({});

  // Map each zone ID to its combined event data
  const zoneList = VENUE_ZONES.map((zone) => {
    const event = events.get(zone.id);
    return {
      id: zone.id,
      name: event?.zone_name || zone.name,
      risk_score: event?.risk_score ?? 0,
      risk_level: event?.risk_level || 'no data yet',
      eta_minutes: event?.eta_minutes,
      recommendations: event?.recommendations || [],
      announcement: event?.announcement || { en: '', hi: '' }
    };
  });

  // Sort by risk_score descending
  zoneList.sort((a, b) => b.risk_score - a.risk_score);

  // Identify affected zones with "high" or "critical" risk
  const affectedZones = zoneList.filter(
    (z) => z.risk_level === 'high' || z.risk_level === 'critical'
  );

  const toggleZoneLang = (zoneId) => {
    setLangMap((prev) => ({
      ...prev,
      [zoneId]: prev[zoneId] === 'hi' ? 'en' : 'hi'
    }));
  };

  const getRiskBadgeStyle = (level) => {
    switch (level?.toLowerCase()) {
      case 'critical':
        return 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse';
      case 'high':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/40';
      case 'medium':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'low':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  const getRiskBarColor = (level) => {
    switch (level?.toLowerCase()) {
      case 'critical':
        return 'bg-red-500';
      case 'high':
        return 'bg-orange-500';
      case 'medium':
        return 'bg-amber-400';
      case 'low':
        return 'bg-emerald-500';
      default:
        return 'bg-slate-600';
    }
  };

  const formatEta = (eta) => {
    if (eta === null || eta === undefined) return 'N/A';
    if (eta < 3) return 'Imminent';
    return `${eta} min`;
  };

  return (
    <div className="glass-panel rounded-2xl p-4 border border-slate-800 flex flex-col h-full overflow-hidden">
      {/* Sidebar Header */}
      <div className="flex items-center justify-between mb-3 shrink-0 pb-2 border-b border-slate-800">
        <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-indigo-400" />
          Risk Telemetry Leaderboard
        </h2>
        <span className="text-[11px] font-mono text-slate-400">
          Ranked by Risk
        </span>
      </div>

      {/* Red Pulsing Alert Banner when ANY zone has "high" or "critical" risk */}
      {affectedZones.length > 0 && (
        <div className="mb-4 bg-red-950/80 border border-red-500/50 rounded-xl p-3 animate-pulse shrink-0 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-red-300">
                CRITICAL THREAT ALERT ({affectedZones.length} ZONE{affectedZones.length > 1 ? 'S' : ''})
              </h4>
              <p className="text-xs text-red-200 mt-1 font-sans leading-relaxed">
                High Risk Zones: <span className="font-bold underline">{affectedZones.map((z) => z.name).join(', ')}</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Zone List (Scrollable) */}
      <div className="overflow-y-auto space-y-3 pr-1 flex-1 min-h-0">
        {zoneList.map((zone) => {
          const scorePercent = Math.min(Math.max(zone.risk_score * 100, 0), 100);
          const currentLang = langMap[zone.id] || 'en';
          const announcementText =
            currentLang === 'hi'
              ? zone.announcement?.hi || zone.announcement?.en
              : zone.announcement?.en || zone.announcement?.hi;

          const firstRec = zone.recommendations?.[0];

          return (
            <div
              key={zone.id}
              className="bg-slate-900/80 border border-slate-800 hover:border-slate-700 rounded-xl p-3 transition-all duration-200"
            >
              {/* Zone Header & Badge */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-100">
                    {zone.name}
                  </h3>
                  <span className="text-[10px] font-mono text-slate-500 uppercase">
                    {zone.id}
                  </span>
                </div>

                <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border shrink-0 ${getRiskBadgeStyle(zone.risk_level)}`}>
                  {zone.risk_level}
                </div>
              </div>

              {/* Progress Bar for Risk Score */}
              <div className="mb-2">
                <div className="flex justify-between items-center text-[11px] mb-1">
                  <span className="text-slate-400 font-medium">Risk Score</span>
                  <span className="font-mono font-bold text-slate-200">
                    {Number(zone.risk_score).toFixed(2)}
                  </span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${getRiskBarColor(zone.risk_level)}`}
                    style={{ width: `${scorePercent}%` }}
                  />
                </div>
              </div>

              {/* ETA Indicator */}
              <div className="flex items-center justify-between text-xs mb-2 pt-1 border-t border-slate-800/60">
                <span className="text-slate-400 text-[11px] flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-400" /> ETA:
                </span>
                <span
                  className={`font-mono text-xs font-bold ${
                    zone.eta_minutes !== null &&
                    zone.eta_minutes !== undefined &&
                    zone.eta_minutes < 3
                      ? 'text-red-400 animate-pulse font-extrabold'
                      : 'text-slate-200'
                  }`}
                >
                  {formatEta(zone.eta_minutes)}
                </span>
              </div>

              {/* First Recommendation String in small grey text */}
              {firstRec && (
                <div className="text-[11px] text-slate-400 bg-slate-950/60 p-2 rounded border border-slate-800/80 mb-2">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-0.5">
                    Recommendation:
                  </span>
                  <p className="text-slate-400 italic text-[11px] leading-snug">
                    "{firstRec}"
                  </p>
                </div>
              )}

              {/* Bilingual Announcement with EN/HI Toggle */}
              {announcementText && (
                <div className="pt-2 border-t border-slate-800/60 flex items-start justify-between gap-2">
                  <div className="text-[11px] text-slate-300 flex-1 leading-snug">
                    <span className="text-[10px] font-mono text-indigo-400 font-bold mr-1">
                      [{currentLang.toUpperCase()}]
                    </span>
                    {announcementText}
                  </div>

                  <button
                    onClick={() => toggleZoneLang(zone.id)}
                    className="px-2 py-0.5 text-[10px] font-mono font-bold bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-700/50 rounded transition-colors shrink-0 cursor-pointer"
                    title="Toggle EN / HI language"
                  >
                    {currentLang === 'en' ? 'EN ➔ HI' : 'HI ➔ EN'}
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
