import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip as RechartsTooltip, ReferenceLine
} from 'recharts';
import { TrendingUp, Activity, CheckSquare, Square, Eye } from 'lucide-react';

const VENUE_ZONES = [
  { id: 'gate_1', name: 'South Entrance', defaultColor: '#10B981' },
  { id: 'gate_2', name: 'North Gate',     defaultColor: '#F59E0B' },
  { id: 'gate_3', name: 'East Pavilion',  defaultColor: '#6366F1' },
  { id: 'gate_4', name: 'West Exit',      defaultColor: '#EA580C' },
  { id: 'gate_5', name: 'Main Arena',     defaultColor: '#3B82F6' },
];

const getRiskColor = (riskLevel) => {
  switch (riskLevel?.toLowerCase()) {
    case 'low':      return '#10B981';
    case 'medium':   return '#F59E0B';
    case 'high':     return '#EA580C';
    case 'critical': return '#DC2626';
    default:         return '#94A3B8';
  }
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl p-3 text-xs bg-white border border-slate-200 shadow-lg font-mono min-w-[170px]">
      <div className="font-bold mb-2 pb-1 border-b border-slate-100 text-slate-800">
        {label}
      </div>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex justify-between items-center gap-3 py-0.5">
          <div className="flex items-center gap-1.5 font-sans font-medium text-slate-600">
            <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
            <span>{entry.name}</span>
          </div>
          <span className="font-bold text-slate-900">{Number(entry.value).toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
};

export function TrendView({ history, events }) {
  const [visibleZones, setVisibleZones] = useState(
    Object.fromEntries(VENUE_ZONES.map((z) => [z.id, true]))
  );

  const toggleZone = (zoneId) =>
    setVisibleZones((prev) => ({ ...prev, [zoneId]: !prev[zoneId] }));

  const selectAll = (enable) =>
    setVisibleZones(Object.fromEntries(VENUE_ZONES.map((z) => [z.id, enable])));

  const chartData = useMemo(() => {
    let maxLength = 0;
    VENUE_ZONES.forEach((zone) => {
      const h = history.get(zone.id) || [];
      if (h.length > maxLength) maxLength = h.length;
    });
    if (maxLength === 0) return [];

    return Array.from({ length: maxLength }, (_, index) => {
      let tickTimestamp = null;
      const point = {};
      VENUE_ZONES.forEach((zone) => {
        const zoneHistory = history.get(zone.id) || [];
        const offsetIndex = zoneHistory.length - maxLength + index;
        if (offsetIndex >= 0 && zoneHistory[offsetIndex]) {
          const item = zoneHistory[offsetIndex];
          point[zone.id] = Number(item.risk_score);
          if (!tickTimestamp && item.timestamp) tickTimestamp = item.timestamp;
        }
      });
      return {
        formattedTime: tickTimestamp
          ? new Date(tickTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          : `T-${maxLength - index}`,
        ...point,
      };
    });
  }, [history]);

  const maxRiskRecord = useMemo(() => {
    let max = 0;
    history.forEach((entries) => entries.forEach((e) => { if (e.risk_score > max) max = e.risk_score; }));
    return max;
  }, [history]);

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* ── Controls Panel ── */}
      <div className="cs-card p-5 space-y-4 bg-white border border-slate-200">
        {/* Header row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="p-2 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold text-slate-900">Predictive Risk Trend Analytics</h2>
            </div>
            <p className="text-xs text-slate-500 pl-10.5">
              Rolling 60-second telemetry. Emergency alert triggered at threshold{' '}
              <strong className="text-red-600 font-mono">0.70</strong>.
            </p>
          </div>

          {/* Quick metrics */}
          <div className="flex items-center gap-3 text-xs shrink-0">
            <div className="text-center px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-0.5">
                Peak Threat
              </div>
              <div
                className="font-extrabold text-base font-mono"
                style={{ color: maxRiskRecord >= 0.7 ? '#DC2626' : '#10B981' }}
              >
                {maxRiskRecord.toFixed(2)}
              </div>
            </div>
            <div className="text-center px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-0.5">
                Data Points
              </div>
              <div className="font-extrabold text-base text-slate-800 font-mono">
                {chartData.length}<span className="text-slate-400 font-normal">/20</span>
              </div>
            </div>
          </div>
        </div>

        {/* Zone toggles */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <Eye className="w-4 h-4 text-blue-600" />
            Gate Filter:
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => selectAll(true)}  className="btn-ghost text-xs py-1 px-2.5">Show All</button>
            <button onClick={() => selectAll(false)} className="btn-ghost text-xs py-1 px-2.5">Hide All</button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {VENUE_ZONES.map((zone) => {
            const isVisible = visibleZones[zone.id];
            const strokeColor = getRiskColor(events.get(zone.id)?.risk_level) || zone.defaultColor;
            return (
              <button
                key={zone.id}
                onClick={() => toggleZone(zone.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                  isVisible
                    ? 'bg-white border-slate-300 text-slate-800 shadow-2xs'
                    : 'bg-slate-100 border-slate-200 text-slate-400 opacity-60'
                }`}
              >
                {isVisible
                  ? <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                  : <Square     className="w-3.5 h-3.5 text-slate-400" />
                }
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: strokeColor }} />
                {zone.name}
                <span className="text-[10px] text-slate-400 font-mono">
                  ({zone.id})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Chart Panel ── */}
      <div className="cs-card p-5 bg-white border border-slate-200">
        {chartData.length === 0 ? (
          <div className="h-80 flex flex-col items-center justify-center gap-2 text-slate-400">
            <Activity className="w-8 h-8 animate-pulse-slow text-blue-400" />
            <span className="text-xs font-medium">Aggregating telemetry data streams…</span>
          </div>
        ) : (
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 20, right: 24, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis
                  dataKey="formattedTime"
                  stroke="#94A3B8"
                  tick={{ fontSize: 11, fill: '#64748B', fontFamily: 'JetBrains Mono, monospace' }}
                  dy={8}
                  axisLine={{ stroke: '#E2E8F0' }}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 1]}
                  stroke="#94A3B8"
                  tick={{ fontSize: 11, fill: '#64748B', fontFamily: 'JetBrains Mono, monospace' }}
                  tickFormatter={(v) => v.toFixed(1)}
                  axisLine={false}
                  tickLine={false}
                  dx={-4}
                />
                <RechartsTooltip content={<CustomTooltip />} />
                <ReferenceLine
                  y={0.7}
                  stroke="#DC2626"
                  strokeDasharray="4 4"
                  strokeWidth={2}
                  label={{
                    value: 'Critical Stampede Risk Threshold (0.70)',
                    fill: '#DC2626',
                    position: 'insideTopRight',
                    fontSize: 11,
                    fontWeight: '700',
                  }}
                />
                {VENUE_ZONES.map((zone) => {
                  if (!visibleZones[zone.id]) return null;
                  const strokeColor = getRiskColor(events.get(zone.id)?.risk_level) || zone.defaultColor;
                  return (
                    <Line
                      key={zone.id}
                      type="monotone"
                      dataKey={zone.id}
                      name={zone.name}
                      stroke={strokeColor}
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: strokeColor, strokeWidth: 0 }}
                      activeDot={{ r: 6, fill: strokeColor, stroke: '#FFFFFF', strokeWidth: 2 }}
                      connectNulls
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
