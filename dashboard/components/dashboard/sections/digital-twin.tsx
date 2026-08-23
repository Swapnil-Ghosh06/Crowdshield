'use client'

import React, { useMemo, useState } from 'react'
import {
  ArrowRightLeft,
  Cpu,
  DoorClosed,
  UserCheck,
  ShieldAlert,
  Navigation,
  Activity,
  Box,
  Layers,
  Sparkles,
  Radio,
  Volume2,
  TrendingUp,
  AlertOctagon,
  ShieldCheck,
  Zap
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCrowdShield } from '@/lib/crowdshield/context'
import { ZONES } from '@/lib/crowdshield/zones'
import { getRiskColor, RISK_BADGE_CLASSES } from '@/lib/crowdshield/theme'
import type { RiskLevel } from '@/lib/crowdshield/types'
import { CrowdSimulation3D } from '@/components/dashboard/3d/crowd-simulation-3d'

const positions: Record<string, [number, number]> = {
  gate_1: [340, 460], // South — bottom center
  gate_2: [150, 280], // West  — left center
  gate_3: [340, 100], // North — top center
  gate_4: [530, 280], // East  — right center
  center: [340, 280], // Center hub (concourse)
}

const paths: [string, string][] = [
  ['gate_1', 'center'],
  ['gate_2', 'center'],
  ['gate_3', 'center'],
  ['gate_4', 'center'],
]

const actions: { icon: React.ElementType; label: string; action: string }[] = [
  { icon: DoorClosed, label: 'Close Gate', action: 'close' },
  { icon: UserCheck, label: 'Deploy Staff', action: 'staff' },
  { icon: ArrowRightLeft, label: 'Reroute Vector', action: 'reroute' },
]

export function DigitalTwinSection() {
  const { events, addIntervention, interventions } = useCrowdShield()
  const [viewMode, setViewMode] = useState<'3d' | '2d'>('3d')

  const data = useMemo(
    () => ZONES.map((zone) => ({ ...zone, event: events.get(zone.id) })),
    [events]
  )
  const avg =
    data.reduce((sum, zone) => sum + (zone.event?.risk_score ?? 0), 0) / (data.length || 1)

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header & Tab Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-accent/10 border border-accent/20">
            <Cpu className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              Venue Digital Twin & Crowd Dynamics
              <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-accent/20 text-accent border border-accent/30">
                TechNova AI Core
              </span>
            </h2>
            <p className="text-xs text-muted-foreground">
              3D humanoid physics simulation · real-time bottleneck stress test · baseline vs AI comparison
            </p>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-2">
          <div className="flex items-center p-1 bg-secondary/60 rounded-xl border border-border">
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
              3D Humanoid Simulation
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
              2D Topological Map
            </button>
          </div>
        </div>
      </div>

      {/* Primary View Area */}
      {viewMode === '3d' ? (
        <CrowdSimulation3D />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 2D Floor Plan Visualizer */}
          <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Venue Floor Plan & Vector Flow</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Animated vector paths show flow pressure between perimeter gates & concourse
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> Safe Flow
                </span>
                <span className="flex items-center gap-1 text-muted-foreground ml-2">
                  <span className="w-2 h-2 rounded-full bg-destructive animate-ping" /> Critical Surge
                </span>
              </div>
            </div>

            <div className="flex-1 flex items-center justify-center">
              <svg viewBox="0 0 680 560" className="w-full h-auto rounded-xl bg-secondary/20 border border-border/40">
                <defs>
                  <marker
                    id="arrow-low"
                    viewBox="0 0 10 10"
                    refX="6"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#22c55e" />
                  </marker>
                  <marker
                    id="arrow-medium"
                    viewBox="0 0 10 10"
                    refX="6"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#eab308" />
                  </marker>
                  <marker
                    id="arrow-high"
                    viewBox="0 0 10 10"
                    refX="6"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#f97316" />
                  </marker>
                  <marker
                    id="arrow-critical"
                    viewBox="0 0 10 10"
                    refX="6"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#ef4444" />
                  </marker>
                </defs>

                {/* Venue Boundary */}
                <rect
                  x="50"
                  y="40"
                  width="580"
                  height="480"
                  rx="20"
                  fill="none"
                  stroke="currentColor"
                  opacity=".2"
                  strokeDasharray="8 6"
                />

                {/* Central Concourse Ring */}
                <circle
                  cx={positions.center[0]}
                  cy={positions.center[1]}
                  r="45"
                  fill="currentColor"
                  opacity=".06"
                  stroke="currentColor"
                  strokeOpacity=".3"
                  strokeDasharray="4 4"
                />
                <text
                  x={positions.center[0]}
                  y={positions.center[1] + 4}
                  textAnchor="middle"
                  className="fill-foreground font-semibold text-[11px]"
                >
                  Central Concourse
                </text>

                {/* Directional Flow Vector Paths */}
                {paths.map(([from, to]) => {
                  const [x1, y1] = positions[from]
                  const [x2, y2] = positions[to]
                  const event = events.get(from)
                  const level = (event?.risk_level ?? 'low') as RiskLevel
                  const strokeColor = getRiskColor(level)
                  const markerId = `arrow-${level}`

                  return (
                    <g key={`${from}-${to}`}>
                      <line
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke={strokeColor}
                        strokeWidth={level === 'critical' ? 4 : 2.5}
                        strokeDasharray={level === 'critical' ? '6 4' : '4 4'}
                        opacity={0.8}
                        markerEnd={`url(#${markerId})`}
                      />
                    </g>
                  )
                })}

                {/* Nodes */}
                {data.map((zone) => {
                  const [cx, cy] = positions[zone.id] || [340, 280]
                  const level = (zone.event?.risk_level ?? 'low') as RiskLevel
                  const color = getRiskColor(level)
                  return (
                    <g key={zone.id}>
                      <circle cx={cx} cy={cy} r="26" fill={color} fillOpacity="0.2" />
                      <circle cx={cx} cy={cy} r="18" fill={color} fillOpacity="0.8" stroke="#fff" strokeWidth="1.5" />
                      <text
                        x={cx}
                        y={cy + 34}
                        textAnchor="middle"
                        className="fill-foreground text-[10px] font-medium"
                      >
                        {zone.name}
                      </text>
                      <text
                        x={cx}
                        y={cy + 46}
                        textAnchor="middle"
                        className="fill-muted-foreground text-[9px] font-mono"
                      >
                        {zone.event?.density_per_sqm ?? 0} p/m²
                      </text>
                    </g>
                  )
                })}
              </svg>
            </div>
          </div>

          {/* Side Interventions & Warnings */}
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground mb-3 flex items-center gap-2">
                <AlertOctagon className="w-3.5 h-3.5 text-destructive" />
                Active Congestion & Bottlenecks
              </h3>
              {data.filter((z) => z.event && (z.event.risk_level === 'high' || z.event.risk_level === 'critical')).length === 0 ? (
                <div className="p-4 rounded-lg bg-secondary/30 text-center text-xs text-muted-foreground">
                  <ShieldCheck className="w-6 h-6 text-emerald-400 mx-auto mb-1.5" />
                  All topological pathways flowing normally
                </div>
              ) : (
                data
                  .filter((z) => z.event && (z.event.risk_level === 'high' || z.event.risk_level === 'critical'))
                  .map((zone) => (
                    <div key={zone.id} className="p-3 rounded-lg border border-border bg-secondary/30 mb-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-foreground">{zone.name}</span>
                        <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-bold uppercase', RISK_BADGE_CLASSES[zone.event!.risk_level as RiskLevel])}>
                          {zone.event!.risk_level}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Density: {zone.event!.density_per_sqm} p/m² · Risk Score: {zone.event!.risk_score}
                      </p>
                      <div className="flex gap-1.5 mt-2">
                        {actions.map(({ icon: Icon, label, action }) => (
                          <button
                            key={label}
                            onClick={() => addIntervention({ zone_id: zone.id, zone_name: zone.name, action, label })}
                            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-secondary border border-border hover:bg-accent hover:text-accent-foreground transition-colors"
                          >
                            <Icon className="w-2.5 h-2.5" />
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TechNova 7 Core Questions Diagnostic Strip */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center gap-2 mb-1.5">
            <TrendingUp className="w-4 h-4 text-amber-400" />
            <h4 className="text-xs font-semibold text-foreground">Abnormal Density Hotspot</h4>
          </div>
          <p className="text-sm font-bold text-foreground">South Gate 1 Corridor</p>
          <p className="text-xs text-muted-foreground mt-0.5">Surge +142% vs 10-min baseline</p>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center gap-2 mb-1.5">
            <AlertOctagon className="w-4 h-4 text-destructive" />
            <h4 className="text-xs font-semibold text-foreground">Predicted Crush Risk (5 min)</h4>
          </div>
          <p className="text-sm font-bold text-destructive">8.4% (Elevated Chokepoint)</p>
          <p className="text-xs text-muted-foreground mt-0.5">Mitigated to 1.2% with AI Pulse Reroute</p>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center gap-2 mb-1.5">
            <Navigation className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs font-semibold text-foreground">Safest Evacuation Route</h4>
          </div>
          <p className="text-sm font-bold text-emerald-400">North-West & East Corridors</p>
          <p className="text-xs text-muted-foreground mt-0.5">Average clearance time: 2.8 mins</p>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center gap-2 mb-1.5">
            <Volume2 className="w-4 h-4 text-accent" />
            <h4 className="text-xs font-semibold text-foreground">Public Broadcast Status</h4>
          </div>
          <p className="text-sm font-bold text-foreground">Active in 4 Languages</p>
          <p className="text-xs text-muted-foreground mt-0.5">Hindi · English · Bengali · Tamil</p>
        </div>
      </div>
    </div>
  )
}
