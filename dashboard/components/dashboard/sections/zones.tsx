'use client'

import React, { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { useCrowdShield } from '@/lib/crowdshield/context'
import { ZONES } from '@/lib/crowdshield/zones'
import { RISK_BADGE_CLASSES } from '@/lib/crowdshield/theme'
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
  Shield,
  Activity,
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
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Top summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          ['Total Monitored Gates', ZONES.length, 'Active Cameras'],
          ['Live Sensors Transmitting', events.size, '100% Signal'],
          [
            'Average Risk Score',
            events.size
              ? (
                  Array.from(events.values()).reduce((sum, event) => sum + event.risk_score, 0) /
                  events.size
                ).toFixed(2)
              : '—',
            'Venue Average',
          ],
          ['High / Critical Risk Gates', riskCount, 'Requires Action'],
        ].map(([label, value, sub]) => (
          <div key={String(label)} className="glass-card rounded-2xl p-4 border border-white/10">
            <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">
              {label}
            </p>
            <p className="text-2xl font-bold font-mono text-foreground">{value}</p>
            <p className="text-xs text-cyan-400 font-mono mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-panel rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-white/10">
        <div className="relative w-full sm:w-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            aria-label="Search zones"
            placeholder="Search gate name or ID…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full sm:w-64 h-9 pl-9 pr-4 rounded-xl bg-white/5 border border-white/10 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/40 font-mono"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {(['all', 'critical', 'high', 'medium', 'low'] as Filter[]).map((item) => (
            <button
              key={item}
              onClick={() => setFilter(item)}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all border',
                filter === item
                  ? 'bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 border-cyan-400 shadow-sm'
                  : 'bg-white/5 text-muted-foreground hover:text-foreground border-white/10'
              )}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {/* Zone Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {cards.map(({ zone, event }, index) => {
          const level = (event?.risk_level ?? 'none') as RiskLevel | 'none'
          const score = Math.round((event?.risk_score ?? 0) * 100)
          return (
            <div
              key={zone.id}
              className={cn(
                'glass-card rounded-2xl p-5 border transition-all duration-300 relative overflow-hidden',
                level === 'critical'
                  ? 'glow-border-rose bg-rose-950/20'
                  : level === 'high'
                  ? 'border-amber-500/40 bg-amber-950/15'
                  : level === 'medium'
                  ? 'border-cyan-500/30'
                  : 'border-white/10'
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-bold text-base text-foreground">{zone.name}</h3>
                  <p className="text-xs text-cyan-400 font-mono mt-0.5">ID: {zone.id}</p>
                </div>
                <span
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-xs font-mono font-bold uppercase border',
                    RISK_BADGE_CLASSES[level]
                  )}
                >
                  {level}
                </span>
              </div>

              <div className="mt-5 flex items-end justify-between">
                <div>
                  <p className="text-3xl font-bold font-mono text-foreground">
                    {event ? event.risk_score.toFixed(2) : '—'}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono">Risk Index Score</p>
                </div>
                <div className="w-1/2">
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        level === 'critical'
                          ? 'bg-rose-500'
                          : level === 'high'
                          ? 'bg-amber-500'
                          : level === 'medium'
                          ? 'bg-cyan-400'
                          : 'bg-emerald-400'
                      )}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                  <p className="text-right text-xs font-mono text-cyan-300 font-bold mt-1">{score}%</p>
                </div>
              </div>

              {event && (
                <div className="grid grid-cols-3 gap-3 mt-5 text-xs font-mono">
                  <div className="rounded-xl bg-slate-900/60 border border-white/5 p-2.5">
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase mb-1">
                      <Users className="w-3.5 h-3.5 text-cyan-400" /> Density
                    </div>
                    <span className="font-bold text-foreground">{event.density_per_sqm} p/m²</span>
                  </div>

                  <div className="rounded-xl bg-slate-900/60 border border-white/5 p-2.5">
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase mb-1">
                      <Gauge className="w-3.5 h-3.5 text-emerald-400" /> Velocity
                    </div>
                    <span className="font-bold text-foreground">{event.flow_speed_mps} m/s</span>
                  </div>

                  <div className="rounded-xl bg-slate-900/60 border border-white/5 p-2.5">
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase mb-1">
                      <Clock className="w-3.5 h-3.5 text-amber-400" /> Breach ETA
                    </div>
                    <span className="font-bold text-foreground">
                      {event.eta_minutes != null ? `${event.eta_minutes}m` : 'Nominal'}
                    </span>
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
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-cyan-500/20 text-xs font-semibold text-foreground hover:text-cyan-300 border border-white/10 transition-colors"
                >
                  <Megaphone className="w-3.5 h-3.5 text-cyan-400" />
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
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-emerald-500/20 text-xs font-semibold text-foreground hover:text-emerald-300 border border-white/10 transition-colors"
                >
                  <DoorClosed className="w-3.5 h-3.5 text-emerald-400" />
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
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-amber-500/20 text-xs font-semibold text-foreground hover:text-amber-300 border border-white/10 transition-colors"
                >
                  <UserCheck className="w-3.5 h-3.5 text-amber-400" />
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
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-violet-500/20 text-xs font-semibold text-foreground hover:text-violet-300 border border-white/10 transition-colors"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5 text-violet-400" />
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
