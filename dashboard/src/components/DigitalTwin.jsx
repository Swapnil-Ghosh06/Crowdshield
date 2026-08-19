import React from 'react';
import { Cpu, Radio, ShieldCheck, AlertTriangle } from 'lucide-react';

const VENUE_ZONES = [
  { id: 'gate_2', name: 'North Gate',     x: 280, y: 75,  width: 240, height: 90,
    gateLine: { x1: 350, y1: 75, x2: 450, y2: 75 }, gateLabelPos: { x: 400, y: 65 } },
  { id: 'gate_5', name: 'Main Arena',     x: 270, y: 205, width: 260, height: 190,
    gateLine: { x1: 350, y1: 395, x2: 450, y2: 395 }, gateLabelPos: { x: 400, y: 410 } },
  { id: 'gate_1', name: 'South Entrance', x: 280, y: 435, width: 240, height: 90,
    gateLine: { x1: 350, y1: 525, x2: 450, y2: 525 }, gateLabelPos: { x: 400, y: 540 } },
  { id: 'gate_4', name: 'West Exit',      x: 85,  y: 210, width: 145, height: 180,
    gateLine: { x1: 85, y1: 260, x2: 85, y2: 340 }, gateLabelPos: { x: 70, y: 300 } },
  { id: 'gate_3', name: 'East Pavilion',  x: 570, y: 210, width: 145, height: 180,
    gateLine: { x1: 715, y1: 260, x2: 715, y2: 340 }, gateLabelPos: { x: 730, y: 300 } },
];

const getRiskColors = (riskLevel) => {
  switch (riskLevel?.toLowerCase()) {
    case 'low':      return { fill: '#10B981', stroke: '#059669', text: '#065F46', bg: '#ECFDF5', label: 'Low' };
    case 'medium':   return { fill: '#F59E0B', stroke: '#D97706', text: '#92400E', bg: '#FFFBEB', label: 'Medium' };
    case 'high':     return { fill: '#EA580C', stroke: '#C2410C', text: '#9A3412', bg: '#FFF7ED', label: 'High' };
    case 'critical': return { fill: '#DC2626', stroke: '#B91C1C', text: '#991B1B', bg: '#FEF2F2', label: 'Critical' };
    default:         return { fill: '#94A3B8', stroke: '#64748B', text: '#334155', bg: '#F8FAFC', label: 'No Data' };
  }
};

const getGateState = (recommendations = []) => {
  const s = (Array.isArray(recommendations) ? recommendations.join(' ') : String(recommendations)).toLowerCase();
  if (s.includes('close_gate') || s.includes('close gate') || s.includes('close emergency')) return 'CLOSED';
  if (s.includes('open_gate')  || s.includes('open gate')  || s.includes('open emergency'))  return 'OPEN';
  return 'NORMAL';
};

export function DigitalTwin({ events }) {
  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* ── Header Card ── */}
      <div className="cs-card p-4.5 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">Venue Digital Twin &amp; Actuators</h2>
              <span className="badge badge-blue">2D Spatial Model</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Live automated gate states, turnstile actuators, and perimeter flow telemetry.
            </p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-xs px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 font-medium">
          {[
            { color: '#DC2626', label: 'Gate Closed (Intervention)' },
            { color: '#10B981', label: 'Gate Open (Evac/Reroute)' },
            { color: '#64748B', label: 'Normal Flow' },
          ].map(({ color, label }) => (
            <span key={label} className="flex items-center gap-1.5 text-slate-700">
              <span className="w-3 h-1.5 rounded-sm" style={{ background: color }} />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* ── SVG Digital Twin Canvas ── */}
      <div className="cs-card p-4 sm:p-6 flex justify-center items-center overflow-x-auto bg-slate-900 border border-slate-800 shadow-lg">
        <svg
          viewBox="0 0 800 600"
          className="w-full max-w-[880px] h-auto font-sans select-none"
          style={{ borderRadius: 16 }}
        >
          <defs>
            <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

            {/* High-tech telemetry blueprint grid */}
            <pattern id="telemetryGrid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1E293B" strokeWidth="0.8" />
            </pattern>
          </defs>

          {/* Grid background */}
          <rect width="800" height="600" fill="#0B132B" />
          <rect width="800" height="600" fill="url(#telemetryGrid)" />

          {/* Outer venue perimeter */}
          <rect
            x="40" y="30" width="720" height="540" rx="36" ry="36"
            fill="rgba(15, 23, 42, 0.6)"
            stroke="#334155"
            strokeWidth="2"
            strokeDasharray="8 6"
          />
          <text x="60" y="54" fill="#64748B" fontSize="10" fontFamily="JetBrains Mono, monospace" fontWeight="600" letterSpacing="0.08em">
            STADIUM PERIMETER TELEMETRY BOUNDARY
          </text>

          {/* Inner oval track */}
          <ellipse
            cx="400" cy="300" rx="320" ry="220"
            fill="rgba(30, 41, 59, 0.2)"
            stroke="#3B82F6"
            strokeWidth="1.5"
            strokeDasharray="6 5"
            strokeOpacity="0.4"
          />

          {/* Zone rectangles */}
          {VENUE_ZONES.map((zone) => {
            const eventData      = events.get(zone.id);
            const riskLevel      = eventData?.risk_level || 'no data';
            const riskScore      = eventData?.risk_score != null ? Number(eventData.risk_score).toFixed(2) : 'N/A';
            const zoneName       = eventData?.zone_name || zone.name;
            const recommendations = eventData?.recommendations || [];
            const gateState      = getGateState(recommendations);
            const colors         = getRiskColors(riskLevel);
            const isCritical     = riskLevel?.toLowerCase() === 'critical';
            const isHigh         = riskLevel?.toLowerCase() === 'high';

            return (
              <g key={zone.id} className="transition-all duration-300">
                {/* Glow aura for critical/high */}
                {(isCritical || isHigh) && (
                  <rect
                    x={zone.x - 8} y={zone.y - 8}
                    width={zone.width + 16} height={zone.height + 16}
                    rx="20" ry="20"
                    fill="none"
                    stroke={colors.stroke}
                    strokeWidth="2"
                    opacity="0.6"
                    className={isCritical ? 'animate-pulse-slow' : ''}
                    filter="url(#softGlow)"
                  />
                )}

                {/* Zone fill rectangle */}
                <rect
                  x={zone.x} y={zone.y}
                  width={zone.width} height={zone.height}
                  rx="14" ry="14"
                  fill={colors.fill}
                  fillOpacity={isCritical ? 0.25 : 0.15}
                  stroke={colors.stroke}
                  strokeWidth={isCritical ? 2.5 : 1.5}
                />

                {/* Zone name */}
                <text
                  x={zone.x + zone.width / 2}
                  y={zone.y + (zone.height > 120 ? 44 : 34)}
                  fill="#FFFFFF"
                  fontSize="13"
                  fontWeight="800"
                  fontFamily="Plus Jakarta Sans, sans-serif"
                  textAnchor="middle"
                >
                  {zoneName}
                </text>

                {/* Zone ID */}
                <text
                  x={zone.x + zone.width / 2}
                  y={zone.y + (zone.height > 120 ? 62 : 50)}
                  fill="#94A3B8"
                  fontSize="9"
                  fontFamily="JetBrains Mono, monospace"
                  textAnchor="middle"
                  letterSpacing="0.08em"
                >
                  [{zone.id.toUpperCase()}]
                </text>

                {/* Risk Score pill */}
                <rect
                  x={zone.x + zone.width / 2 - 46}
                  y={zone.y + zone.height - (zone.height > 120 ? 42 : 30)}
                  width="92" height="22" rx="6"
                  fill="#0F172A"
                  stroke={colors.stroke}
                  strokeWidth="1"
                />
                <text
                  x={zone.x + zone.width / 2}
                  y={zone.y + zone.height - (zone.height > 120 ? 27 : 15)}
                  fill={colors.stroke}
                  fontSize="11"
                  fontFamily="JetBrains Mono, monospace"
                  fontWeight="700"
                  textAnchor="middle"
                >
                  Risk: {riskScore}
                </text>

                {/* Gate indicator line */}
                {zone.gateLine && (
                  <g>
                    <line
                      x1={zone.gateLine.x1} y1={zone.gateLine.y1}
                      x2={zone.gateLine.x2} y2={zone.gateLine.y2}
                      stroke={
                        gateState === 'CLOSED' ? '#DC2626'
                          : gateState === 'OPEN' ? '#10B981'
                          : '#64748B'
                      }
                      strokeWidth={gateState !== 'NORMAL' ? 6 : 3}
                      strokeLinecap="round"
                    />
                    <text
                      x={zone.gateLabelPos.x} y={zone.gateLabelPos.y}
                      fill={
                        gateState === 'CLOSED' ? '#EF4444'
                          : gateState === 'OPEN' ? '#34D399'
                          : '#94A3B8'
                      }
                      fontSize="9" fontFamily="JetBrains Mono, monospace" fontWeight="700" textAnchor="middle"
                    >
                      {gateState === 'CLOSED' ? 'GATE CLOSED' : gateState === 'OPEN' ? 'GATE OPEN' : 'NORMAL GATE'}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
