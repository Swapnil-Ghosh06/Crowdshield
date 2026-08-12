import React from 'react';
import {
  ShieldAlert, Users, Gauge, Clock, Megaphone,
  CheckCircle, AlertTriangle, AlertCircle, Info
} from 'lucide-react';

/**
 * Returns styling tokens for a given risk level in the light theme.
 */
function getRiskStyle(level) {
  switch (level) {
    case 'critical':
      return {
        badgeCls:  'badge-risk-critical',
        border:    'border-[rgba(176,40,40,0.35)] shadow-[0_0_0_3px_rgba(176,40,40,0.08)]',
        bar:       'bg-gradient-to-r from-[#B02828] to-[#C43C3C]',
        barBg:     'bg-[#FCE0E0]',
        accentBg:  '#FDF0F0',
        icon:      <ShieldAlert className="w-4 h-4" style={{ color: 'var(--risk-critical)' }} />,
      };
    case 'high':
      return {
        badgeCls:  'badge-risk-high',
        border:    'border-[rgba(196,88,42,0.35)] shadow-[0_0_0_3px_rgba(196,88,42,0.08)]',
        bar:       'bg-gradient-to-r from-[#C4582A] to-[#D97840]',
        barBg:     'bg-[#FDE8DE]',
        accentBg:  '#FDF3EE',
        icon:      <AlertTriangle className="w-4 h-4" style={{ color: 'var(--risk-high)' }} />,
      };
    case 'medium':
      return {
        badgeCls:  'badge-risk-medium',
        border:    'border-[rgba(192,139,58,0.3)]',
        bar:       'bg-gradient-to-r from-[#C08B3A] to-[#D4A850]',
        barBg:     'bg-[#FDF0DC]',
        accentBg:  '#FDFAF0',
        icon:      <AlertCircle className="w-4 h-4" style={{ color: 'var(--risk-medium)' }} />,
      };
    case 'low':
    default:
      return {
        badgeCls:  'badge-risk-low',
        border:    'border-[var(--card-border)]',
        bar:       'bg-gradient-to-r from-[#4A9B6F] to-[#5DB882]',
        barBg:     'bg-[#E8F5EE]',
        accentBg:  '#F0FBF5',
        icon:      <CheckCircle className="w-4 h-4" style={{ color: 'var(--risk-low)' }} />,
      };
  }
}

export function ZoneCard({ event }) {
  const {
    zone_id, zone_name, timestamp,
    density_per_sqm, flow_speed_mps, risk_score, risk_level,
    eta_minutes, recommendations, announcement
  } = event;

  const style = getRiskStyle(risk_level);
  const scorePercent = Math.round(Math.min(Math.max(risk_score ?? 0, 0), 1) * 100);

  const formattedTime = timestamp
    ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : 'N/A';

  return (
    <div
      className={`cs-card-interactive p-5 border flex flex-col gap-4 ${style.border}`}
    >
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-[10px] font-semibold tracking-widest uppercase px-2 py-0.5 rounded-md"
              style={{ background: 'var(--cs-pearl-dark)', color: 'var(--cs-slate)', fontFamily: 'Google Sans, monospace' }}
            >
              {zone_id}
            </span>
            <span className="text-[10px] text-muted" style={{ fontFamily: 'Google Sans, monospace' }}>
              {formattedTime}
            </span>
          </div>
          <h3 className="text-base font-bold text-primary">{zone_name}</h3>
        </div>

        <div className={`badge shrink-0 ${style.badgeCls}`}>
          {style.icon}
          {risk_level}
        </div>
      </div>

      {/* ── Risk Bar ── */}
      <div>
        <div className="flex justify-between items-center text-xs mb-2">
          <span className="font-medium text-secondary">Risk Score</span>
          <span className="font-bold font-mono text-primary" style={{ fontFamily: 'Google Sans, monospace' }}>
            {scorePercent}%
            <span className="text-muted font-normal ml-1">({risk_score})</span>
          </span>
        </div>
        <div className={`w-full rounded-full h-2 overflow-hidden ${style.barBg}`}>
          <div
            className={`h-full rounded-full transition-all duration-700 ${style.bar}`}
            style={{ width: `${scorePercent}%` }}
          />
        </div>
      </div>

      {/* ── Metrics Grid ── */}
      <div
        className="grid grid-cols-3 gap-0 rounded-xl overflow-hidden"
        style={{ background: 'var(--page-bg)', border: '1px solid var(--card-border)' }}
      >
        {[
          { icon: <Users className="w-3.5 h-3.5" style={{ color: 'var(--cs-salmon)' }} />, label: 'Density', value: density_per_sqm, unit: '/m²' },
          { icon: <Gauge className="w-3.5 h-3.5" style={{ color: 'var(--cs-slate)' }} />,  label: 'Flow',    value: flow_speed_mps, unit: 'm/s' },
          { icon: <Clock className="w-3.5 h-3.5" style={{ color: 'var(--risk-medium)' }} />, label: 'ETA',   value: eta_minutes != null ? `${eta_minutes}m` : '—', unit: '' },
        ].map(({ icon, label, value, unit }, i) => (
          <div
            key={i}
            className={`flex flex-col gap-0.5 p-3 ${i > 0 ? 'border-l' : ''}`}
            style={{ borderColor: 'var(--card-border)' }}
          >
            <div className="flex items-center gap-1 text-[11px] text-secondary">
              {icon} {label}
            </div>
            <div className="text-sm font-bold text-primary" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              {value}
              {unit && <span className="text-[10px] text-muted font-normal ml-0.5">{unit}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* ── Bilingual Announcement ── */}
      {announcement && (announcement.en || announcement.hi) && (
        <div
          className="rounded-xl p-3"
          style={{ background: 'var(--cs-salmon-light)', border: '1px solid rgba(191,137,127,0.2)' }}
        >
          <div className="flex items-center gap-1.5 text-xs font-semibold mb-1.5" style={{ color: 'var(--cs-salmon-dark)' }}>
            <Megaphone className="w-3.5 h-3.5" />
            Broadcast
          </div>
          {announcement.en && (
            <p className="text-xs text-primary leading-relaxed">
              <span className="text-[10px] font-semibold mr-1.5" style={{ color: 'var(--cs-salmon)', fontFamily: 'Google Sans, monospace' }}>[EN]</span>
              {announcement.en}
            </p>
          )}
          {announcement.hi && (
            <p className="text-xs text-secondary leading-relaxed mt-1">
              <span className="text-[10px] font-semibold mr-1.5" style={{ color: 'var(--cs-slate)', fontFamily: 'Google Sans, monospace' }}>[HI]</span>
              {announcement.hi}
            </p>
          )}
        </div>
      )}

      {/* ── Recommendations ── */}
      {recommendations?.length > 0 && (
        <div className="pt-3 border-t" style={{ borderColor: 'var(--card-border)' }}>
          <span className="text-[10px] uppercase font-bold text-muted tracking-wider block mb-2">
            Active Recommendations
          </span>
          <div className="flex flex-wrap gap-1.5">
            {recommendations.map((rec, i) => (
              <span
                key={i}
                className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg"
                style={{
                  background:   'var(--cs-pearl-dark)',
                  border:       '1px solid var(--card-border)',
                  color:        'var(--cs-pewter-light)',
                  fontFamily:   'Google Sans, sans-serif',
                }}
              >
                <Info className="w-3 h-3 shrink-0" style={{ color: 'var(--cs-salmon)' }} />
                {rec}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
