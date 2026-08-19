import React from 'react';
import {
  ShieldAlert, Users, Gauge, Clock, Megaphone,
  CheckCircle, AlertTriangle, AlertCircle, Info
} from 'lucide-react';

/**
 * Returns styling tokens for a given risk level in the modern command theme.
 */
function getRiskStyle(level) {
  switch (level?.toLowerCase()) {
    case 'critical':
      return {
        badgeCls:  'badge-risk-critical',
        border:    'border-red-300 ring-2 ring-red-100',
        bar:       'bg-gradient-to-r from-red-600 to-rose-500',
        barBg:     'bg-red-100',
        icon:      <ShieldAlert className="w-3.5 h-3.5 text-red-600" />,
      };
    case 'high':
      return {
        badgeCls:  'badge-risk-high',
        border:    'border-orange-300 ring-1 ring-orange-100',
        bar:       'bg-gradient-to-r from-orange-600 to-amber-500',
        barBg:     'bg-orange-100',
        icon:      <AlertTriangle className="w-3.5 h-3.5 text-orange-600" />,
      };
    case 'medium':
      return {
        badgeCls:  'badge-risk-medium',
        border:    'border-amber-300',
        bar:       'bg-gradient-to-r from-amber-500 to-yellow-400',
        barBg:     'bg-amber-100',
        icon:      <AlertCircle className="w-3.5 h-3.5 text-amber-600" />,
      };
    case 'low':
    default:
      return {
        badgeCls:  'badge-risk-low',
        border:    'border-slate-200 hover:border-slate-300',
        bar:       'bg-gradient-to-r from-emerald-600 to-teal-500',
        barBg:     'bg-emerald-100',
        icon:      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />,
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
    <div className={`cs-card-interactive p-4.5 border flex flex-col gap-3.5 bg-white ${style.border} shadow-xs`}>
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] font-bold font-mono tracking-wider uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
              {zone_id}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {formattedTime}
            </span>
          </div>
          <h3 className="text-sm font-bold text-slate-900">{zone_name}</h3>
        </div>

        <div className={`badge shrink-0 ${style.badgeCls}`}>
          {style.icon}
          {risk_level}
        </div>
      </div>

      {/* ── Risk Bar ── */}
      <div>
        <div className="flex justify-between items-center text-xs mb-1.5">
          <span className="font-semibold text-slate-500 text-[11px]">Calculated Risk</span>
          <span className="font-bold font-mono text-slate-800 text-[11px]">
            {scorePercent}%
            <span className="text-slate-400 font-normal ml-1">({risk_score})</span>
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
      <div className="grid grid-cols-3 gap-0 rounded-lg overflow-hidden border border-slate-200 bg-slate-50/70">
        {[
          { icon: <Users className="w-3.5 h-3.5 text-blue-600" />,   label: 'Density', value: density_per_sqm, unit: '/m²' },
          { icon: <Gauge className="w-3.5 h-3.5 text-slate-600" />,  label: 'Flow',    value: flow_speed_mps, unit: 'm/s' },
          { icon: <Clock className="w-3.5 h-3.5 text-amber-600" />,  label: 'ETA',     value: eta_minutes != null ? `${eta_minutes}m` : '—', unit: '' },
        ].map(({ icon, label, value, unit }, i) => (
          <div
            key={i}
            className={`flex flex-col gap-0.5 p-2.5 ${i > 0 ? 'border-l border-slate-200' : ''}`}
          >
            <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-500">
              {icon} {label}
            </div>
            <div className="text-xs font-bold font-mono text-slate-900">
              {value}
              {unit && <span className="text-[10px] text-slate-400 font-normal ml-0.5">{unit}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* ── Bilingual Announcement ── */}
      {announcement && (announcement.en || announcement.hi) && (
        <div className="rounded-lg p-2.5 bg-blue-50/70 border border-blue-100">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-700 mb-1">
            <Megaphone className="w-3 h-3" />
            Active Public Address Broadcast
          </div>
          {announcement.en && (
            <p className="text-xs text-slate-800 leading-relaxed font-medium">
              <span className="text-[10px] font-bold mr-1.5 text-blue-600 font-mono">[EN]</span>
              {announcement.en}
            </p>
          )}
          {announcement.hi && (
            <p className="text-xs text-slate-600 leading-relaxed mt-1 font-medium">
              <span className="text-[10px] font-bold mr-1.5 text-slate-500 font-mono">[HI]</span>
              {announcement.hi}
            </p>
          )}
        </div>
      )}

      {/* ── Recommendations ── */}
      {recommendations?.length > 0 && (
        <div className="pt-2 border-t border-slate-100">
          <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block mb-1.5">
            Active Guard &amp; Actuator Recommendations
          </span>
          <div className="flex flex-wrap gap-1.5">
            {recommendations.map((rec, i) => (
              <span
                key={i}
                className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 font-medium"
              >
                <Info className="w-3 h-3 text-blue-600 shrink-0" />
                {rec}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
