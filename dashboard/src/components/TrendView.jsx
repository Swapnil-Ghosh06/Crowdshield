import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip as RechartsTooltip, ReferenceLine
} from 'recharts';
import { TrendingUp, Activity, CheckSquare, Square, Eye } from 'lucide-react';

const VENUE_ZONES = [
  { id: 'gate_1', name: 'South Entrance', defaultColor: '#4A9B6F' },
  { id: 'gate_2', name: 'North Gate',     defaultColor: '#C08B3A' },
  { id: 'gate_3', name: 'East Pavilion',  defaultColor: '#5E6AB2' },
  { id: 'gate_4', name: 'West Exit',      defaultColor: '#C4582A' },
  { id: 'gate_5', name: 'Main Arena',     defaultColor: '#BF897F' },
];

const getRiskColor = (riskLevel) => {
  switch (riskLevel?.toLowerCase()) {
    case 'low':      return '#4A9B6F';
    case 'medium':   return '#C08B3A';
    case 'high':     return '#C4582A';
    case 'critical': return '#B02828';
    default:         return '#9BA89B';
  }
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl p-3 text-xs shadow-xl"
      style={{
        background:  '#FFFFFF',
        border:      '1px solid var(--card-border)',
        fontFamily:  'Google Sans, monospace',
        minWidth:    160,
        boxShadow:   'var(--card-shadow-hover)',
      }}
    >
      <div
        className="font-semibold mb-2 pb-1.5 border-b text-primary"
        style={{ borderColor: 'var(--card-border)' }}
      >
        {label}
      </div>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex justify-between gap-4 py-0.5">
          <div className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: entry.color }}
            />
            <span className="text-secondary">{entry.name}</span>
          </div>
          <span className="font-bold text-primary">{Number(entry.value).toFixed(2)}</span>
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
    <div className="space-y-5">
      {/* ── Controls Panel ── */}
      <div className="cs-card p-5 space-y-4">
        {/* Header row */}
        <div
          className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b"
          style={{ borderColor: 'var(--card-border)' }}
        >
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div
                className="p-2 rounded-xl"
                style={{ background: 'var(--cs-salmon-light)', color: 'var(--cs-salmon)' }}
              >
                <TrendingUp className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-primary">Risk Trend Analytics</h2>
            </div>
            <p className="text-xs text-secondary pl-11">
              Rolling history (last 20 intervals ≈ 60 s). Threshold monitor at{' '}
              <strong style={{ color: 'var(--risk-high)' }}>0.70</strong>.
            </p>
          </div>

          {/* Quick metrics */}
          <div className="flex items-center gap-3 text-xs shrink-0">
            <div
              className="text-center px-4 py-2.5 rounded-xl"
              style={{ background: 'var(--page-bg)', border: '1px solid var(--card-border)' }}
            >
              <div className="text-[10px] uppercase tracking-wider text-muted mb-0.5" style={{ fontFamily: 'Google Sans, monospace' }}>
                Peak Risk
              </div>
              <div
                className="font-extrabold text-base"
                style={{ color: maxRiskRecord >= 0.7 ? 'var(--risk-critical)' : 'var(--risk-low)' }}
              >
                {maxRiskRecord.toFixed(2)}
              </div>
            </div>
            <div
              className="text-center px-4 py-2.5 rounded-xl"
              style={{ background: 'var(--page-bg)', border: '1px solid var(--card-border)' }}
            >
              <div className="text-[10px] uppercase tracking-wider text-muted mb-0.5" style={{ fontFamily: 'Google Sans, monospace' }}>
                Data Points
              </div>
              <div className="font-extrabold text-base text-primary">
                {chartData.length}<span className="text-muted font-normal">/20</span>
              </div>
            </div>
          </div>
        </div>

        {/* Zone toggles */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-secondary">
            <Eye className="w-4 h-4" style={{ color: 'var(--cs-salmon)' }} />
            Toggle Zones:
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => selectAll(true)}  className="btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }}>All On</button>
            <button onClick={() => selectAll(false)} className="btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }}>All Off</button>
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
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                style={{
                  background:   isVisible ? '#FFFFFF' : 'var(--page-bg)',
                  border:       `1px solid ${isVisible ? 'var(--cs-sandstone)' : 'var(--card-border)'}`,
                  color:        isVisible ? 'var(--cs-pewter)' : 'var(--cs-slate-light)',
                  opacity:      isVisible ? 1 : 0.6,
                }}
              >
                {isVisible
                  ? <CheckSquare className="w-4 h-4" style={{ color: 'var(--cs-salmon)' }} />
                  : <Square     className="w-4 h-4 text-muted" />
                }
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: strokeColor }} />
                {zone.name}
                <span
                  className="text-[10px] text-muted uppercase"
                  style={{ fontFamily: 'Google Sans, monospace' }}
                >
                  ({zone.id})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Chart Panel ── */}
      <div className="cs-card p-5">
        {chartData.length === 0 ? (
          <div
            className="h-96 flex flex-col items-center justify-center gap-3"
            style={{ color: 'var(--cs-slate-light)' }}
          >
            <Activity className="w-10 h-10 animate-pulse-slow" style={{ color: 'var(--cs-sandstone)' }} />
            <span className="text-sm text-secondary">Collecting telemetry data…</span>
          </div>
        ) : (
          <div className="h-[420px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 20, right: 24, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8DDD0" vertical={false} />
                <XAxis
                  dataKey="formattedTime"
                  stroke="#9BA89B"
                  tick={{ fontSize: 11, fill: '#707B6D', fontFamily: 'Google Sans, monospace' }}
                  dy={8}
                  axisLine={{ stroke: '#E8DDD0' }}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 1]}
                  stroke="#9BA89B"
                  tick={{ fontSize: 11, fill: '#707B6D', fontFamily: 'Google Sans, monospace' }}
                  tickFormatter={(v) => v.toFixed(1)}
                  axisLine={false}
                  tickLine={false}
                  dx={-4}
                />
                <RechartsTooltip content={<CustomTooltip />} />
                <ReferenceLine
                  y={0.7}
                  stroke="#C4582A"
                  strokeDasharray="5 4"
                  strokeWidth={1.5}
                  label={{
                    value: 'High Risk Threshold (0.70)',
                    fill: '#C4582A',
                    position: 'insideTopRight',
                    fontSize: 11,
                    fontWeight: '600',
                    fontFamily: 'Google Sans, sans-serif',
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
