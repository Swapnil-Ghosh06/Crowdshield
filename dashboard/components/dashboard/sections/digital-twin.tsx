'use client'

import React, { useMemo, useState, useEffect, useRef, lazy, Suspense } from 'react'
import {
  Cpu, AlertTriangle, CheckCircle2, Clock, TrendingUp, TrendingDown,
  Users, ArrowRight, Zap, Shield, Activity, Radio, ChevronRight,
  BarChart3, GitBranch, Play, Pause, Box, ChevronDown, ChevronUp,
  LayoutGrid, Layers
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCrowdShield } from '@/lib/crowdshield/context'
import { ZONES } from '@/lib/crowdshield/zones'
import { getRiskColor } from '@/lib/crowdshield/theme'
import type { RiskLevel } from '@/lib/crowdshield/types'

// Lazy-load Three.js simulation (only when 3D panel is expanded)
const CrowdSimulation3D = lazy(() =>
  import('@/components/dashboard/3d/crowd-simulation-3d').then(m => ({ default: m.CrowdSimulation3D }))
)

// ── Scenario Timeline Data ─────────────────────────────────────────────────
const SCENARIO_STAGES = [
  {
    id: 0,
    time: 'T+0',
    label: 'Event Opens',
    icon: 'play',
    description: 'Gates open. Crowd begins entering from South & West entrances.',
    densities: { gate_1: 1.2, gate_2: 0.9, gate_3: 0.4, gate_4: 0.5, center: 0.8 },
    riskLevel: 'low' as RiskLevel,
    aiAction: null,
  },
  {
    id: 1,
    time: 'T+8m',
    label: 'South Gate Surge',
    icon: 'alert',
    description: 'South Gate density climbs to 4.1 p/m². Flow velocity drops 40%.',
    densities: { gate_1: 4.1, gate_2: 1.8, gate_3: 0.6, gate_4: 0.9, center: 2.1 },
    riskLevel: 'medium' as RiskLevel,
    aiAction: null,
  },
  {
    id: 2,
    time: 'T+14m',
    label: '⚠ Crush Risk Detected',
    icon: 'critical',
    description: 'AI model detects pre-crush pattern. ETA to critical: 8 minutes. Turbulence index 0.72.',
    densities: { gate_1: 5.9, gate_2: 2.4, gate_3: 0.7, gate_4: 1.1, center: 3.4 },
    riskLevel: 'high' as RiskLevel,
    aiAction: 'CrowdShield AI activates rerouting protocol',
  },
  {
    id: 3,
    time: 'T+16m',
    label: 'AI Intervenes',
    icon: 'shield',
    description: 'Barricades deploy. Gate 3 (North) opened fully. PA broadcast in Hindi + English.',
    densities: { gate_1: 4.2, gate_2: 2.1, gate_3: 2.8, gate_4: 2.2, center: 2.6 },
    riskLevel: 'medium' as RiskLevel,
    aiAction: 'Reroute 35% → North Gate · Deploy 4 personnel · PA activated',
  },
  {
    id: 4,
    time: 'T+22m',
    label: '✓ Normalised',
    icon: 'check',
    description: 'Crowd balanced across all 4 gates. Crush event averted. Flow efficiency 94%.',
    densities: { gate_1: 2.2, gate_2: 2.0, gate_3: 2.4, gate_4: 2.1, center: 1.8 },
    riskLevel: 'low' as RiskLevel,
    aiAction: null,
  },
]

// AI Decision Log entries
const AI_DECISION_LOG = [
  { time: '00:14', type: 'action', text: 'Gate 1 → REROUTE 35% flow to Gate 3 (North Entrance)', resolved: true },
  { time: '00:22', type: 'deploy', text: 'Barricade deployed at Zone B2 — South Gate funnel', resolved: true },
  { time: '00:31', type: 'broadcast', text: 'PA Broadcast triggered: "Please proceed to North exits" (Hindi + English)', resolved: true },
  { time: '00:38', type: 'staff', text: 'Move 4 personnel from Zone A to South Gate choke point', resolved: true },
  { time: '00:45', text: 'Crush risk reduced: 87% → 12% · Flow efficiency restored to 94%', type: 'result', resolved: true },
]

// ── Density to Color mapping ──────────────────────────────────────────────
function getRiskInfo(d: number): {
  level: RiskLevel
  label: string
  bg: string
  border: string
  text: string
  fill: string
  stroke: string
} {
  if (d >= 5.0) {
    return {
      level: 'critical',
      label: 'CRITICAL',
      bg: 'rgba(239, 68, 68, 0.22)',
      border: 'rgba(239, 68, 68, 0.85)',
      text: '#dc2626',
      fill: 'rgba(239, 68, 68, 0.55)',
      stroke: 'rgba(239, 68, 68, 0.9)',
    }
  }
  if (d >= 3.0) {
    return {
      level: 'high',
      label: 'HIGH',
      bg: 'rgba(249, 115, 22, 0.20)',
      border: 'rgba(249, 115, 22, 0.80)',
      text: '#ea580c',
      fill: 'rgba(249, 115, 22, 0.45)',
      stroke: 'rgba(249, 115, 22, 0.85)',
    }
  }
  if (d >= 1.5) {
    return {
      level: 'medium',
      label: 'MEDIUM',
      bg: 'rgba(234, 179, 8, 0.18)',
      border: 'rgba(234, 179, 8, 0.70)',
      text: '#ca8a04',
      fill: 'rgba(234, 179, 8, 0.35)',
      stroke: 'rgba(234, 179, 8, 0.75)',
    }
  }
  return {
    level: 'low',
    label: 'SAFE',
    bg: 'rgba(34, 197, 94, 0.16)',
    border: 'rgba(34, 197, 94, 0.60)',
    text: '#16a34a',
    fill: 'rgba(34, 197, 94, 0.28)',
    stroke: 'rgba(34, 197, 94, 0.65)',
  }
}

// Calculates cell density accurately mapped to real venue zone sectors
function getSectorDensity(
  col: number,
  row: number,
  densities: Record<string, number>,
  mode: 'baseline' | 'ai'
): number {
  const south = densities.gate_1 ?? 1.5
  const west = densities.gate_2 ?? 1.0
  const north = densities.gate_3 ?? 0.8
  const east = densities.gate_4 ?? 0.9
  const center = densities.center ?? 1.2

  // Center Concourse (col 3, row 2)
  if (col === 3 && row === 2) return center

  // South Approach Corridor (rows 3, 4, middle cols 2, 3, 4)
  if (row >= 3 && col >= 2 && col <= 4) {
    const factor = row === 4 ? 0.95 : 0.75
    return south * factor + center * (1 - factor)
  }

  // North Approach Corridor (rows 0, 1, middle cols 2, 3, 4)
  if (row <= 1 && col >= 2 && col <= 4) {
    const factor = row === 0 ? 0.95 : 0.75
    return north * factor + center * (1 - factor)
  }

  // West Corridor (middle rows 1, 2, 3, left cols 0, 1)
  if (col <= 1 && row >= 1 && row <= 3) {
    const factor = col === 0 ? 0.95 : 0.75
    return west * factor + center * (1 - factor)
  }

  // East Corridor (middle rows 1, 2, 3, right cols 5, 6)
  if (col >= 5 && row >= 1 && row <= 3) {
    const factor = col === 6 ? 0.95 : 0.75
    return east * factor + center * (1 - factor)
  }

  // Bypass routes in AI mode: crowd is actively moving along the edges
  if (mode === 'ai') {
    if ((col <= 1 && row >= 3) || (col >= 5 && row >= 3)) {
      return 1.4 + Math.sin(col + row) * 0.3
    }
  }

  // Corner buffer zones (calm peripheral areas)
  return 0.6 + Math.abs(Math.sin(col * 2 + row)) * 0.4
}

// ── Venue Heatmap SVG Component ────────────────────────────────────────────
function VenueHeatmap({
  densities,
  mode,
  stageDensities,
}: {
  densities: Record<string, number>
  mode: 'baseline' | 'ai'
  stageDensities: Record<string, number>
}) {
  const effectiveDensities = mode === 'baseline' ? stageDensities : densities

  // Floor dimensions & generous padding to ensure zero label clipping
  const cols = 7
  const rows = 5
  const cellW = 58
  const cellH = 48
  const gridX = 135
  const gridY = 70
  const gridW = cols * cellW
  const gridH = rows * cellH
  const totalW = 676
  const totalH = 420

  // Gate definitions with explicit card positioning
  const gateBadges = [
    {
      id: 'gate_3',
      name: 'North Gate',
      density: effectiveDensities.gate_3 ?? 0.8,
      cardX: gridX + gridW / 2 - 68,
      cardY: 10,
      attachX: gridX + gridW / 2,
      attachY: gridY,
      align: 'top',
    },
    {
      id: 'gate_1',
      name: 'South Gate',
      density: effectiveDensities.gate_1 ?? 2.2,
      cardX: gridX + gridW / 2 - 68,
      cardY: gridY + gridH + 24,
      attachX: gridX + gridW / 2,
      attachY: gridY + gridH,
      align: 'bottom',
    },
    {
      id: 'gate_2',
      name: 'West Gate',
      density: effectiveDensities.gate_2 ?? 1.2,
      cardX: 8,
      cardY: gridY + gridH / 2 - 24,
      attachX: gridX,
      attachY: gridY + gridH / 2,
      align: 'left',
    },
    {
      id: 'gate_4',
      name: 'East Gate',
      density: effectiveDensities.gate_4 ?? 1.1,
      cardX: gridX + gridW + 20,
      cardY: gridY + gridH / 2 - 24,
      attachX: gridX + gridW,
      attachY: gridY + gridH / 2,
      align: 'right',
    },
  ]

  const centerDensity = effectiveDensities.center ?? 1.5
  const centerRisk = getRiskInfo(centerDensity)

  return (
    <div className="w-full h-full flex items-center justify-center">
      <svg
        viewBox={`0 0 ${totalW} ${totalH}`}
        className="w-full h-auto max-h-[380px] rounded-xl select-none"
        style={{ background: '#F6F3EE' }}
      >
        <defs>
          {/* Arrowhead Markers */}
          <marker
            id="arr-safe"
            markerWidth="6"
            markerHeight="6"
            refX="4"
            refY="3"
            orient="auto"
          >
            <path d="M0,1 L0,5 L5,3 z" fill="#16a34a" />
          </marker>
          <marker
            id="arr-crit"
            markerWidth="6"
            markerHeight="6"
            refX="4"
            refY="3"
            orient="auto"
          >
            <path d="M0,1 L0,5 L5,3 z" fill="#dc2626" />
          </marker>
          <marker
            id="arr-bypass"
            markerWidth="7"
            markerHeight="7"
            refX="5"
            refY="3.5"
            orient="auto"
          >
            <path d="M0,1 L0,6 L6,3.5 z" fill="#16a34a" />
          </marker>
        </defs>

        {/* ── Floor Background Perimeter ───────────────────────────────── */}
        <rect
          x={gridX - 4}
          y={gridY - 4}
          width={gridW + 8}
          height={gridH + 8}
          rx={12}
          fill="#ECE6DC"
          stroke="#C8B8A2"
          strokeWidth={1.5}
        />

        {/* ── Correlated Heatmap Grid Cells ────────────────────────────── */}
        {Array.from({ length: rows }).map((_, r) =>
          Array.from({ length: cols }).map((_, c) => {
            const d = getSectorDensity(c, r, effectiveDensities, mode)
            const risk = getRiskInfo(d)
            const cellX = gridX + c * cellW
            const cellY = gridY + r * cellH

            return (
              <g key={`${c}-${r}`}>
                <rect
                  x={cellX + 2}
                  y={cellY + 2}
                  width={cellW - 4}
                  height={cellH - 4}
                  rx={6}
                  fill={risk.fill}
                  stroke={risk.stroke}
                  strokeWidth={1}
                />
                <text
                  x={cellX + cellW / 2}
                  y={cellY + cellH / 2 + 3}
                  textAnchor="middle"
                  fontSize="9"
                  fontFamily="'Montserrat', sans-serif"
                  fontWeight="700"
                  fill={risk.text}
                  opacity={0.85}
                >
                  {d.toFixed(1)}
                </text>
              </g>
            )
          })
        )}

        {/* ── AI Mode: Active Guidance Bypass Routes ────────────────────── */}
        {mode === 'ai' && (
          <>
            {/* West Bypass Lane */}
            <path
              d={`M ${gridX + gridW / 2 - 20} ${gridY + gridH - 10} Q ${gridX + 40} ${gridY + gridH - 30} ${gridX + 10} ${gridY + gridH / 2 + 20}`}
              fill="none"
              stroke="#16a34a"
              strokeWidth={3}
              strokeDasharray="6 4"
              markerEnd="url(#arr-bypass)"
            />
            {/* East Bypass Lane */}
            <path
              d={`M ${gridX + gridW / 2 + 20} ${gridY + gridH - 10} Q ${gridX + gridW - 40} ${gridY + gridH - 30} ${gridX + gridW - 10} ${gridY + gridH / 2 + 20}`}
              fill="none"
              stroke="#16a34a"
              strokeWidth={3}
              strokeDasharray="6 4"
              markerEnd="url(#arr-bypass)"
            />
            {/* AI Bypass Badge Pills */}
            <rect
              x={gridX + 16}
              y={gridY + gridH - 42}
              width={76}
              height={18}
              rx={9}
              fill="rgba(22, 163, 74, 0.9)"
            />
            <text
              x={gridX + 54}
              y={gridY + gridH - 30}
              textAnchor="middle"
              fontSize="8"
              fontFamily="'Montserrat', sans-serif"
              fontWeight="800"
              fill="#ffffff"
            >
              WEST BYPASS
            </text>

            <rect
              x={gridX + gridW - 92}
              y={gridY + gridH - 42}
              width={76}
              height={18}
              rx={9}
              fill="rgba(22, 163, 74, 0.9)"
            />
            <text
              x={gridX + gridW - 54}
              y={gridY + gridH - 30}
              textAnchor="middle"
              fontSize="8"
              fontFamily="'Montserrat', sans-serif"
              fontWeight="800"
              fill="#ffffff"
            >
              EAST BYPASS
            </text>
          </>
        )}

        {/* ── Flow Vector Direction Lines to Center ─────────────────────── */}
        {/* South Corridor Flow */}
        <line
          x1={gridX + gridW / 2}
          y1={gridY + gridH - 12}
          x2={gridX + gridW / 2}
          y2={gridY + 3.2 * cellH}
          stroke={
            effectiveDensities.gate_1 > 4.5
              ? '#dc2626'
              : effectiveDensities.gate_1 > 2.5
                ? '#ea580c'
                : '#16a34a'
          }
          strokeWidth={effectiveDensities.gate_1 > 4.5 ? 3.5 : 2.5}
          strokeDasharray="5 3"
          markerEnd={
            effectiveDensities.gate_1 > 4.5 ? 'url(#arr-crit)' : 'url(#arr-safe)'
          }
        />
        {/* North Corridor Flow */}
        <line
          x1={gridX + gridW / 2}
          y1={gridY + 12}
          x2={gridX + gridW / 2}
          y2={gridY + 1.8 * cellH}
          stroke="#16a34a"
          strokeWidth={2}
          strokeDasharray="5 3"
          markerEnd="url(#arr-safe)"
        />
        {/* West Corridor Flow */}
        <line
          x1={gridX + 12}
          y1={gridY + gridH / 2}
          x2={gridX + 2.3 * cellW}
          y2={gridY + gridH / 2}
          stroke="#16a34a"
          strokeWidth={2}
          strokeDasharray="5 3"
          markerEnd="url(#arr-safe)"
        />
        {/* East Corridor Flow */}
        <line
          x1={gridX + gridW - 12}
          y1={gridY + gridH / 2}
          x2={gridX + 4.7 * cellW}
          y2={gridY + gridH / 2}
          stroke="#16a34a"
          strokeWidth={2}
          strokeDasharray="5 3"
          markerEnd="url(#arr-safe)"
        />

        {/* ── Central Concourse Hub Node ────────────────────────────────── */}
        <g>
          <circle
            cx={gridX + 3.5 * cellW}
            cy={gridY + 2.5 * cellH}
            r={34}
            fill="#FFFFFF"
            stroke={centerRisk.border}
            strokeWidth={2.5}
          />
          <circle
            cx={gridX + 3.5 * cellW}
            cy={gridY + 2.5 * cellH}
            r={28}
            fill={centerRisk.bg}
          />
          <text
            x={gridX + 3.5 * cellW}
            y={gridY + 2.5 * cellH - 7}
            textAnchor="middle"
            fontSize="9"
            fontFamily="'Montserrat', sans-serif"
            fontWeight="800"
            fill="#11130F"
          >
            CENTRAL
          </text>
          <text
            x={gridX + 3.5 * cellW}
            y={gridY + 2.5 * cellH + 4}
            textAnchor="middle"
            fontSize="8"
            fontFamily="'Montserrat', sans-serif"
            fontWeight="700"
            fill="#44492B"
          >
            SANCTUM
          </text>
          <text
            x={gridX + 3.5 * cellW}
            y={gridY + 2.5 * cellH + 16}
            textAnchor="middle"
            fontSize="9"
            fontFamily="'Montserrat', sans-serif"
            fontWeight="800"
            fill={centerRisk.text}
          >
            {centerDensity.toFixed(1)} p/m²
          </text>
        </g>

        {/* ── Structured Gate Node Badges (Never Clipped) ───────────────── */}
        {gateBadges.map((g) => {
          const risk = getRiskInfo(g.density)
          const isRerouted =
            mode === 'ai' && g.id !== 'gate_1' && effectiveDensities.gate_1 > 3

          return (
            <g key={g.id}>
              {/* Connector Pin Line from Badge to Venue Wall */}
              <line
                x1={g.cardX + 68}
                y1={g.align === 'top' ? g.cardY + 36 : g.cardY}
                x2={g.attachX}
                y2={g.attachY}
                stroke={risk.border}
                strokeWidth={1.5}
                strokeDasharray="3 3"
              />

              {/* Gate Badge Card */}
              <rect
                x={g.cardX}
                y={g.cardY}
                width={136}
                height={38}
                rx={10}
                fill="#FFFFFF"
                stroke={risk.border}
                strokeWidth={1.5}
                filter="drop-shadow(0px 2px 4px rgba(0,0,0,0.06))"
              />

              {/* Status Indicator Dot */}
              <circle
                cx={g.cardX + 14}
                cy={g.cardY + 14}
                r={4}
                fill={risk.text}
              />

              {/* Gate Name */}
              <text
                x={g.cardX + 24}
                y={g.cardY + 17}
                fontSize="10"
                fontFamily="'Montserrat', sans-serif"
                fontWeight="800"
                fill="#11130F"
              >
                {g.name}
              </text>

              {/* Live Density & Status Tag */}
              <text
                x={g.cardX + 24}
                y={g.cardY + 30}
                fontSize="9"
                fontFamily="'Montserrat', sans-serif"
                fontWeight="700"
                fill={risk.text}
              >
                {g.density.toFixed(1)} p/m²
              </text>

              {/* Status Pill on Right */}
              <rect
                x={g.cardX + 78}
                y={g.cardY + 8}
                width={50}
                height={20}
                rx={6}
                fill={risk.bg}
                stroke={risk.border}
                strokeWidth={1}
              />
              <text
                x={g.cardX + 103}
                y={g.cardY + 21}
                textAnchor="middle"
                fontSize="8"
                fontFamily="'Montserrat', sans-serif"
                fontWeight="800"
                fill={risk.text}
              >
                {isRerouted ? 'BYPASS' : risk.label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ── Gate Performance Bar Chart ─────────────────────────────────────────────
function GatePerformanceChart({
  densities,
  mode,
}: {
  densities: Record<string, number>
  mode: 'baseline' | 'ai'
}) {
  const gates = [
    { id: 'gate_1', label: 'South Gate', capacity: 6.0 },
    { id: 'gate_2', label: 'West Gate', capacity: 5.0 },
    { id: 'gate_3', label: 'North Gate', capacity: 5.0 },
    { id: 'gate_4', label: 'East Gate', capacity: 5.0 },
  ]

  return (
    <div className="space-y-3">
      {gates.map((gate) => {
        const raw = densities[gate.id] ?? 1.0
        const pct = Math.min(100, (raw / gate.capacity) * 100)
        const throughput = Math.round(raw * 38 + 12)
        const isOverloaded = raw >= 3.0
        const isCritical = raw >= 5.0
        const isRerouted =
          mode === 'ai' && gate.id !== 'gate_1' && (densities.gate_1 ?? 0) > 3.0

        const risk = getRiskInfo(raw)

        const status = isCritical && mode === 'baseline'
          ? 'CRITICAL'
          : isOverloaded && mode === 'baseline'
          ? 'CONGESTED'
          : isRerouted
          ? 'BYPASS'
          : 'OPEN'

        return (
          <div key={gate.id} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="text-xs font-bold text-foreground"
                  style={{ fontFamily: "'Montserrat', sans-serif" }}
                >
                  {gate.label}
                </span>
                <span
                  className="text-[10px] font-extrabold px-2 py-0.5 rounded-md border"
                  style={{
                    backgroundColor: risk.bg,
                    borderColor: risk.border,
                    color: risk.text,
                    fontFamily: "'Montserrat', sans-serif",
                  }}
                >
                  {status}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {mode === 'ai' && gate.id === 'gate_1' && (
                  <span className="text-[10px] font-bold text-success flex items-center gap-0.5">
                    <TrendingDown className="w-3 h-3" />
                    -48%
                  </span>
                )}
                <span
                  className="text-xs font-extrabold"
                  style={{
                    color: risk.text,
                    fontFamily: "'Montserrat', sans-serif",
                  }}
                >
                  {pct.toFixed(0)}% cap
                </span>
              </div>
            </div>
            <div className="relative h-6 bg-secondary/80 rounded-full overflow-hidden border border-border">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${pct}%`,
                  backgroundColor: risk.stroke,
                }}
              />
              <div className="absolute inset-0 flex items-center justify-between px-3">
                <span
                  className="text-[10px] font-bold"
                  style={{
                    color: pct > 35 ? '#ffffff' : '#11130F',
                    fontFamily: "'Montserrat', sans-serif",
                  }}
                >
                  {raw.toFixed(1)} p/m²
                </span>
                <span
                  className="text-[10px] font-medium"
                  style={{
                    color: pct > 65 ? '#ffffff' : '#424735',
                    fontFamily: "'Google Sans', sans-serif",
                  }}
                >
                  {throughput} ppl/min
                </span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── AI Decision Log ────────────────────────────────────────────────────────
function AiDecisionLog({ isPlaying }: { isPlaying: boolean }) {
  const [visibleCount, setVisibleCount] = useState(1)
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isPlaying) return
    if (visibleCount >= AI_DECISION_LOG.length) return
    const timer = setTimeout(() => {
      setVisibleCount((c) => Math.min(c + 1, AI_DECISION_LOG.length))
    }, 2400)
    return () => clearTimeout(timer)
  }, [isPlaying, visibleCount])

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [visibleCount])

  const iconMap: Record<string, React.ReactNode> = {
    action: <ArrowRight className="w-3 h-3 text-primary" />,
    deploy: <Shield className="w-3 h-3 text-warning" />,
    broadcast: <Radio className="w-3 h-3 text-chart-1" />,
    staff: <Users className="w-3 h-3 text-chart-4" />,
    result: <CheckCircle2 className="w-3 h-3 text-success" />,
  }

  const bgMap: Record<string, string> = {
    action: 'border-l-primary bg-primary/5',
    deploy: 'border-l-warning bg-warning/5',
    broadcast: 'border-l-chart-1 bg-chart-1/5',
    staff: 'border-l-chart-4 bg-chart-4/5',
    result: 'border-l-success bg-success/5',
  }

  return (
    <div ref={logRef} className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
      {AI_DECISION_LOG.slice(0, visibleCount).map((entry, i) => (
        <div
          key={i}
          className={cn(
            'flex items-start gap-2 p-2.5 rounded-lg border border-transparent border-l-2 animate-in fade-in slide-in-from-bottom-2 duration-300',
            bgMap[entry.type]
          )}
        >
          <div className="mt-0.5 shrink-0">{iconMap[entry.type]}</div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span
                className="text-[10px] font-bold text-muted-foreground"
                style={{ fontFamily: "'Montserrat', sans-serif" }}
              >
                [{entry.time}]
              </span>
              <span
                className="text-[10px] font-bold uppercase text-primary/70"
                style={{ fontFamily: "'Montserrat', sans-serif" }}
              >
                {entry.type.toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-foreground leading-relaxed">{entry.text}</p>
          </div>
        </div>
      ))}
      {visibleCount < AI_DECISION_LOG.length && isPlaying && (
        <div className="flex items-center gap-2 px-2 py-1.5 opacity-50">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-[10px] text-muted-foreground">Processing...</span>
        </div>
      )}
    </div>
  )
}

// ── Scenario Timeline ──────────────────────────────────────────────────────
function ScenarioTimeline({
  activeStage,
  onStageChange,
  mode,
}: {
  activeStage: number
  onStageChange: (i: number) => void
  mode: 'baseline' | 'ai'
}) {
  return (
    <div className="relative">
      {/* Horizontal progress line */}
      <div className="absolute top-5 left-8 right-8 h-0.5 bg-border z-0">
        <div
          className="h-full bg-primary transition-all duration-700"
          style={{ width: `${(activeStage / (SCENARIO_STAGES.length - 1)) * 100}%` }}
        />
      </div>
      <div className="relative flex justify-between items-start z-10">
        {SCENARIO_STAGES.map((stage, i) => {
          const isActive = i === activeStage
          const isPast = i < activeStage
          const riskColors: Record<RiskLevel, string> = {
            low: 'bg-success border-success text-success',
            medium: 'bg-warning border-warning text-warning',
            high: 'bg-orange-500 border-orange-500 text-orange-500',
            critical: 'bg-destructive border-destructive text-destructive-foreground',
          }
          const dotColor = isActive
            ? riskColors[stage.riskLevel]
            : isPast
            ? 'bg-primary border-primary text-primary'
            : 'bg-secondary border-border text-muted-foreground'

          return (
            <button
              key={stage.id}
              onClick={() => onStageChange(i)}
              className="flex flex-col items-center gap-1.5 w-1/5 cursor-pointer group"
            >
              <div
                className={cn(
                  'w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all shadow-sm',
                  dotColor,
                  isActive && 'scale-110 shadow-md ring-2 ring-primary/30'
                )}
              >
                {stage.icon === 'check' && <CheckCircle2 className="w-4 h-4" />}
                {stage.icon === 'alert' && <AlertTriangle className="w-4 h-4" />}
                {stage.icon === 'critical' && <AlertTriangle className="w-4 h-4" />}
                {stage.icon === 'shield' && <Shield className="w-4 h-4" />}
                {stage.icon === 'play' && <Play className="w-4 h-4" />}
              </div>
              <div className="text-center">
                <p
                  className={cn(
                    'text-[10px] font-bold',
                    isActive ? 'text-foreground' : 'text-muted-foreground'
                  )}
                  style={{ fontFamily: "'Montserrat', sans-serif" }}
                >
                  {stage.time}
                </p>
                <p
                  className={cn(
                    'text-[9px] leading-tight max-w-[80px] text-center',
                    isActive ? 'text-foreground font-semibold' : 'text-muted-foreground'
                  )}
                >
                  {stage.label}
                </p>
                {isActive && stage.aiAction && mode === 'ai' && (
                  <p className="text-[8px] text-success font-bold mt-0.5 leading-tight max-w-[80px]">
                    {stage.aiAction}
                  </p>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Main Digital Twin Section ──────────────────────────────────────────────
export function DigitalTwinSection() {
  const { events } = useCrowdShield()

  const [mode, setMode] = useState<'baseline' | 'ai'>('ai')
  const [viewMode, setViewMode] = useState<'3d' | '2d'>('3d')
  const [activeStage, setActiveStage] = useState(2)
  const [isPlaying, setIsPlaying] = useState(true)

  // Auto-advance timeline when playing
  useEffect(() => {
    if (!isPlaying) return
    const interval = setInterval(() => {
      setActiveStage((s) => {
        if (s >= SCENARIO_STAGES.length - 1) {
          setIsPlaying(false)
          return s
        }
        return s + 1
      })
    }, 4000)
    return () => clearInterval(interval)
  }, [isPlaying])

  const currentStage = SCENARIO_STAGES[activeStage]

  // Merge live event data with stage densities
  const liveDensities = useMemo(() => {
    const base: Record<string, number> = { ...currentStage.densities }
    events.forEach((ev, zoneId) => {
      if (base[zoneId] !== undefined) {
        // Blend live data with stage data (70% stage, 30% live for consistency)
        base[zoneId] = base[zoneId] * 0.7 + ev.density_per_sqm * 0.3
      }
    })
    return base
  }, [events, currentStage])

  // Key metrics comparison
  const metrics = useMemo(() => {
    const stage = currentStage
    const baselineMax = Math.max(...Object.values(stage.densities))
    const aiMax = mode === 'ai' ? baselineMax * 0.55 + 1.2 : baselineMax
    const flowEff = mode === 'ai' ? 94 : 38
    const crushRisk = mode === 'ai'
      ? (stage.riskLevel === 'high' ? 12 : stage.riskLevel === 'medium' ? 8 : 4)
      : (stage.riskLevel === 'high' ? 87 : stage.riskLevel === 'medium' ? 52 : 14)
    return { baselineMax, aiMax, flowEff, crushRisk }
  }, [currentStage, mode])

  const modeLabel = mode === 'ai' ? 'CrowdShield AI Active' : 'Baseline (No AI)'
  const modeBadgeClass = mode === 'ai'
    ? 'bg-success/10 text-success border-success/30'
    : 'bg-destructive/10 text-destructive-foreground border-destructive/30'

  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-300 select-none">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl px-5 py-4 flex flex-wrap items-center justify-between gap-4 border border-border">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 border border-border">
            <Cpu className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2
              className="text-sm font-bold text-foreground flex items-center gap-2"
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              Digital Twin — Operator Decision Theatre
              <span
                className={cn('text-[10px] px-2 py-0.5 rounded-full font-bold border', modeBadgeClass)}
                style={{ fontFamily: "'Montserrat', sans-serif" }}
              >
                {modeLabel}
              </span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Agent-based crowd simulation · Data-driven by live risk events · Click timeline stages to explore scenarios
            </p>
          </div>
        </div>

        {/* View Mode & AI Mode Toggles */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Primary View Switcher */}
          <div className="flex items-center p-1 bg-secondary rounded-xl border border-border shrink-0">
            <button
              onClick={() => setViewMode('3d')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer',
                viewMode === '3d'
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              <Box className="w-3.5 h-3.5" />
              3D Simulation
            </button>
            <button
              onClick={() => setViewMode('2d')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer',
                viewMode === '2d'
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              2D Decision Theatre
            </button>
          </div>

          {/* AI / Baseline Mode Toggle */}
          <div className="flex items-center p-1 bg-secondary rounded-xl border border-border shrink-0">
            <button
              onClick={() => setMode('baseline')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer',
                mode === 'baseline'
                  ? 'bg-destructive text-destructive-foreground shadow-md'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Without AI
            </button>
            <button
              onClick={() => setMode('ai')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer',
                mode === 'ai'
                  ? 'bg-success text-white shadow-md'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              <Shield className="w-3.5 h-3.5" />
              AI Active
            </button>
          </div>
        </div>
      </div>

      {/* ── Scenario Context Banner ──────────────────────────────────────── */}
      <div
        className={cn(
          'glass-panel rounded-xl px-4 py-3 border flex flex-wrap items-center justify-between gap-4',
          currentStage.riskLevel === 'critical' || currentStage.riskLevel === 'high'
            ? mode === 'ai' ? 'border-success/40 bg-success/5' : 'border-destructive/40 bg-destructive/5'
            : 'border-border'
        )}
      >
        <div className="flex items-center gap-3">
          {(currentStage.riskLevel === 'high' || currentStage.riskLevel === 'critical') && mode === 'baseline' ? (
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0 animate-pulse" />
          ) : currentStage.riskLevel === 'high' && mode === 'ai' ? (
            <Shield className="w-4 h-4 text-success shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
          )}
          <div>
            <p className="text-xs font-bold text-foreground" style={{ fontFamily: "'Montserrat', sans-serif" }}>
              {currentStage.label} · {currentStage.time}
            </p>
            <p className="text-xs text-muted-foreground">
              {mode === 'ai' && currentStage.aiAction
                ? `✓ ${currentStage.aiAction}`
                : currentStage.description}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {/* Key metrics chips */}
          <div className="text-center border border-border rounded-lg px-3 py-1.5 bg-card">
            <p className="text-[10px] text-muted-foreground font-medium" style={{ fontFamily: "'Montserrat', sans-serif" }}>Max Density</p>
            <p
              className={cn('text-sm font-extrabold', mode === 'ai' ? 'text-success' : metrics.baselineMax > 5 ? 'text-destructive' : 'text-warning')}
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              {mode === 'ai' ? metrics.aiMax.toFixed(1) : metrics.baselineMax.toFixed(1)}
              <span className="text-[10px] font-normal text-muted-foreground ml-0.5">p/m²</span>
            </p>
          </div>
          <div className="text-center border border-border rounded-lg px-3 py-1.5 bg-card">
            <p className="text-[10px] text-muted-foreground font-medium" style={{ fontFamily: "'Montserrat', sans-serif" }}>Flow Efficiency</p>
            <p
              className={cn('text-sm font-extrabold', metrics.flowEff > 70 ? 'text-success' : 'text-destructive')}
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              {metrics.flowEff}%
            </p>
          </div>
          <div className="text-center border border-border rounded-lg px-3 py-1.5 bg-card">
            <p className="text-[10px] text-muted-foreground font-medium" style={{ fontFamily: "'Montserrat', sans-serif" }}>Crush Risk</p>
            <p
              className={cn('text-sm font-extrabold', metrics.crushRisk < 20 ? 'text-success' : metrics.crushRisk < 50 ? 'text-warning' : 'text-destructive')}
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              {metrics.crushRisk}%
            </p>
          </div>
        </div>
      </div>

      {/* ── View Mode: 3D Simulation View ───────────────────────────────── */}
      {viewMode === '3d' && (
        <div className="flex flex-col gap-4 animate-in fade-in duration-200">
          <div className="glass-panel border border-border rounded-2xl overflow-hidden" style={{ height: '540px' }}>
            <Suspense
              fallback={
                <div className="w-full h-full flex items-center justify-center bg-secondary/30">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs text-muted-foreground" style={{ fontFamily: "'Montserrat', sans-serif" }}>Loading 3D Simulation Engine…</p>
                  </div>
                </div>
              }
            >
              <CrowdSimulation3D
                events={events}
                mode={mode}
                stageDensities={liveDensities}
                className="w-full h-full"
              />
            </Suspense>
          </div>
        </div>
      )}

      {/* ── View Mode: 2D Decision Theatre View ──────────────────────────── */}
      {viewMode === '2d' && (
        <div className="grid grid-cols-12 gap-4 animate-in fade-in duration-200">

          {/* Panel 1: Venue Heatmap */}
          <div className="col-span-7 glass-panel border border-border rounded-2xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <h3
                  className="text-sm font-bold text-foreground"
                  style={{ fontFamily: "'Montserrat', sans-serif" }}
                >
                  Venue Density Heatmap
                </h3>
                <p className="text-xs text-muted-foreground">
                  Live crowd pressure · Flow arrows show movement corridors
                </p>
              </div>
              {/* Density legend */}
              <div className="flex items-center gap-2 text-[10px]" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ background: 'rgba(56,102,62,0.4)' }} />Safe</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ background: 'rgba(217,119,6,0.5)' }} />Medium</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ background: 'rgba(234,88,12,0.6)' }} />High</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ background: 'rgba(197,48,48,0.7)' }} />Critical</span>
              </div>
            </div>
            <div className="flex-1 min-h-[280px]">
              <VenueHeatmap
                densities={liveDensities}
                mode={mode}
                stageDensities={currentStage.densities}
              />
            </div>
          </div>

          {/* Panel 2: Gate Performance + AI Log */}
          <div className="col-span-5 flex flex-col gap-4">

            {/* Gate Performance */}
            <div className="glass-panel border border-border rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3
                    className="text-sm font-bold text-foreground"
                    style={{ fontFamily: "'Montserrat', sans-serif" }}
                  >
                    Gate Performance
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Throughput capacity utilization per entrance
                  </p>
                </div>
                <BarChart3 className="w-4 h-4 text-primary/60" />
              </div>
              <GatePerformanceChart densities={liveDensities} mode={mode} />
              {mode === 'ai' && (
                <div className="flex items-center gap-2 pt-2 border-t border-border">
                  <TrendingDown className="w-3.5 h-3.5 text-success" />
                  <span className="text-xs text-success font-bold" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                    AI reduced peak load by ~45% vs baseline
                  </span>
                </div>
              )}
              {mode === 'baseline' && currentStage.riskLevel !== 'low' && (
                <div className="flex items-center gap-2 pt-2 border-t border-border">
                  <AlertTriangle className="w-3.5 h-3.5 text-destructive animate-pulse" />
                  <span className="text-xs text-destructive font-bold" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                    South Gate approaching crush threshold
                  </span>
                </div>
              )}
            </div>

            {/* AI Decision Log */}
            <div className="glass-panel border border-border rounded-2xl p-4 flex flex-col gap-3 flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <h3
                    className="text-sm font-bold text-foreground"
                    style={{ fontFamily: "'Montserrat', sans-serif" }}
                  >
                    AI Decision Log
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Intervention actions taken by CrowdShield
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                  <span className="text-[10px] font-bold text-success" style={{ fontFamily: "'Montserrat', sans-serif" }}>LIVE</span>
                </div>
              </div>
              {mode === 'ai' ? (
                <AiDecisionLog isPlaying={isPlaying} />
              ) : (
                <div className="flex flex-col items-center justify-center h-full py-6 gap-2 opacity-50">
                  <AlertTriangle className="w-8 h-8 text-destructive" />
                  <p className="text-xs text-muted-foreground text-center">
                    No AI interventions in Baseline mode.<br />Switch to AI Active to see decisions.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Scenario Timeline (Shared across both 2D and 3D) ───────────────── */}
      <div className="glass-panel border border-border rounded-2xl p-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3
              className="text-sm font-bold text-foreground"
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              Scenario Timeline — Kumbh Mela Venue (Simulated)
            </h3>
            <p className="text-xs text-muted-foreground">
              Click any stage to scrub simulation state · CrowdShield divergence point: T+14m
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setActiveStage(0)
                setIsPlaying(true)
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary border border-border text-xs font-bold text-foreground hover:bg-primary hover:text-primary-foreground transition-all cursor-pointer"
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              <Play className="w-3 h-3" />
              Replay
            </button>
            <button
              onClick={() => setIsPlaying((p) => !p)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary border border-border text-xs font-bold text-foreground hover:bg-primary hover:text-primary-foreground transition-all cursor-pointer"
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              {isPlaying ? 'Pause' : 'Resume'}
            </button>
            {/* Mode outcome summary */}
            <div
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold',
                mode === 'ai'
                  ? 'border-success/30 bg-success/10 text-success'
                  : 'border-destructive/30 bg-destructive/10 text-destructive-foreground'
              )}
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              {mode === 'ai' ? (
                <><CheckCircle2 className="w-3.5 h-3.5" /> Crush prevented · 0 injuries</>
              ) : (
                <><AlertTriangle className="w-3.5 h-3.5" /> 12–23 est. injuries</>
              )}
            </div>
          </div>
        </div>

        <ScenarioTimeline
          activeStage={activeStage}
          onStageChange={(i) => {
            setActiveStage(i)
            setIsPlaying(false)
          }}
          mode={mode}
        />

        {/* Divergence callout */}
        <div className="flex items-center gap-3 pt-2 border-t border-border">
          <GitBranch className="w-4 h-4 text-primary shrink-0" />
          <p className="text-xs text-muted-foreground">
            <span className="font-bold text-foreground" style={{ fontFamily: "'Montserrat', sans-serif" }}>Divergence at T+14m: </span>
            Without CrowdShield, South Gate reaches 5.9 p/m² (crush threshold: 5.5) — estimated 12–23 injuries.
            With AI active, rerouting begins at T+16m, density drops to 2.2 p/m² by T+22m. &nbsp;
            <span className="font-bold text-success">Crush averted.</span>
          </p>
        </div>
      </div>

    </div>
  )
}

