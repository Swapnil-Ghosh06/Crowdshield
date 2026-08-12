import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ReferenceLine
} from 'recharts';
import { TrendingUp, Activity, CheckSquare, Square, Eye, AlertTriangle } from 'lucide-react';

const VENUE_ZONES = [
  { id: 'gate_1', name: 'South Entrance', defaultColor: '#22c55e' },
  { id: 'gate_2', name: 'North Gate', defaultColor: '#eab308' },
  { id: 'gate_3', name: 'East Pavilion', defaultColor: '#3b82f6' },
  { id: 'gate_4', name: 'West Exit', defaultColor: '#f97316' },
  { id: 'gate_5', name: 'Main Arena', defaultColor: '#ef4444' }
];

const getRiskColor = (riskLevel) => {
  switch (riskLevel?.toLowerCase()) {
    case 'low':
      return '#22c55e';
    case 'medium':
      return '#eab308';
    case 'high':
      return '#f97316';
    case 'critical':
      return '#ef4444';
    default:
      return '#6b7280';
  }
};

export function TrendView({ history, events }) {
  // State to toggle line visibility per zone
  const [visibleZones, setVisibleZones] = useState({
    gate_1: true,
    gate_2: true,
    gate_3: true,
    gate_4: true,
    gate_5: true
  });

  const toggleZone = (zoneId) => {
    setVisibleZones((prev) => ({
      ...prev,
      [zoneId]: !prev[zoneId]
    }));
  };

  const selectAll = (enable) => {
    const updated = {};
    VENUE_ZONES.forEach((z) => {
      updated[z.id] = enable;
    });
    setVisibleZones(updated);
  };

  // Process rolling history into Recharts data format
  // Recharts requires [{ formattedTime: '19:43:10', gate_1: 0.4, gate_2: 0.8 }, ...]
  const chartData = useMemo(() => {
    // Find the max length of history across zones (up to 20)
    let maxLength = 0;
    VENUE_ZONES.forEach((zone) => {
      const zoneHistory = history.get(zone.id) || [];
      if (zoneHistory.length > maxLength) {
        maxLength = zoneHistory.length;
      }
    });

    if (maxLength === 0) return [];

    // Build tick items from index 0 to maxLength - 1
    const ticks = [];
    for (let index = 0; index < maxLength; index++) {
      let tickTimestamp = null;
      const point = {};

      VENUE_ZONES.forEach((zone) => {
        const zoneHistory = history.get(zone.id) || [];
        // Map relative to latest entry
        const offsetIndex = zoneHistory.length - maxLength + index;
        if (offsetIndex >= 0 && zoneHistory[offsetIndex]) {
          const item = zoneHistory[offsetIndex];
          point[zone.id] = Number(item.risk_score);
          if (!tickTimestamp && item.timestamp) {
            tickTimestamp = item.timestamp;
          }
        }
      });

      const formattedTime = tickTimestamp
        ? new Date(tickTimestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          })
        : `T-${maxLength - index}`;

      ticks.push({
        formattedTime,
        ...point
      });
    }

    return ticks;
  }, [history]);

  // Compute peak risk score recorded across all history entries
  const maxRiskRecord = useMemo(() => {
    let max = 0;
    history.forEach((entries) => {
      entries.forEach((e) => {
        if (e.risk_score > max) max = e.risk_score;
      });
    });
    return max;
  }, [history]);

  return (
    <div className="space-y-6">
      {/* Analytics Banner & Legend Header */}
      <div className="glass-panel rounded-2xl p-5 border border-slate-800 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                <TrendingUp className="w-5 h-5 text-indigo-400" />
              </div>
              <h2 className="text-xl font-bold text-slate-100">
                Risk Telemetry Trend Analytics
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Client-side rolling history (last 20 intervals ~60 seconds). Threshold monitor set at 0.70 risk score.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
              <span className="text-slate-500 block text-[10px]">PEAK RISK RECORDED</span>
              <span className={`font-extrabold text-sm ${maxRiskRecord >= 0.7 ? 'text-red-400' : 'text-emerald-400'}`}>
                {maxRiskRecord.toFixed(2)}
              </span>
            </div>
            <div className="bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
              <span className="text-slate-500 block text-[10px]">HISTORY TICKS</span>
              <span className="font-bold text-slate-200 text-sm">
                {chartData.length} / 20
              </span>
            </div>
          </div>
        </div>

        {/* Legend & Toggle Checkboxes */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Eye className="w-4 h-4 text-indigo-400" />
            Toggle Zone Lines:
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => selectAll(true)}
              className="px-2 py-0.5 text-[10px] font-mono bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 rounded transition-colors"
            >
              Select All
            </button>
            <button
              onClick={() => selectAll(false)}
              className="px-2 py-0.5 text-[10px] font-mono bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 rounded transition-colors"
            >
              Deselect All
            </button>
          </div>
        </div>

        {/* Zone Checkboxes Grid */}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          {VENUE_ZONES.map((zone) => {
            const isVisible = visibleZones[zone.id];
            const currentEvt = events.get(zone.id);
            const dynamicColor = getRiskColor(currentEvt?.risk_level);
            const strokeColor = currentEvt ? dynamicColor : zone.defaultColor;

            return (
              <button
                key={zone.id}
                onClick={() => toggleZone(zone.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                  isVisible
                    ? 'bg-slate-900/90 border-slate-700 text-slate-100 shadow-sm'
                    : 'bg-slate-950/60 border-slate-900 text-slate-600 opacity-60'
                }`}
              >
                {isVisible ? (
                  <CheckSquare className="w-4 h-4 text-indigo-400" />
                ) : (
                  <Square className="w-4 h-4 text-slate-600" />
                )}
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: strokeColor }}
                />
                <span>{zone.name}</span>
                <span className="text-[10px] font-mono text-slate-500 uppercase">
                  ({zone.id})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Recharts Line Chart Card */}
      <div className="glass-panel rounded-2xl p-5 border border-slate-800">
        {chartData.length === 0 ? (
          <div className="h-[420px] flex flex-col items-center justify-center text-slate-500 font-mono text-xs space-y-2">
            <Activity className="w-8 h-8 text-slate-600 animate-pulse" />
            <span>Collecting time series telemetry data...</span>
          </div>
        ) : (
          <div className="h-[450px] w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                
                <XAxis
                  dataKey="formattedTime"
                  stroke="#94a3b8"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  dy={10}
                />
                
                <YAxis
                  domain={[0, 1]}
                  stroke="#94a3b8"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickFormatter={(val) => val.toFixed(1)}
                  dx={-5}
                />

                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '0.75rem',
                    color: '#f8fafc',
                    fontSize: '12px',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)'
                  }}
                  itemStyle={{ padding: '2px 0' }}
                />

                {/* Horizontal Reference Line at y=0.7 labeled "High Risk Threshold" in orange */}
                <ReferenceLine
                  y={0.7}
                  stroke="#f97316"
                  strokeDasharray="4 4"
                  strokeWidth={2}
                  label={{
                    value: 'High Risk Threshold (0.70)',
                    fill: '#f97316',
                    position: 'top',
                    fontSize: 12,
                    fontWeight: 'bold'
                  }}
                />

                {/* Render one Line per zone */}
                {VENUE_ZONES.map((zone) => {
                  if (!visibleZones[zone.id]) return null;

                  const currentEvt = events.get(zone.id);
                  const dynamicColor = getRiskColor(currentEvt?.risk_level);
                  const strokeColor = currentEvt ? dynamicColor : zone.defaultColor;

                  return (
                    <Line
                      key={zone.id}
                      type="monotone"
                      dataKey={zone.id}
                      name={zone.name}
                      stroke={strokeColor}
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: strokeColor }}
                      activeDot={{ r: 6, stroke: '#ffffff', strokeWidth: 2 }}
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
