'use client'

import React, { useMemo } from 'react'
import { ArrowRightLeft, Cpu, DoorClosed, UserCheck, ShieldAlert, Navigation, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCrowdShield } from '@/lib/crowdshield/context'
import { ZONES } from '@/lib/crowdshield/zones'
import { getRiskColor, RISK_BADGE_CLASSES } from '@/lib/crowdshield/theme'
import type { RiskLevel } from '@/lib/crowdshield/types'

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
  { icon: DoorClosed, label: 'Close', action: 'close' },
  { icon: UserCheck, label: 'Staff', action: 'staff' },
  { icon: ArrowRightLeft, label: 'Reroute', action: 'reroute' },
]

export function DigitalTwinSection() {
  const { events, addIntervention, interventions } = useCrowdShield()
  const data = useMemo(
    () => ZONES.map((zone) => ({ ...zone, event: events.get(zone.id) })),
    [events]
  )
  const avg =
    data.reduce((sum, zone) => sum + (zone.event?.risk_score ?? 0), 0) / (data.length || 1)

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Cpu className="w-5 h-5 text-accent" />
          <div>
            <h3 className="text-base font-semibold text-foreground">Venue Digital Twin</h3>
            <p className="text-sm text-muted-foreground">
              Realtime 2D topological model · directional crowd vectoring · intervention overlay
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground bg-secondary/50 px-3 py-1.5 rounded-lg border border-border">
          <Activity className="w-3.5 h-3.5 text-accent animate-pulse" />
          <span>4 Active Gates · 1 Central Concourse</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Floor Plan Visualizer */}
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
                <span className="w-2 h-2 rounded-full bg-success" /> Safe Flow
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
                fill="currentColor"
                fontSize="11"
                fontWeight="700"
                opacity=".75"
              >
                CENTRAL CONCOURSE
              </text>

              {/* Vector Paths with Flow Direction */}
              {paths.map(([from, to]) => {
                const a = positions[from] || [340, 280]
                const b = positions[to] || [340, 280]
                const event = events.get(from)
                const score = event?.risk_score ?? 0
                const level = (event?.risk_level ?? 'low') as RiskLevel
                const color = getRiskColor(level)
                const isCritical = level === 'critical'
                const isHigh = level === 'high'
                const markerId = `arrow-${level}`

                return (
                  <g key={`${from}-${to}`}>
                    <line
                      x1={a[0]}
                      y1={a[1]}
                      x2={b[0]}
                      y2={b[1]}
                      stroke={color}
                      strokeWidth={isCritical ? 5 : isHigh ? 3.5 : 2}
                      strokeOpacity={isCritical ? '.9' : '.65'}
                      strokeDasharray="8 6"
                      markerEnd={`url(#${markerId})`}
                    >
                      <animate
                        attributeName="stroke-dashoffset"
                        from="28"
                        to="0"
                        dur={isCritical ? '0.8s' : isHigh ? '1.2s' : '2.0s'}
                        repeatCount="indefinite"
                      />
                    </line>
                  </g>
                )
              })}

              {/* Venue Zones Nodes */}
              {data.map((zone) => {
                const [cx, cy] = positions[zone.id] || [340, 280]
                const event = zone.event
                const level = (event?.risk_level ?? 'low') as RiskLevel
                const color = getRiskColor(level)
                const radius = 34 + (event?.risk_score ?? 0) * 16
                const isCritical = level === 'critical'

                return (
                  <g key={zone.id} className="cursor-pointer">
                    {/* Pulsing halo for critical zones */}
                    {isCritical && (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={radius + 12}
                        fill="none"
                        stroke={color}
                        strokeWidth="2"
                        opacity=".6"
                      >
                        <animate
                          attributeName="r"
                          from={radius}
                          to={radius + 20}
                          dur="1.4s"
                          repeatCount="indefinite"
                        />
                        <animate
                          attributeName="opacity"
                          from="0.8"
                          to="0"
                          dur="1.4s"
                          repeatCount="indefinite"
                        />
                      </circle>
                    )}

                    <circle
                      cx={cx}
                      cy={cy}
                      r={radius}
                      fill={color}
                      opacity=".3"
                      stroke={color}
                      strokeWidth={isCritical ? 3 : 1.8}
                    />

                    <text
                      x={cx}
                      y={cy - 4}
                      textAnchor="middle"
                      fill="white"
                      fontSize="12"
                      fontWeight="800"
                    >
                      {event ? `${event.density_per_sqm}/m²` : '—'}
                    </text>

                    <text
                      x={cx}
                      y={cy + 12}
                      textAnchor="middle"
                      fill="currentColor"
                      fontSize="9"
                      fontWeight="600"
                      opacity=".85"
                    >
                      {event?.flow_speed_mps ? `${event.flow_speed_mps} m/s` : ''}
                    </text>

                    <text
                      x={cx}
                      y={cy > 280 ? cy + radius + 18 : cy - radius - 10}
                      textAnchor="middle"
                      fill="currentColor"
                      fontSize="11"
                      fontWeight="700"
                    >
                      {zone.name}
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>
        </div>

        {/* Sidebar Scenarios & Risks */}
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Intervention Scenario Modeling</h3>
            {[
              {
                label: 'Conservative',
                description: 'No active crowd mitigation',
                color: '#ef4444',
                score: Math.min(avg * 1.35, 1.0),
              },
              {
                label: 'Base Case',
                description: 'Current real-time interventions',
                color: '#eab308',
                score: Math.min(avg * 1.05, 1.0),
              },
              {
                label: 'Optimal Mitigation',
                description: 'Automated rerouting + gates open',
                color: '#22c55e',
                score: Math.max(avg * 0.55, 0.15),
              },
            ].map(({ label, description, color, score }) => (
              <div key={label} className="mb-4 last:mb-0">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground">{description}</p>
                  </div>
                  <span className="text-sm font-bold font-mono" style={{ color }}>
                    {(score * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="h-2 bg-secondary rounded-full mt-2 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(score * 100, 100)}%`,
                      backgroundColor: color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-warning" />
              Active Risk Hotspots
            </h3>
            {data.filter(
              (zone) =>
                zone.event &&
                (zone.event.risk_level === 'high' || zone.event.risk_level === 'critical')
            ).length === 0 ? (
              <p className="text-xs text-muted-foreground py-3">All 4 venue gates operating within safe thresholds.</p>
            ) : (
              data
                .filter(
                  (zone) =>
                    zone.event &&
                    (zone.event.risk_level === 'high' || zone.event.risk_level === 'critical')
                )
                .map((zone) => {
                  const event = zone.event!
                  const level = event.risk_level as RiskLevel
                  return (
                    <div
                      key={zone.id}
                      className="p-3 rounded-lg border border-border bg-secondary/30 mb-3 last:mb-0"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-foreground">
                          {level === 'critical' ? 'Stampede Risk Breach' : 'Congestion Hotspot'}
                        </p>
                        <span
                          className={cn(
                            'px-1.5 py-0.5 rounded text-[10px] uppercase font-bold',
                            RISK_BADGE_CLASSES[level]
                          )}
                        >
                          {level}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {zone.name} · {event.density_per_sqm}/m² · ETA {event.eta_minutes}m
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-2.5">
                        {actions.map(({ icon: Icon, label, action }) => (
                          <button
                            key={label}
                            type="button"
                            onClick={() =>
                              addIntervention({
                                zone_id: zone.id,
                                zone_name: zone.name,
                                action,
                                label,
                              })
                            }
                            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-secondary border border-border hover:bg-accent hover:text-accent-foreground transition-colors"
                          >
                            <Icon className="w-3 h-3" />
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
