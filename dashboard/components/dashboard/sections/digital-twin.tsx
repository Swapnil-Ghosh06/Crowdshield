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

// Crowd density heatmap grid cells for the floorplan SVG
// grid cells: 7 columns × 5 rows covering the venue floor
function getDensityForCell(
  col: number, row: number,
  densities: Record<string, number>,
  mode: 'baseline' | 'ai'
): number {
  // Map grid position to approximate zone density influence
  const cx = col / 6  // 0–1
  const ry = row / 4  // 0–1

  // Gate positions in normalized grid space
  const gateDist = {
    gate_1: Math.hypot(cx - 0.5, ry - 1.0),   // South (bottom center)
    gate_2: Math.hypot(cx - 0.0, ry - 0.5),   // West (left middle)
    gate_3: Math.hypot(cx - 0.5, ry - 0.0),   // North (top center)
    gate_4: Math.hypot(cx - 1.0, ry - 0.5),   // East (right middle)
    center: Math.hypot(cx - 0.5, ry - 0.5),   // Center hub
  }

  let totalInfluence = 0
  let totalWeight = 0
  for (const [key, dist] of Object.entries(gateDist)) {
    const weight = Math.max(0, 1 - dist * 2.0)
    totalInfluence += (densities[key] ?? 1) * weight
    totalWeight += weight
  }
  const base = totalWeight > 0 ? totalInfluence / totalWeight : 1

  // In AI mode, flatten the distribution (less variance, more uniform)
  if (mode === 'ai') {
    return Math.min(6, Math.max(0.3, base * 0.6 + 1.2))
  }
  return Math.min(8, Math.max(0.2, base))
}

function densityToColor(d: number): string {
  if (d < 1.5) return 'rgba(56, 102, 62, 0.25)'   // success green — safe
  if (d < 3.0) return 'rgba(217, 119, 6, 0.30)'   // warning amber
  if (d < 5.0) return 'rgba(234, 88, 12, 0.45)'   // high orange
  return 'rgba(197, 48, 48, 0.60)'                  // destructive red — critical
}

function densityToStroke(d: number): string {
  if (d < 1.5) return 'rgba(56, 102, 62, 0.4)'
  if (d < 3.0) return 'rgba(217, 119, 6, 0.5)'
  if (d < 5.0) return 'rgba(234, 88, 12, 0.6)'
  return 'rgba(197, 48, 48, 0.8)'
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
  const activeDensities = mode === 'baseline' ? stageDensities : densities
  const cols = 7
  const rows = 5
  const cellW = 72
  const cellH = 60
  const padX = 54
  const padY = 44
  const totalW = padX * 2 + cols * cellW
  const totalH = padY * 2 + rows * cellH

  // Merge live event densities with stage densities
  const effectiveDensities: Record<string, number> = { ...stageDensities }
  for (const key of Object.keys(activeDensities)) {
    effectiveDensities[key] = activeDensities[key]
  }

  const cells = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const d = getDensityForCell(c, r, effectiveDensities, mode)
      cells.push({ col: c, row: r, density: d })
    }
  }

  // Gate label positions
  const gateNodes = [
    { id: 'gate_1', label: 'South Gate', x: padX + 3 * cellW + cellW / 2, y: padY + rows * cellH + 16, gy: padY + rows * cellH, gx: padX + 3 * cellW + cellW / 2, isBottom: true },
    { id: 'gate_2', label: 'West Gate', x: padX - 16, y: padY + 2 * cellH + cellH / 2, gy: padY + 2 * cellH + cellH / 2, gx: padX, isBottom: false },
    { id: 'gate_3', label: 'North Gate', x: padX + 3 * cellW + cellW / 2, y: padY - 16, gy: padY, gx: padX + 3 * cellW + cellW / 2, isBottom: false },
    { id: 'gate_4', label: 'East Gate', x: padX + cols * cellW + 16, y: padY + 2 * cellH + cellH / 2, gy: padY + 2 * cellH + cellH / 2, gx: padX + cols * cellW, isBottom: false },
  ]

  return (
    <svg
      viewBox={`0 0 ${totalW} ${totalH + 40}`}
      className="w-full h-full rounded-xl"
      style={{ background: '#F4F1EA' }}
    >
      {/* Heatmap Cells */}
      {cells.map(({ col, row, density }) => (
        <rect
          key={`${col}-${row}`}
          x={padX + col * cellW}
          y={padY + row * cellH}
          width={cellW - 2}
          height={cellH - 2}
          rx={4}
          fill={densityToColor(density)}
          stroke={densityToStroke(density)}
          strokeWidth={0.5}
        />
      ))}

      {/* Venue boundary */}
      <rect
        x={padX} y={padY}
        width={cols * cellW} height={rows * cellH}
        rx={8}
        fill="none"
        stroke="#C2AF96"
        strokeWidth={2}
        strokeDasharray="8 5"
      />

      {/* Central Concourse Circle */}
      <circle
        cx={padX + 3.5 * cellW}
        cy={padY + 2.5 * cellH}
        r={40}
        fill="rgba(68,73,43,0.08)"
        stroke="#44492B"
        strokeWidth={1.5}
        strokeDasharray="6 4"
      />
      <text
        x={padX + 3.5 * cellW}
        y={padY + 2.5 * cellH - 4}
        textAnchor="middle"
        fontSize="9"
        fontFamily="'Montserrat', sans-serif"
        fontWeight="700"
        fill="#44492B"
      >CENTRAL</text>
      <text
        x={padX + 3.5 * cellW}
        y={padY + 2.5 * cellH + 8}
        textAnchor="middle"
        fontSize="9"
        fontFamily="'Montserrat', sans-serif"
        fontWeight="700"
        fill="#44492B"
      >CONCOURSE</text>
      <text
        x={padX + 3.5 * cellW}
        y={padY + 2.5 * cellH + 22}
        textAnchor="middle"
        fontSize="9"
        fontFamily="'Google Sans', sans-serif"
        fill="#424735"
      >
        {effectiveDensities.center?.toFixed(1) ?? '1.5'} p/m²
      </text>

      {/* Flow arrows (from gates to center) */}
      {[
        { x1: padX + 3.5 * cellW, y1: padY + rows * cellH - 10, x2: padX + 3.5 * cellW, y2: padY + 3.2 * cellH, key: 'south' },
        { x1: padX + 12, y1: padY + 2.5 * cellH, x2: padX + 2.3 * cellW, y2: padY + 2.5 * cellH, key: 'west' },
        { x1: padX + 3.5 * cellW, y1: padY + 10, x2: padX + 3.5 * cellW, y2: padY + 1.8 * cellH, key: 'north' },
        { x1: padX + cols * cellW - 12, y1: padY + 2.5 * cellH, x2: padX + 4.7 * cellW, y2: padY + 2.5 * cellH, key: 'east' },
      ].map(({ x1, y1, x2, y2, key }) => {
        const gid = key === 'south' ? 'gate_1' : key === 'west' ? 'gate_2' : key === 'north' ? 'gate_3' : 'gate_4'
        const d = effectiveDensities[gid] ?? 1
        const strokeColor = d > 5 ? '#c53030' : d > 3 ? '#d97706' : '#38663e'
        const sw = d > 5 ? 3 : d > 3 ? 2.5 : 2
        return (
          <line
            key={key}
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={strokeColor}
            strokeWidth={sw}
            strokeDasharray="5 4"
            opacity={0.7}
            markerEnd={`url(#arr-${key})`}
          />
        )
      })}

      <defs>
        {['south', 'west', 'north', 'east'].map((k) => {
          const gid = k === 'south' ? 'gate_1' : k === 'west' ? 'gate_2' : k === 'north' ? 'gate_3' : 'gate_4'
          const d = effectiveDensities[gid] ?? 1
          const c = d > 5 ? '#c53030' : d > 3 ? '#d97706' : '#38663e'
          return (
            <marker key={k} id={`arr-${k}`} markerWidth="8" markerHeight="8" refX="5" refY="3" orient="auto">
              <path d="M0,0 L0,6 L6,3 z" fill={c} />
            </marker>
          )
        })}
      </defs>

      {/* Gate Nodes */}
      {gateNodes.map((gate) => {
        const d = effectiveDensities[gate.id] ?? 1
        const col = densityToStroke(d)
        const risk: RiskLevel = d > 5 ? 'critical' : d > 3 ? 'high' : d > 1.5 ? 'medium' : 'low'
        const riskLabel = risk === 'critical' ? 'CRITICAL' : risk === 'high' ? 'HIGH' : risk === 'medium' ? 'MEDIUM' : 'OK'
        const isRerouted = mode === 'ai' && gate.id === 'gate_3' && effectiveDensities.gate_1 > 4
        return (
          <g key={gate.id}>
            {/* Gate circle at boundary */}
            <circle
              cx={gate.gx} cy={gate.gy} r={14}
              fill={`${col.replace('rgba', 'rgb').replace(/,\s*[\d.]+\)/, ')')}`}
              fillOpacity={0.15}
              stroke={col}
              strokeWidth={2}
            />
            {isRerouted && (
              <circle cx={gate.gx} cy={gate.gy} r={18} fill="none" stroke="#38663e" strokeWidth={1.5} strokeDasharray="4 3" opacity={0.6} />
            )}
            <text
              x={gate.gx} y={gate.gy + 4}
              textAnchor="middle"
              fontSize="9"
              fontFamily="'Montserrat', sans-serif"
              fontWeight="800"
              fill={col.replace('rgba', 'rgb').replace(/,\s*[\d.]+\)/, ')')}
            >
              {riskLabel}
            </text>
            {/* Label */}
            <text
              x={gate.x}
              y={gate.isBottom ? padY + rows * cellH + 30 : gate.y}
              textAnchor={gate.id === 'gate_2' ? 'end' : gate.id === 'gate_4' ? 'start' : 'middle'}
              fontSize="10"
              fontFamily="'Montserrat', sans-serif"
              fontWeight="700"
              fill="#11130F"
            >
              {gate.label}
            </text>
            <text
              x={gate.x}
              y={gate.isBottom ? padY + rows * cellH + 44 : gate.y + 14}
              textAnchor={gate.id === 'gate_2' ? 'end' : gate.id === 'gate_4' ? 'start' : 'middle'}
              fontSize="9"
              fontFamily="'Google Sans', sans-serif"
              fill="#424735"
            >
              {d.toFixed(1)} p/m² {isRerouted ? '↑ REROUTED' : ''}
            </text>
          </g>
        )
      })}

      {/* AI Mode overlay: reroute path */}
      {mode === 'ai' && (
        <path
          d={`M ${padX + 3.5 * cellW} ${padY + rows * cellH - 10} Q ${padX + 5 * cellW} ${padY + 3 * cellH} ${padX + 3.5 * cellW} ${padY + 10}`}
          fill="none"
          stroke="#38663e"
          strokeWidth={2}
          strokeDasharray="8 5"
          opacity={0.5}
        />
      )}
      {mode === 'ai' && (
        <text
          x={padX + 5.2 * cellW}
          y={padY + 2.5 * cellH}
          fontSize="8"
          fontFamily="'Montserrat', sans-serif"
          fontWeight="700"
          fill="#38663e"
          transform={`rotate(-60, ${padX + 5.2 * cellW}, ${padY + 2.5 * cellH})`}
        >
          AI REROUTE
        </text>
      )}
    </svg>
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
    { id: 'gate_1', label: 'South Gate', capacity: 8 },
    { id: 'gate_2', label: 'West Gate', capacity: 6 },
    { id: 'gate_3', label: 'North Gate', capacity: 6 },
    { id: 'gate_4', label: 'East Gate', capacity: 6 },
  ]

  return (
    <div className="space-y-3">
      {gates.map((gate) => {
        const raw = densities[gate.id] ?? 1
        const pct = Math.min(100, (raw / gate.capacity) * 100)
        const isOverloaded = pct > 70
        const isCritical = pct > 87
        const throughput = Math.round(raw * 42) // people/min estimate
        const baselinePct = pct
        const aiPct = mode === 'ai' ? Math.min(100, pct * 0.55 + 15) : pct
        const displayPct = mode === 'ai' ? aiPct : baselinePct
        const delta = mode === 'ai' ? Math.round(baselinePct - aiPct) : 0

        const barColor = displayPct > 87
          ? 'bg-destructive'
          : displayPct > 70
          ? 'bg-orange-500'
          : displayPct > 40
          ? 'bg-warning'
          : 'bg-success'

        const status = mode === 'ai' && gate.id === 'gate_3' && densities.gate_1 > 3
          ? 'REROUTED'
          : isCritical && mode === 'baseline'
          ? 'CRITICAL'
          : isOverloaded && mode === 'baseline'
          ? 'CONGESTED'
          : 'OPEN'

        const statusColor = status === 'CRITICAL'
          ? 'text-destructive-foreground bg-destructive/15 border-destructive/30'
          : status === 'CONGESTED'
          ? 'text-orange-700 bg-orange-500/10 border-orange-500/30'
          : status === 'REROUTED'
          ? 'text-success bg-success/10 border-success/30'
          : 'text-success bg-success/10 border-success/20'

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
                <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full border', statusColor)}>
                  {status}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {mode === 'ai' && delta > 0 && (
                  <span className="text-[10px] font-bold text-success flex items-center gap-0.5">
                    <TrendingDown className="w-3 h-3" />
                    -{delta}%
                  </span>
                )}
                <span className="text-xs font-bold text-foreground" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                  {displayPct.toFixed(0)}%
                </span>
              </div>
            </div>
            <div className="relative h-6 bg-secondary rounded-full overflow-hidden border border-border">
              <div
                className={cn('h-full rounded-full transition-all duration-700', barColor)}
                style={{ width: `${displayPct}%` }}
              />
              {mode === 'ai' && delta > 0 && (
                <div
                  className="absolute top-0 h-full bg-destructive/20 rounded-r-full border-l-2 border-destructive/50"
                  style={{ left: `${aiPct}%`, width: `${delta}%` }}
                />
              )}
              <div className="absolute inset-0 flex items-center px-2">
                <span className="text-[10px] font-medium text-foreground/70">
                  {throughput} ppl/min · {raw.toFixed(1)} p/m²
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

