'use client'

import React, { useMemo, useState } from 'react'
import { Box, Cpu, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCrowdShield } from '@/lib/crowdshield/context'
import { ZONES } from '@/lib/crowdshield/zones'
import { getRiskColor } from '@/lib/crowdshield/theme'
import type { RiskLevel } from '@/lib/crowdshield/types'
import { CrowdSimulation3D } from '@/components/dashboard/3d/crowd-simulation-3d'

// 2D map positional data — kept for the 2D Topological Map view
const positions: Record<string, [number, number]> = {
  gate_1: [340, 460],
  gate_2: [150, 280],
  gate_3: [340, 100],
  gate_4: [530, 280],
  center: [340, 280],
}

const paths: [string, string][] = [
  ['gate_1', 'center'],
  ['gate_2', 'center'],
  ['gate_3', 'center'],
  ['gate_4', 'center'],
]

export function DigitalTwinSection() {
  const { events } = useCrowdShield()
  const [viewMode, setViewMode] = useState<'3d' | '2d'>('3d')

  const data = useMemo(
    () => ZONES.map((zone) => ({ ...zone, event: events.get(zone.id) })),
    [events]
  )

  return (
    <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* ── Minimal Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-accent/10 border border-accent/20">
            <Cpu className="w-4 h-4 text-accent" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              Venue Digital Twin
              <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-accent/20 text-accent border border-accent/30">
                WebGL 3D · Physics Sim
              </span>
            </h2>
            <p className="text-[11px] text-muted-foreground">
              Agent-based crowd dynamics · Toggle Baseline vs AI Active to see CrowdShield in action
            </p>
          </div>
        </div>

        {/* 3D / 2D toggle */}
        <div className="flex items-center p-1 bg-secondary/60 rounded-xl border border-border shrink-0">
          <button
            onClick={() => setViewMode('3d')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
              viewMode === '3d'
                ? 'bg-accent text-accent-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Box className="w-3.5 h-3.5" />
            3D Simulation
          </button>
          <button
            onClick={() => setViewMode('2d')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
              viewMode === '2d'
                ? 'bg-accent text-accent-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Layers className="w-3.5 h-3.5" />
            2D Map
          </button>
        </div>
      </div>

      {/* ── Primary Content Area ─────────────────────────────────────────── */}
      {viewMode === '3d' ? (
        /* Nearly full-screen 3D simulation — all overlays live inside CrowdSimulation3D */
        <div className="relative rounded-xl overflow-hidden border border-border h-[calc(100vh-theme(spacing.24))] min-h-[560px]">
          <CrowdSimulation3D className="w-full h-full" />
        </div>
      ) : (
        /* 2D Topological Flow Map — full height, no side panels */
        <div className="bg-card border border-border rounded-xl p-5 h-[calc(100vh-theme(spacing.24))] min-h-[560px] flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Venue Floor Plan &amp; Vector Flow</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Animated vector paths show flow pressure between perimeter gates &amp; concourse
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Safe Flow
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="w-2 h-2 rounded-full bg-destructive animate-ping" /> Critical Surge
              </span>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center">
            <svg
              viewBox="0 0 680 560"
              className="w-full h-auto max-h-full rounded-xl bg-secondary/20 border border-border/40"
            >
              <defs>
                {(['low', 'medium', 'high', 'critical'] as const).map((level) => (
                  <marker
                    key={level}
                    id={`dt-arrow-${level}`}
                    viewBox="0 0 10 10"
                    refX="6"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path
                      d="M 0 1 L 10 5 L 0 9 z"
                      fill={
                        level === 'low'
                          ? '#22c55e'
                          : level === 'medium'
                          ? '#eab308'
                          : level === 'high'
                          ? '#f97316'
                          : '#ef4444'
                      }
                    />
                  </marker>
                ))}
              </defs>

              {/* Venue boundary */}
              <rect
                x="50" y="40" width="580" height="480" rx="20"
                fill="none" stroke="currentColor" opacity=".2" strokeDasharray="8 6"
              />

              {/* Central Concourse ring */}
              <circle
                cx={positions.center[0]} cy={positions.center[1]} r="45"
                fill="currentColor" opacity=".06"
                stroke="currentColor" strokeOpacity=".3" strokeDasharray="4 4"
              />
              <text
                x={positions.center[0]} y={positions.center[1] + 4}
                textAnchor="middle" className="fill-foreground font-semibold text-[11px]"
              >
                Central Concourse
              </text>

              {/* Flow paths */}
              {paths.map(([from, to]) => {
                const [x1, y1] = positions[from]
                const [x2, y2] = positions[to]
                const event = events.get(from)
                const level = (event?.risk_level ?? 'low') as RiskLevel
                return (
                  <line
                    key={`${from}-${to}`}
                    x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke={getRiskColor(level)}
                    strokeWidth={level === 'critical' ? 4 : 2.5}
                    strokeDasharray={level === 'critical' ? '6 4' : '4 4'}
                    opacity={0.8}
                    markerEnd={`url(#dt-arrow-${level})`}
                  />
                )
              })}

              {/* Zone nodes */}
              {data.map((zone) => {
                const [cx, cy] = positions[zone.id] || [340, 280]
                const level = (zone.event?.risk_level ?? 'low') as RiskLevel
                const color = getRiskColor(level)
                return (
                  <g key={zone.id}>
                    <circle cx={cx} cy={cy} r="26" fill={color} fillOpacity="0.2" />
                    <circle cx={cx} cy={cy} r="18" fill={color} fillOpacity="0.8" stroke="#fff" strokeWidth="1.5" />
                    <text
                      x={cx} y={cy + 34}
                      textAnchor="middle" className="fill-foreground text-[10px] font-medium"
                    >
                      {zone.name}
                    </text>
                    <text
                      x={cx} y={cy + 46}
                      textAnchor="middle" className="fill-muted-foreground text-[9px] font-mono"
                    >
                      {zone.event?.density_per_sqm ?? 0} p/m²
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>
        </div>
      )}
    </div>
  )
}
