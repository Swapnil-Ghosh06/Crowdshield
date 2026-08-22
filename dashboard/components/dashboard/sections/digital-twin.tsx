'use client'

import React, { useMemo } from 'react'
import { ArrowRightLeft, Cpu, DoorClosed, UserCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCrowdShield } from '@/lib/crowdshield/context'
import { ZONES } from '@/lib/crowdshield/zones'
import { getRiskColor, RISK_BADGE_CLASSES } from '@/lib/crowdshield/theme'
import type { RiskLevel } from '@/lib/crowdshield/types'

const positions: Record<string, [number, number]> = {
  gate_1: [340, 440],
  gate_2: [340, 120],
  gate_3: [530, 280],
  gate_4: [150, 280],
  gate_5: [340, 280],
}

const paths: [string, string][] = [
  ['gate_1', 'gate_5'],
  ['gate_2', 'gate_5'],
  ['gate_4', 'gate_5'],
  ['gate_3', 'gate_5'],
]

const actions: { icon: React.ElementType; label: string; action: string }[] = [
  { icon: DoorClosed, label: 'Close', action: 'close' },
  { icon: UserCheck, label: 'Staff', action: 'staff' },
  { icon: ArrowRightLeft, label: 'Reroute', action: 'reroute' },
]

export function DigitalTwinSection() {
  const { events, addIntervention } = useCrowdShield()
  const data = useMemo(
    () => ZONES.map((zone) => ({ ...zone, event: events.get(zone.id) })),
    [events]
  )
  const avg =
    data.reduce((sum, zone) => sum + (zone.event?.risk_score ?? 0), 0) / (data.length || 1)

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3">
        <Cpu className="w-5 h-5 text-accent" />
        <div>
          <h3 className="text-base font-semibold text-foreground">Venue Digital Twin</h3>
          <p className="text-sm text-muted-foreground">
            AI-simulated crowd flow · live risk overlay · intervention scenarios
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Floor Plan Visualizer */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-1">Venue Floor Plan</h3>
          <p className="text-xs text-muted-foreground mb-4">
            Crowd density · flow direction · risk zones
          </p>
          <svg viewBox="0 0 680 560" className="w-full h-auto rounded-xl bg-secondary/30">
            <rect
              x="60"
              y="60"
              width="560"
              height="440"
              rx="16"
              fill="none"
              stroke="currentColor"
              opacity=".35"
              strokeDasharray="8 4"
            />
            {paths.map(([from, to]) => {
              const a = positions[from] || [340, 280]
              const b = positions[to] || [340, 280]
              const score =
                ((events.get(from)?.risk_score ?? 0) + (events.get(to)?.risk_score ?? 0)) / 2
              return (
                <line
                  key={`${from}-${to}`}
                  x1={a[0]}
                  y1={a[1]}
                  x2={b[0]}
                  y2={b[1]}
                  stroke={getRiskColor(score > 0.7 ? 'critical' : score > 0.5 ? 'high' : 'low')}
                  strokeWidth={2 + score * 3}
                  strokeOpacity=".7"
                  strokeDasharray="8 4"
                >
                  <animate
                    attributeName="stroke-dashoffset"
                    from="24"
                    to="0"
                    dur="1.8s"
                    repeatCount="indefinite"
                  />
                </line>
              )
            })}
            {data.map((zone) => {
              const [cx, cy] = positions[zone.id] || [340, 280]
              const event = zone.event
              const level = (event?.risk_level ?? 'low') as RiskLevel
              const color = getRiskColor(level)
              const radius = 36 + (event?.risk_score ?? 0) * 18
              return (
                <g key={zone.id}>
                  <circle
                    cx={cx}
                    cy={cy}
                    r={radius}
                    fill={color}
                    opacity=".35"
                    stroke={color}
                    strokeWidth={level === 'critical' ? 3 : 1.5}
                  />
                  <text
                    x={cx}
                    y={cy - 3}
                    textAnchor="middle"
                    fill="white"
                    fontSize="13"
                    fontWeight="800"
                  >
                    {event ? `${event.density_per_sqm}/m²` : '—'}
                  </text>
                  <text
                    x={cx}
                    y={cy + radius + 20}
                    textAnchor="middle"
                    fill="currentColor"
                    fontSize="11"
                  >
                    {zone.name}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>

        {/* Sidebar Scenarios & Risks */}
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Scenario Analysis</h3>
            {[
              { label: 'Conservative', description: 'If no action taken', color: '#ef4444', score: avg * 1.35 },
              { label: 'Base Case', description: 'With current interventions', color: '#eab308', score: avg * 1.12 },
              { label: 'Optimal', description: 'All interventions confirmed', color: '#22c55e', score: avg * 0.72 },
            ].map(({ label, description, color, score }) => (
              <div key={label} className="mb-4 last:mb-0">
                <div className="flex justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground">{description}</p>
                  </div>
                  <span className="text-sm font-bold" style={{ color }}>
                    {score.toFixed(2)}
                  </span>
                </div>
                <div className="h-2 bg-secondary rounded-full mt-2">
                  <div
                    className="h-full rounded-full"
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
            <h3 className="text-sm font-semibold text-foreground mb-4">Active Risk Factors</h3>
            {data
              .filter(
                (zone) =>
                  zone.event && (zone.event.risk_level === 'high' || zone.event.risk_level === 'critical')
              )
              .map((zone) => {
                const event = zone.event!
                const level = event.risk_level as RiskLevel
                return (
                  <div
                    key={zone.id}
                    className="p-3 rounded-lg border border-border bg-secondary/30 mb-3 last:mb-0"
                  >
                    <p className="text-xs font-semibold text-foreground">
                      {level === 'critical' ? 'Stampede Risk' : 'Congestion Risk'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {zone.name} · {event.density_per_sqm}/m²
                    </p>
                    <div className="flex gap-2 mt-2">
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
                          className="flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-secondary border border-border hover:bg-accent hover:text-accent-foreground transition-colors"
                        >
                          <Icon className="w-3 h-3" />
                          {label}
                        </button>
                      ))}
                    </div>
                    <span
                      className={cn(
                        'inline-flex mt-2 px-2 py-0.5 rounded text-[10px] uppercase font-bold',
                        RISK_BADGE_CLASSES[level]
                      )}
                    >
                      {level}
                    </span>
                  </div>
                )
              })}
          </div>
        </div>
      </div>
    </div>
  )
}
