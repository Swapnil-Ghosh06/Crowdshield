'use client'

import React, { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { useCrowdShield } from '@/lib/crowdshield/context'
import { ZONES } from '@/lib/crowdshield/zones'
import { RISK_BADGE_CLASSES, RISK_CARD_CLASSES } from '@/lib/crowdshield/theme'
import type { RiskLevel } from '@/lib/crowdshield/types'
import {
  Search,
  Users,
  Gauge,
  Clock,
  Megaphone,
  DoorClosed,
  UserCheck,
  ArrowRightLeft,
} from 'lucide-react'

type Filter = 'all' | RiskLevel

export function ZonesSection() {
  const { events, addIntervention } = useCrowdShield()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  const cards = useMemo(
    () =>
      ZONES.map((zone) => ({ zone, event: events.get(zone.id) }))
        .filter(
          ({ zone, event }) =>
            (filter === 'all' || event?.risk_level === filter) &&
            `${zone.name} ${zone.id}`.toLowerCase().includes(query.toLowerCase())
        )
        .sort((a, b) => (b.event?.risk_score ?? 0) - (a.event?.risk_score ?? 0)),
    [events, query, filter]
  )

  const riskCount = Array.from(events.values()).filter(
    (event) => event.risk_level === 'high' || event.risk_level === 'critical'
  ).length

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Top summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          ['Total Zones', ZONES.length, 'monitored'],
          ['Active Feed', events.size, 'transmitting'],
          [
            'Avg Risk Score',
            events.size
              ? (
                  Array.from(events.values()).reduce((sum, event) => sum + event.risk_score, 0) /
                  events.size
                ).toFixed(2)
              : '—',
            'across all zones',
          ],
          ['Zones at Risk', riskCount, 'high or critical'],
        ].map(([label, value, sub]) => (
          <div key={String(label)} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">
              {label}
            </p>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            aria-label="Search zones"
            placeholder="Search zones…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-56 h-9 pl-9 pr-4 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {(['all', 'critical', 'high', 'medium', 'low'] as Filter[]).map((item) => (
            <button
              key={item}
              onClick={() => setFilter(item)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-all duration-200',
                filter === item
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              )}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {/* Zone Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {cards.map(({ zone, event }, index) => {
          const level = (event?.risk_level ?? 'none') as RiskLevel | 'none'
          const score = Math.round((event?.risk_score ?? 0) * 100)
          return (
            <div
              key={zone.id}
              className={cn(
                'bg-card border rounded-xl p-5 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4',
                RISK_CARD_CLASSES[level],
                level === 'critical' && 'shadow-[0_0_20px_rgba(239,68,68,0.12)]'
              )}
              style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-foreground">{zone.name}</p>
                  <p className="text-xs text-muted-foreground font-mono mt-1">{zone.id}</p>
                </div>
                <span
                  className={cn(
                    'px-2 py-1 rounded-md text-xs font-bold uppercase',
                    RISK_BADGE_CLASSES[level]
                  )}
                >
                  {level}
                </span>
              </div>

              <div className="mt-5 flex items-end justify-between">
                <div>
                  <p className="text-3xl font-bold text-foreground">
                    {event ? event.risk_score.toFixed(2) : '—'}
                  </p>
                  <p className="text-xs text-muted-foreground">risk score</p>
                </div>
                <div className="w-2/5">
                  <div className="h-2 rounded-full bg-secondary overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        level === 'critical'
                          ? 'bg-destructive'
                          : level === 'high'
                          ? 'bg-orange-500'
                          : level === 'medium'
                          ? 'bg-warning'
                          : 'bg-success'
                      )}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                  <p className="text-right text-xs font-mono text-muted-foreground mt-1">{score}%</p>
                </div>
              </div>

              {event && (
                <div className="grid grid-cols-3 gap-2 mt-5 text-xs">
                  <div className="rounded-lg bg-secondary/60 p-2">
                    <Users className="w-3.5 h-3.5 text-muted-foreground mb-1" />
                    {event.density_per_sqm}/m²
                  </div>
                  <div className="rounded-lg bg-secondary/60 p-2">
                    <Gauge className="w-3.5 h-3.5 text-muted-foreground mb-1" />
                    {event.flow_speed_mps} m/s
                  </div>
                  <div className="rounded-lg bg-secondary/60 p-2">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground mb-1" />
                    ETA {event.eta_minutes != null ? `${event.eta_minutes}m` : '—'}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2 mt-5">
                <button
                  type="button"
                  onClick={() =>
                    addIntervention({
                      zone_id: zone.id,
                      zone_name: zone.name,
                      action: 'broadcast_alert',
                      label: 'Broadcast alert',
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary text-xs text-foreground hover:bg-accent hover:text-accent-foreground"
                >
                  <Megaphone className="w-3.5 h-3.5" />
                  Broadcast
                </button>
                <button
                  type="button"
                  onClick={() =>
                    addIntervention({
                      zone_id: zone.id,
                      zone_name: zone.name,
                      action: 'open_gate',
                      label: 'Open gate',
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary text-xs text-foreground hover:bg-accent hover:text-accent-foreground"
                >
                  <DoorClosed className="w-3.5 h-3.5" />
                  Open gate
                </button>
                <button
                  type="button"
                  onClick={() =>
                    addIntervention({
                      zone_id: zone.id,
                      zone_name: zone.name,
                      action: 'deploy_staff',
                      label: 'Deploy staff',
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary text-xs text-foreground hover:bg-accent hover:text-accent-foreground"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  Deploy staff
                </button>
                <button
                  type="button"
                  onClick={() =>
                    addIntervention({
                      zone_id: zone.id,
                      zone_name: zone.name,
                      action: 'reroute',
                      label: 'Reroute flow',
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary text-xs text-foreground hover:bg-accent hover:text-accent-foreground"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  Reroute
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
