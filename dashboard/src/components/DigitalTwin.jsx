import React from 'react';
import { Radio } from 'lucide-react';

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
    case 'low':      return { fill: '#4A9B6F', stroke: '#2E7D52', text: '#2E7D52', label: 'Low' };
    case 'medium':   return { fill: '#C08B3A', stroke: '#9A6E2D', text: '#9A6E2D', label: 'Medium' };
    case 'high':     return { fill: '#C4582A', stroke: '#9E4520', text: '#9E4520', label: 'High' };
    case 'critical': return { fill: '#B02828', stroke: '#8B1A1A', text: '#8B1A1A', label: 'Critical' };
    default:         return { fill: '#BF897F', stroke: '#A67269', text: '#707B6D', label: 'No Data' };
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
    <div className="space-y-5">
      {/* ── Header Card ── */}
      <div className="cs-card p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="p-2.5 rounded-xl"
            style={{ background: 'var(--cs-salmon-light)', color: 'var(--cs-salmon)' }}
          >
            <Radio className="w-5 h-5 animate-pulse-slow" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-primary">Venue Digital Twin</h2>
            <p className="text-xs text-secondary mt-0.5">
              Real-time 2D spatial diagram — stadium gates, actuators & density risk zones.
            </p>
          </div>
        </div>

        {/* Legend */}
        <div
          className="flex flex-wrap items-center gap-4 text-xs px-4 py-2.5 rounded-xl"
          style={{ background: 'var(--page-bg)', border: '1px solid var(--card-border)', fontFamily: 'Google Sans, sans-serif' }}
        >
          {[
            { color: '#B02828', label: 'Gate Closed' },
            { color: '#4A9B6F', label: 'Gate Open' },
            { color: '#9BA89B', label: 'Gate Normal' },
          ].map(({ color, label }) => (
            <span key={label} className="flex items-center gap-1.5 text-secondary">
              <span className="w-4 h-1.5 rounded" style={{ background: color }} />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* ── SVG Canvas ── */}
      <div className="cs-card p-4 sm:p-6 flex justify-center items-center overflow-x-auto">
        <svg
          viewBox="0 0 800 600"
          className="w-full max-w-[880px] h-auto drop-shadow-lg font-sans select-none"
          style={{ background: '#F7F2E0', borderRadius: 20 }}
        >
          <defs>
            <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

            {/* Warm grid pattern */}
            <pattern id="warmGrid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#DAC2B2" strokeWidth="0.6" opacity="0.5" />
            </pattern>
          </defs>

          {/* Grid background */}
          <rect width="800" height="600" fill="url(#warmGrid)" />

          {/* Outer venue perimeter */}
          <rect
            x="40" y="30" width="720" height="540" rx="36" ry="36"
            fill="rgba(255,255,255,0.7)"
            stroke="#DAC2B2"
            strokeWidth="2"
            strokeDasharray="8 6"
          />
          <text x="60" y="54" fill="#9BA89B" fontSize="10" fontFamily="Google Sans, monospace" fontWeight="600" letterSpacing="0.08em">
            STADIUM PERIMETER BOUNDARY
          </text>

          {/* Inner oval track */}
          <ellipse
            cx="400" cy="300" rx="320" ry="220"
            fill="rgba(218,194,178,0.12)"
            stroke="#BF897F"
            strokeWidth="1.5"
            strokeDasharray="6 5"
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
                    opacity="0.35"
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
                  fillOpacity={isCritical ? 0.22 : 0.14}
                  stroke={colors.stroke}
                  strokeWidth={isCritical ? 3 : 1.8}
                  className={isCritical ? 'animate-pulse-slow' : ''}
                />

                {/* Zone name */}
                <text
                  x={zone.x + zone.width / 2}
                  y={zone.y + (zone.height > 120 ? 44 : 34)}
                  fill={colors.text}
                  fontSize="13"
                  fontWeight="800"
                  fontFamily="Montserrat, sans-serif"
                  textAnchor="middle"
                  letterSpacing="-0.2"
                >
                  {zoneName}
                </text>

                {/* Zone ID */}
                <text
                  x={zone.x + zone.width / 2}
                  y={zone.y + (zone.height > 120 ? 62 : 50)}
                  fill="#9BA89B"
                  fontSize="9"
                  fontFamily="Google Sans, monospace"
                  textAnchor="middle"
                  letterSpacing="0.08em"
                >
                  [{zone.id.toUpperCase()}]
                </text>

                {/* Risk Score pill */}
                <rect
                  x={zone.x + zone.width / 2 - 44}
                  y={zone.y + zone.height - (zone.height > 120 ? 42 : 30)}
                  width="88" height="22" rx="8"
                  fill="rgba(255,255,255,0.85)"
                  stroke={colors.stroke}
                  strokeWidth="1"
                />
                <text
                  x={zone.x + zone.width / 2}
                  y={zone.y + zone.height - (zone.height > 120 ? 27 : 15)}
                  fill={colors.text}
                  fontSize="11"
                  fontFamily="Google Sans, monospace"
                  fontWeight="700"
                  textAnchor="middle"
                >
                  Score: {riskScore}
                </text>

                {/* Gate indicator line */}
                {zone.gateLine && (
                  <g>
                    <line
                      x1={zone.gateLine.x1} y1={zone.gateLine.y1}
                      x2={zone.gateLine.x2} y2={zone.gateLine.y2}
                      stroke={
                        gateState === 'CLOSED' ? '#B02828'
                          : gateState === 'OPEN' ? '#4A9B6F'
                          : '#BF897F'
                      }
                      strokeWidth={gateState !== 'NORMAL' ? 6 : 3}
                      strokeLinecap="round"
                    />
                    <text
                      x={zone.gateLabelPos.x} y={zone.gateLabelPos.y}
                      fill={
                        gateState === 'CLOSED' ? '#B02828'
                          : gateState === 'OPEN' ? '#4A9B6F'
                          : '#9BA89B'
                      }
                      fontSize="9" fontFamily="Google Sans, monospace" fontWeight="700" textAnchor="middle"
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
