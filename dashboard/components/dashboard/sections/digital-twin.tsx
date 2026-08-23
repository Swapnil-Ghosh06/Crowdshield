'use client'

import React, { useMemo, useState } from 'react'
import { Box, Cpu, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCrowdShield } from '@/lib/crowdshield/context'
import { ZONES } from '@/lib/crowdshield/zones'
import { getRiskColor } from '@/lib/crowdshield/theme'
import type { RiskLevel } from '@/lib/crowdshield/types'
import { CrowdSimulation3D } from '@/components/dashboard/3d/crowd-simulation-3d'

// 2D map positional data for 2D Topological Map view
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
    <div className="flex flex-col gap-3 animate-in fade-in duration-300 select-none">
      {/* ── Header Bar ─────────────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl px-4 py-3 flex items-center justify-between gap-4 border border-border">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-accent/15 border border-border">
            <Cpu className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2
              className="text-sm font-bold text-foreground flex items-center gap-2"
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              Venue Digital Twin Simulation
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-accent/15 text-primary border border-border" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                WebGL 3D Physics Engine
              </span>
            </h2>
            <p className="text-xs text-muted-foreground font-medium">
              Agent-based social force dynamics · Toggle Baseline vs AI Active to test proactive crowd rerouting
            </p>
          </div>
        </div>

        {/* 3D / 2D toggle */}
        <div className="flex items-center p-1 bg-secondary rounded-xl border border-border shrink-0">
          <button
            onClick={() => setViewMode('3d')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer',
              viewMode === '3d'
                ? 'bg-primary text-primary-foreground shadow-md font-extrabold'
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
                ? 'bg-primary text-primary-foreground shadow-md font-extrabold'
                : 'text-muted-foreground hover:text-foreground'
            )}
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            <Layers className="w-3.5 h-3.5" />
            2D Vector Map
          </button>
        </div>
      </div>

      {/* ── Primary Content Area ─────────────────────────────────────────── */}
      {viewMode === '3d' ? (
        <div className="relative rounded-2xl overflow-hidden border border-border h-[calc(100vh-210px)] min-h-[580px] shadow-xl bg-card">
          <CrowdSimulation3D className="w-full h-full" />
        </div>
      ) : (
        <div className="glass-card border border-border rounded-2xl p-5 h-[calc(100vh-210px)] min-h-[580px] flex flex-col shadow-xl">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-border/60">
            <div>
              <h3
                className="text-base font-bold text-foreground"
                style={{ fontFamily: "'Montserrat', sans-serif" }}
              >
                Topological Concourse Vector Flow
              </h3>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">
                Flow pressure lines between perimeter gates & central concourse hub
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold" style={{ fontFamily: "'Montserrat', sans-serif" }}>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="w-2 h-2 rounded-full bg-emerald-400" /> Optimal Flow
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" /> Congestion Choke
              </span>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center">
            <svg
              viewBox="0 0 680 560"
              className="w-full h-auto max-h-full rounded-2xl bg-slate-950/60 border border-white/5 p-4"
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
                x="50" y="40" width="580" height="480" rx="24"
                fill="none" stroke="rgba(0, 240, 255, 0.2)" strokeDasharray="8 6" strokeWidth="1.5"
              />

              {/* Central Concourse Ring */}
              <circle
                cx={positions.center[0]} cy={positions.center[1]} r="52"
                fill="rgba(0, 240, 255, 0.05)"
                stroke="rgba(0, 240, 255, 0.4)" strokeDasharray="4 4" strokeWidth="2"
              />
              <text
                x={positions.center[0]} y={positions.center[1] + 4}
                textAnchor="middle" className="fill-foreground font-mono font-bold text-xs"
              >
                Central Concourse
              </text>

              {/* Flow Paths */}
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
                    strokeWidth={level === 'critical' ? 4.5 : 2.5}
                    strokeDasharray={level === 'critical' ? '6 4' : '5 5'}
                    opacity={0.85}
                    markerEnd={`url(#dt-arrow-${level})`}
                  />
                )
              })}

              {/* Zone Nodes */}
              {data.map((zone) => {
                const [cx, cy] = positions[zone.id] || [340, 280]
                const level = (zone.event?.risk_level ?? 'low') as RiskLevel
                const color = getRiskColor(level)
                return (
                  <g key={zone.id} className="cursor-pointer">
                    <circle cx={cx} cy={cy} r="30" fill={color} fillOpacity="0.15" />
                    <circle cx={cx} cy={cy} r="20" fill={color} fillOpacity="0.85" stroke="#fff" strokeWidth="2" />
                    <text
                      x={cx} y={cy + 36}
                      textAnchor="middle" className="fill-foreground text-xs font-mono font-bold"
                    >
                      {zone.name}
                    </text>
                    <text
                      x={cx} y={cy + 50}
                      textAnchor="middle" className="fill-cyan-400 text-[10px] font-mono"
                    >
                      {(zone.event?.density_per_sqm ?? 0).toFixed(1)} p/m²
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
