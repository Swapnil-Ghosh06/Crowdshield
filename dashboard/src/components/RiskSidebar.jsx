import React, { useState } from 'react';
import { AlertTriangle, ShieldAlert, Clock, Globe } from 'lucide-react';

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
    case 'critical': return '#B02828';
    case 'high':     return '#C4582A';
    case 'medium':   return '#C08B3A';
    case 'low':      return '#4A9B6F';
    default:         return '#DAC2B2';
  }
}

function getRiskBarBg(level) {
  switch (level?.toLowerCase()) {
    case 'critical': return '#FCE0E0';
    case 'high':     return '#FDE8DE';
    case 'medium':   return '#FDF0DC';
    case 'low':      return '#E8F5EE';
    default:         return 'var(--cs-pearl-dark)';
  }
}

function formatEta(eta) {
  if (eta === null || eta === undefined) return '—';
  if (eta < 3) return 'Imminent';
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
    <div className="cs-card p-4 flex flex-col h-full overflow-hidden">

      {/* ── Header ── */}
      <div
        className="flex items-center justify-between mb-4 pb-3 border-b"
        style={{ borderColor: 'var(--card-border)' }}
      >
        <h2 className="flex items-center gap-2 text-base font-bold text-primary">
          <ShieldAlert className="w-5 h-5" style={{ color: 'var(--cs-salmon)' }} />
          Risk Leaderboard
        </h2>
        <span className="badge badge-slate">by score</span>
      </div>

      {/* ── Critical Alert Banner ── */}
      {affectedZones.length > 0 && (
        <div
          className="mb-4 rounded-xl p-3.5 shrink-0 flex items-start gap-3"
          style={{
            background:  'var(--risk-critical-bg)',
            border:      '1px solid rgba(176,40,40,0.3)',
            boxShadow:   '0 0 0 4px rgba(176,40,40,0.06)',
          }}
        >
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 animate-pulse-slow" style={{ color: 'var(--risk-critical)' }} />
          <div>
            <h4 className="text-xs font-extrabold uppercase tracking-wider" style={{ color: 'var(--risk-critical)' }}>
              Threat Alert · {affectedZones.length} Zone{affectedZones.length > 1 ? 's' : ''}
            </h4>
            <p className="text-xs mt-0.5" style={{ color: '#7A2020' }}>
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
              className="rounded-xl p-3.5 transition-all duration-200"
              style={{
                background:  '#FFFFFF',
                border:      '1px solid var(--card-border)',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--cs-sandstone-mid)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--card-border)'}
            >
              {/* Name + Badge */}
              <div className="flex items-start justify-between gap-2 mb-2.5">
                <div>
                  <h3 className="text-sm font-bold text-primary">{zone.name}</h3>
                  <span
                    className="text-[10px] uppercase tracking-widest text-muted"
                    style={{ fontFamily: 'Google Sans, monospace' }}
                  >
                    {zone.id}
                  </span>
                </div>
                <span className={getRiskBadgeCls(zone.risk_level)}>
                  {zone.risk_level}
                </span>
              </div>

              {/* Risk Bar */}
              <div className="mb-2.5">
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-secondary font-medium">Risk Score</span>
                  <span className="font-bold text-primary" style={{ fontFamily: 'Google Sans, monospace' }}>
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
              <div
                className="flex items-center justify-between text-xs py-2 border-t border-b mb-2.5"
                style={{ borderColor: 'var(--card-border)' }}
              >
                <span className="flex items-center gap-1 text-secondary" style={{ fontSize: 11 }}>
                  <Clock className="w-3 h-3" style={{ color: 'var(--risk-medium)' }} />
                  ETA to threshold
                </span>
                <span
                  className="font-bold"
                  style={{
                    fontFamily: 'Google Sans, monospace',
                    color: zone.eta_minutes != null && zone.eta_minutes < 3
                      ? 'var(--risk-critical)'
                      : 'var(--cs-pewter)',
                    animation: zone.eta_minutes != null && zone.eta_minutes < 3
                      ? 'pulse-slow 1.5s infinite'
                      : 'none',
                  }}
                >
                  {formatEta(zone.eta_minutes)}
                </span>
              </div>

              {/* First Recommendation */}
              {firstRec && (
                <div
                  className="text-[11px] p-2 rounded-lg mb-2"
                  style={{ background: 'var(--page-bg)', color: 'var(--cs-pewter-light)', fontStyle: 'italic' }}
                >
                  <span
                    className="text-[10px] not-italic font-semibold uppercase tracking-wider block mb-0.5"
                    style={{ color: 'var(--cs-slate)' }}
                  >
                    Recommendation
                  </span>
                  "{firstRec}"
                </div>
              )}

              {/* Bilingual Announcement */}
              {annText && (
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[11px] text-secondary leading-snug flex-1">
                    <span
                      className="font-bold mr-1"
                      style={{ color: 'var(--cs-salmon)', fontFamily: 'Google Sans, monospace' }}
                    >
                      [{currentLang.toUpperCase()}]
                    </span>
                    {annText}
                  </p>
                  <button
                    onClick={() => toggleLang(zone.id)}
                    className="btn-ghost shrink-0 flex items-center gap-1"
                    title="Toggle EN / HI"
                    style={{ padding: '4px 8px', fontSize: 10 }}
                  >
                    <Globe className="w-3 h-3" />
                    {currentLang === 'en' ? 'EN→HI' : 'HI→EN'}
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
