import React from 'react';
import { ShieldAlert, Users, Gauge, Clock, Megaphone, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react';

export function ZoneCard({ event }) {
  const {
    zone_id,
    zone_name,
    timestamp,
    density_per_sqm,
    flow_speed_mps,
    risk_score,
    risk_level,
    eta_minutes,
    recommendations,
    announcement
  } = event;

  const getRiskStyle = (level) => {
    switch (level) {
      case 'critical':
        return {
          badge: 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse',
          border: 'border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.15)]',
          bar: 'bg-gradient-to-r from-red-600 to-rose-500',
          icon: <ShieldAlert className="w-4 h-4 text-red-400" />
        };
      case 'high':
        return {
          badge: 'bg-orange-500/20 text-orange-400 border-orange-500/40',
          border: 'border-orange-500/40 shadow-[0_0_15px_rgba(249,115,22,0.1)]',
          bar: 'bg-gradient-to-r from-orange-500 to-amber-500',
          icon: <AlertTriangle className="w-4 h-4 text-orange-400" />
        };
      case 'medium':
        return {
          badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          border: 'border-amber-500/30',
          bar: 'bg-gradient-to-r from-amber-400 to-yellow-500',
          icon: <AlertCircle className="w-4 h-4 text-amber-300" />
        };
      case 'low':
      default:
        return {
          badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          border: 'border-slate-800 hover:border-slate-700',
          bar: 'bg-gradient-to-r from-emerald-500 to-teal-400',
          icon: <CheckCircle className="w-4 h-4 text-emerald-300" />
        };
    }
  };

  const style = getRiskStyle(risk_level);
  const formattedScore = Math.min(Math.max(risk_score, 0), 1);
  const scorePercent = Math.round(formattedScore * 100);

  const formattedTime = timestamp
    ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : 'N/A';

  return (
    <div className={`glass-panel rounded-xl p-5 border transition-all duration-300 flex flex-col justify-between ${style.border}`}>
      {/* Top Header */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 uppercase">
                {zone_id}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {formattedTime}
              </span>
            </div>
            <h3 className="text-lg font-bold text-slate-100 mt-1">
              {zone_name}
            </h3>
          </div>

          <div className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border flex items-center gap-1.5 shrink-0 ${style.badge}`}>
            {style.icon}
            {risk_level}
          </div>
        </div>

        {/* Risk Bar */}
        <div className="mb-4">
          <div className="flex justify-between items-center text-xs mb-1">
            <span className="text-slate-400 font-medium">Risk Score</span>
            <span className="font-mono font-bold text-slate-200">{scorePercent}% ({risk_score})</span>
          </div>
          <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden p-0.5 border border-slate-800">
            <div
              className={`h-full rounded-full transition-all duration-500 ${style.bar}`}
              style={{ width: `${scorePercent}%` }}
            />
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-3 gap-2 mb-4 bg-slate-900/60 p-3 rounded-lg border border-slate-800/80">
          <div className="flex flex-col">
            <div className="flex items-center gap-1 text-[11px] text-slate-400">
              <Users className="w-3 h-3 text-indigo-400" /> Density
            </div>
            <div className="text-sm font-bold font-mono text-slate-100 mt-0.5">
              {density_per_sqm} <span className="text-[10px] text-slate-500 font-normal">/m²</span>
            </div>
          </div>

          <div className="flex flex-col border-l border-slate-800 pl-2.5">
            <div className="flex items-center gap-1 text-[11px] text-slate-400">
              <Gauge className="w-3 h-3 text-cyan-400" /> Flow Speed
            </div>
            <div className="text-sm font-bold font-mono text-slate-100 mt-0.5">
              {flow_speed_mps} <span className="text-[10px] text-slate-500 font-normal">m/s</span>
            </div>
          </div>

          <div className="flex flex-col border-l border-slate-800 pl-2.5">
            <div className="flex items-center gap-1 text-[11px] text-slate-400">
              <Clock className="w-3 h-3 text-amber-400" /> ETA
            </div>
            <div className="text-sm font-bold font-mono text-slate-100 mt-0.5">
              {eta_minutes !== null && eta_minutes !== undefined ? (
                `${eta_minutes}m`
              ) : (
                <span className="text-slate-500 font-normal">None</span>
              )}
            </div>
          </div>
        </div>

        {/* Bilingual Announcements */}
        {announcement && (announcement.en || announcement.hi) && (
          <div className="mb-4 bg-indigo-950/40 border border-indigo-500/20 rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-300 mb-1">
              <Megaphone className="w-3.5 h-3.5 text-indigo-400" />
              Bilingual Broadcast
            </div>
            {announcement.en && (
              <p className="text-xs text-slate-200 font-sans leading-relaxed">
                <span className="text-[10px] font-mono text-indigo-400 font-semibold mr-1.5">[EN]</span>
                {announcement.en}
              </p>
            )}
            {announcement.hi && (
              <p className="text-xs text-slate-300 font-sans leading-relaxed mt-1">
                <span className="text-[10px] font-mono text-amber-400 font-semibold mr-1.5">[HI]</span>
                {announcement.hi}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Recommendations */}
      {recommendations && recommendations.length > 0 && (
        <div className="pt-2 border-t border-slate-800/80">
          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-1.5">
            Active Recommendations
          </span>
          <div className="flex flex-wrap gap-1.5">
            {recommendations.map((rec, i) => (
              <span
                key={i}
                className="text-[11px] bg-slate-900 text-slate-300 border border-slate-700 px-2 py-0.5 rounded flex items-center gap-1"
              >
                <Info className="w-3 h-3 text-cyan-400 shrink-0" />
                {rec}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
