import React from 'react';
import { ShieldAlert, Info, DoorClosed, DoorOpen, Radio } from 'lucide-react';

const VENUE_ZONES = [
  { 
    id: 'gate_2', 
    name: 'North Gate', 
    x: 280, y: 75, width: 240, height: 90, 
    gateLine: { x1: 350, y1: 75, x2: 450, y2: 75 },
    gateLabelPos: { x: 400, y: 65 }
  },
  { 
    id: 'gate_5', 
    name: 'Main Arena', 
    x: 270, y: 205, width: 260, height: 190, 
    gateLine: { x1: 350, y1: 395, x2: 450, y2: 395 },
    gateLabelPos: { x: 400, y: 410 }
  },
  { 
    id: 'gate_1', 
    name: 'South Entrance', 
    x: 280, y: 435, width: 240, height: 90, 
    gateLine: { x1: 350, y1: 525, x2: 450, y2: 525 },
    gateLabelPos: { x: 400, y: 540 }
  },
  { 
    id: 'gate_4', 
    name: 'West Exit', 
    x: 85, y: 210, width: 145, height: 180, 
    gateLine: { x1: 85, y1: 260, x2: 85, y2: 340 },
    gateLabelPos: { x: 70, y: 300 }
  },
  { 
    id: 'gate_3', 
    name: 'East Pavilion', 
    x: 570, y: 210, width: 145, height: 180, 
    gateLine: { x1: 715, y1: 260, x2: 715, y2: 340 },
    gateLabelPos: { x: 730, y: 300 }
  }
];

const getRiskColor = (riskLevel) => {
  switch (riskLevel?.toLowerCase()) {
    case 'low':
      return { fill: '#22c55e', stroke: '#16a34a', text: '#22c55e', name: 'Low' };
    case 'medium':
      return { fill: '#eab308', stroke: '#ca8a04', text: '#eab308', name: 'Medium' };
    case 'high':
      return { fill: '#f97316', stroke: '#ea580c', text: '#f97316', name: 'High' };
    case 'critical':
      return { fill: '#ef4444', stroke: '#dc2626', text: '#ef4444', name: 'Critical' };
    default:
      return { fill: '#6b7280', stroke: '#4b5563', text: '#9ca3af', name: 'No Data' };
  }
};

/**
 * Determine gate indicator status from recommendation strings
 */
const getGateState = (recommendations = []) => {
  const recString = Array.isArray(recommendations)
    ? recommendations.join(' ').toLowerCase()
    : String(recommendations).toLowerCase();

  if (recString.includes('close_gate') || recString.includes('close gate') || recString.includes('close emergency') || recString.includes('close barrier')) {
    return 'CLOSED'; // Red line
  }
  if (recString.includes('open_gate') || recString.includes('open gate') || recString.includes('open emergency') || recString.includes('open barrier')) {
    return 'OPEN'; // Green line
  }
  return 'NORMAL';
};

export function DigitalTwin({ events }) {
  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="glass-panel rounded-2xl p-5 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Radio className="w-5 h-5 animate-pulse text-indigo-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                Venue Digital Twin (2D Topography)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time SVG spatial diagram of the stadium layout, gate actuators, and density risk zones.
              </p>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-mono bg-slate-900/90 px-3.5 py-2 rounded-xl border border-slate-800">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-1 bg-red-500 rounded" /> Gate Closed (Red)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-1 bg-emerald-500 rounded" /> Gate Open (Green)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" /> Critical Pulse
          </span>
        </div>
      </div>

      {/* SVG Diagram Canvas Container */}
      <div className="glass-panel rounded-2xl p-4 sm:p-6 border border-slate-800 flex justify-center items-center overflow-x-auto">
        <svg
          viewBox="0 0 800 600"
          className="w-full max-w-[850px] h-auto drop-shadow-2xl font-sans select-none"
          style={{ background: '#070b14', borderRadius: '1.25rem' }}
        >
          <defs>
            {/* Pulsing glow filter for critical risk zones */}
            <filter id="criticalGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

            {/* Subtle background grid pattern */}
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth="0.5" opacity="0.4" />
            </pattern>
          </defs>

          {/* Grid Background */}
          <rect width="800" height="600" fill="url(#grid)" />

          {/* Outer Venue Perimeter Border */}
          <rect
            x="40"
            y="30"
            width="720"
            height="540"
            rx="36"
            ry="36"
            fill="#0b1120"
            fillOpacity="0.8"
            stroke="#334155"
            strokeWidth="3"
            strokeDasharray="8 6"
          />
          <text x="60" y="55" fill="#64748b" fontSize="11" fontFamily="monospace" fontWeight="bold">
            STADIUM PERIMETER BOUNDARY (800x600 TOP-DOWN)
          </text>

          {/* Inner Stadium Running Oval Track Visual */}
          <ellipse
            cx="400"
            cy="300"
            rx="330"
            ry="230"
            fill="none"
            stroke="#1e293b"
            strokeWidth="2"
            strokeDasharray="4 4"
          />

          {/* Render 5 Venue Zone Rectangles */}
          {VENUE_ZONES.map((zone) => {
            const eventData = events.get(zone.id);
            const riskLevel = eventData?.risk_level || 'no data yet';
            const riskScore = eventData?.risk_score !== undefined && eventData?.risk_score !== null
              ? Number(eventData.risk_score).toFixed(2)
              : 'N/A';
            const zoneName = eventData?.zone_name || zone.name;
            const recommendations = eventData?.recommendations || [];
            const gateState = getGateState(recommendations);
            const colors = getRiskColor(riskLevel);
            const isCritical = riskLevel?.toLowerCase() === 'critical';

            return (
              <g key={zone.id} className="transition-all duration-300">
                {/* Critical Risk Pulsing Outer Aura */}
                {isCritical && (
                  <rect
                    x={zone.x - 6}
                    y={zone.y - 6}
                    width={zone.width + 12}
                    height={zone.height + 12}
                    rx="18"
                    ry="18"
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="3"
                    className="animate-pulse"
                    filter="url(#criticalGlow)"
                  />
                )}

                {/* Zone Rectangle Fill & Border */}
                <rect
                  x={zone.x}
                  y={zone.y}
                  width={zone.width}
                  height={zone.height}
                  rx="14"
                  ry="14"
                  fill={colors.fill}
                  fillOpacity={isCritical ? "0.35" : "0.22"}
                  stroke={colors.stroke}
                  strokeWidth={isCritical ? "3.5" : "2"}
                  className={`transition-all duration-300 ${isCritical ? 'animate-pulse' : ''}`}
                />

                {/* Zone Content Labels */}
                {/* Zone Name */}
                <text
                  x={zone.x + zone.width / 2}
                  y={zone.y + (zone.height > 120 ? 45 : 35)}
                  fill="#f8fafc"
                  fontSize="14"
                  fontWeight="800"
                  textAnchor="middle"
                  className="font-sans tracking-wide"
                >
                  {zoneName}
                </text>

                {/* Zone ID Tag */}
                <text
                  x={zone.x + zone.width / 2}
                  y={zone.y + (zone.height > 120 ? 65 : 52)}
                  fill="#94a3b8"
                  fontSize="10"
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  [{zone.id.toUpperCase()}]
                </text>

                {/* Risk Score Pill */}
                <rect
                  x={zone.x + zone.width / 2 - 45}
                  y={zone.y + zone.height - (zone.height > 120 ? 45 : 32)}
                  width="90"
                  height="22"
                  rx="6"
                  fill="#0f172a"
                  fillOpacity="0.9"
                  stroke={colors.stroke}
                  strokeWidth="1"
                />
                <text
                  x={zone.x + zone.width / 2}
                  y={zone.y + zone.height - (zone.height > 120 ? 30 : 17)}
                  fill={colors.text}
                  fontSize="11"
                  fontFamily="monospace"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  Score: {riskScore}
                </text>

                {/* Gate Indicator Line on Zone Edge */}
                {/* Thick RED line if close_gate, GREEN line if open_gate */}
                {zone.gateLine && (
                  <g>
                    <line
                      x1={zone.gateLine.x1}
                      y1={zone.gateLine.y1}
                      x2={zone.gateLine.x2}
                      y2={zone.gateLine.y2}
                      stroke={
                        gateState === 'CLOSED'
                          ? '#ef4444'
                          : gateState === 'OPEN'
                          ? '#22c55e'
                          : '#64748b'
                      }
                      strokeWidth={gateState !== 'NORMAL' ? '6' : '3'}
                      strokeLinecap="round"
                    />

                    {/* Gate State Tag */}
                    <text
                      x={zone.gateLabelPos.x}
                      y={zone.gateLabelPos.y}
                      fill={
                        gateState === 'CLOSED'
                          ? '#ef4444'
                          : gateState === 'OPEN'
                          ? '#22c55e'
                          : '#94a3b8'
                      }
                      fontSize="9"
                      fontFamily="monospace"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      {gateState === 'CLOSED' ? 'GATE CLOSED' : gateState === 'OPEN' ? 'GATE OPEN' : 'GATE'}
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
