'use client'

import React, { useMemo, useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { useCrowdShield } from '@/lib/crowdshield/context'
import { ZONES } from '@/lib/crowdshield/zones'
import { RISK_BADGE_CLASSES, getRiskColor } from '@/lib/crowdshield/theme'
import type { RiskLevel } from '@/lib/crowdshield/types'
import {
  Users,
  Gauge,
  Clock,
  Megaphone,
  DoorClosed,
  UserCheck,
  ArrowRightLeft,
  Shield,
  Activity,
  CheckCircle2,
  Zap,
  AlertTriangle,
  Flame,
  ArrowUpRight,
  TrendingDown,
  Sparkles
} from 'lucide-react'

type Filter = 'all' | RiskLevel
type SortBy = 'risk' | 'density' | 'eta'

// ── AI Recommendation copy per risk level ──────────────────────────────────
const AI_RECOMMENDATIONS: Record<string, { icon: React.ElementType; title: string; rationale: string; className: string }> = {
  critical: {
    icon: AlertTriangle,
    title: 'IMMEDIATE MITIGATION REQUIRED',
    rationale: 'Inflow pressure approaching bottleneck limit. Release Gate 4 as overflow corridor, throttle inbound turnstiles, and broadcast multi-language reroute alerts.',
    className: 'bg-rose-500/10 border-rose-500/30 text-rose-300',
  },
  high: {
    icon: ArrowUpRight,
    title: 'EARLY CONGESTION WARNING',
    rationale: 'Density exceeding 4.5 p/m². Velocity slowing down. Pre-position 2 safety marshals and trigger proactive directional signage.',
    className: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
  },
  medium: {
    icon: Activity,
    title: 'ACTIVE MONITORING',
    rationale: 'Moderate crowd influx detected. Flow speeds nominal. Automatic optical sensors tracking rate of change.',
    className: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300',
  },
  low: {
    icon: CheckCircle2,
    title: 'NORMAL OPTIMAL FLOW',
    rationale: 'Zone operating within safe capacity limits. Crowd density and walking velocity are in ideal equilibrium.',
    className: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
  },
  none: {
    icon: Shield,
    title: 'STANDBY',
    rationale: 'Awaiting sensor synchronization…',
    className: 'bg-white/5 border-white/10 text-muted-foreground',
  },
}

// ── Animated Risk Bar ──────────────────────────────────────────────────────
function RiskBar({ score, level }: { score: number; level: string }) {
  const [width, setWidth] = useState(0)
  const mounted = useRef(false)

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      const raf = requestAnimationFrame(() => setWidth(score))
      return () => cancelAnimationFrame(raf)
    } else {
      setWidth(score)
    }
  }, [score])

  const color = getRiskColor(level as RiskLevel)

  return (
    <div className="w-44 flex flex-col items-end">
      <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${width}%`,
            backgroundColor: color,
            boxShadow: `0 0 12px ${color}80`,
          }}
        />
      </div>
      <div className="flex items-center gap-1.5 mt-1 font-mono text-xs font-bold" style={{ color }}>
        <span>{score}% Threat Level</span>
      </div>
    </div>
  )
}

// ── Action button with dispatched feedback ────────────────────────────────
interface ActionBtnProps {
  zoneId: string
  zoneName: string
  action: string
  label: string
  icon: React.ElementType
  colorClass: string
  iconClass: string
  dispatched: Record<string, string>
  onDispatch: (key: string) => void
  addIntervention: (payload: { zone_id: string; zone_name: string; action: string; label: string }) => void
}

function ActionButton({
  zoneId, zoneName, action, label, icon: Icon,
  colorClass, iconClass, dispatched, onDispatch, addIntervention,
}: ActionBtnProps) {
  const key = `${zoneId}-${action}`
  const isDone = Boolean(dispatched[key])

  return (
    <button
      type="button"
      onClick={() => {
        if (isDone) return
        addIntervention({ zone_id: zoneId, zone_name: zoneName, action, label })
        onDispatch(key)
      }}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono font-semibold border transition-all duration-200 cursor-pointer',
        isDone
          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
          : `bg-white/5 text-foreground border-white/10 ${colorClass}`
      )}
    >
      {isDone ? (
        <>
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>Dispatched</span>
        </>
      ) : (
        <>
          <Icon className={cn('w-3.5 h-3.5', iconClass)} />
          <span>{label}</span>
        </>
      )}
    </button>
  )
}

// ── Main Section ───────────────────────────────────────────────────────────
export function ZonesSection() {
  const { events, addIntervention, triggerSurge, triggerMitigation } = useCrowdShield()
  const [filter, setFilter] = useState<Filter>('all')
  const [sortBy, setSortBy] = useState<SortBy>('risk')
  const [dispatched, setDispatched] = useState<Record<string, string>>({})

  function handleDispatch(key: string) {
    setDispatched((prev) => ({ ...prev, [key]: Date.now().toString() }))
    setTimeout(() => {
      setDispatched((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }, 4000)
  }

  const cards = useMemo(() => {
    const raw = ZONES.map((zone) => ({ zone, event: events.get(zone.id) }))
      .filter(({ event }) => filter === 'all' || event?.risk_level === filter)

    return raw.sort((a, b) => {
      if (sortBy === 'risk') {
        return (b.event?.risk_score ?? 0) - (a.event?.risk_score ?? 0)
      }
      if (sortBy === 'density') {
        return (b.event?.density_per_sqm ?? 0) - (a.event?.density_per_sqm ?? 0)
      }
      if (sortBy === 'eta') {
        const etaA = a.event?.eta_minutes ?? 999
        const etaB = b.event?.eta_minutes ?? 999
        return etaA - etaB
      }
      return 0
    })
  }, [events, filter, sortBy])

  const riskCount = Array.from(events.values()).filter(
    (e) => e.risk_level === 'high' || e.risk_level === 'critical'
  ).length

  const avgDensity =
    Array.from(events.values()).reduce((sum, e) => sum + (e.density_per_sqm ?? 0), 0) /
    (events.size || 1)

  const summaryCards = [
    { label: 'Sectors Monitored', value: ZONES.length, sub: '4/4 Gates Online', subColor: 'text-cyan-400', icon: Shield },
    { label: 'Venue Mean Density', value: `${avgDensity.toFixed(1)} p/m²`, sub: 'Threshold: 5.0 p/m²', subColor: avgDensity > 4 ? 'text-rose-400' : 'text-emerald-400', icon: Users },
    { label: 'Surge Interventions', value: 8, sub: 'All protocols verified', subColor: 'text-cyan-400', icon: Zap },
    { label: 'Zones Requiring Action', value: riskCount, sub: riskCount > 0 ? 'Surge Protocol Triggered' : 'All Zones Safe', subColor: riskCount > 0 ? 'text-rose-400' : 'text-emerald-400', icon: AlertTriangle },
  ]

  return (
    <div className="space-y-5 animate-in fade-in duration-300 select-none pb-10">

      {/* ── Top summary cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {summaryCards.map(({ label, value, sub, subColor, icon: Icon }) => (
          <div key={label} className="glass-card rounded-2xl p-4 border border-white/10 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground font-mono font-semibold uppercase tracking-wider">
                {label}
              </p>
              <Icon className={cn('w-4 h-4', subColor)} />
            </div>
            <div className="mt-2">
              <p className="text-2xl font-bold font-mono text-foreground">{value}</p>
              <p className={cn('text-xs font-mono mt-0.5', subColor)}>{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filter & Sort Bar ──────────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl px-4 py-3 flex items-center justify-between flex-wrap gap-3 border border-white/10">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-mono font-semibold text-muted-foreground">Filter Risk Level:</span>
          <div className="flex flex-wrap items-center gap-1.5 ml-1">
            {(['all', 'critical', 'high', 'medium', 'low'] as Filter[]).map((item) => (
              <button
                key={item}
                onClick={() => setFilter(item)}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-xs font-mono font-bold capitalize transition-all border cursor-pointer',
                  filter === item
                    ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md font-extrabold'
                    : 'bg-white/5 text-muted-foreground hover:text-foreground border-white/10'
                )}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-muted-foreground">Sort By:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            aria-label="Sort sectors by metric"
            className="bg-slate-900 border border-white/10 text-foreground text-xs font-mono rounded-xl px-3 py-1.5 focus:outline-none focus:border-cyan-400 cursor-pointer"
          >
            <option value="risk">Highest Risk</option>
            <option value="density">Highest Density</option>
            <option value="eta">Critical Breach ETA</option>
          </select>
        </div>
      </div>

      {/* ── Zone Cards Grid ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {cards.map(({ zone, event }) => {
          const level = (event?.risk_level ?? 'low') as RiskLevel
          const score = Math.round((event?.risk_score ?? 0.2) * 100)
          const rec = AI_RECOMMENDATIONS[level] ?? AI_RECOMMENDATIONS.low
          const RecIcon = rec.icon
          const color = getRiskColor(level)

          const actionDefs = [
            {
              action: 'broadcast_alert', label: 'PA Broadcast',
              icon: Megaphone, colorClass: 'hover:bg-cyan-500/20 hover:text-cyan-300', iconClass: 'text-cyan-400',
            },
            {
              action: 'open_gate', label: 'Release Gate',
              icon: DoorClosed, colorClass: 'hover:bg-emerald-500/20 hover:text-emerald-300', iconClass: 'text-emerald-400',
            },
            {
              action: 'deploy_staff', label: 'Deploy Marshals',
              icon: UserCheck, colorClass: 'hover:bg-amber-500/20 hover:text-amber-300', iconClass: 'text-amber-400',
            },
            {
              action: 'reroute', label: 'Reroute Vector',
              icon: ArrowRightLeft, colorClass: 'hover:bg-violet-500/20 hover:text-violet-300', iconClass: 'text-violet-400',
            },
          ]

          return (
            <div
              key={zone.id}
              className={cn(
                'glass-card rounded-2xl p-5 border transition-all duration-300 relative overflow-hidden flex flex-col justify-between',
                level === 'critical'
                  ? 'border-rose-500/50 bg-rose-950/20 shadow-xl'
                  : level === 'high'
                  ? 'border-amber-500/40 bg-amber-950/15'
                  : level === 'medium'
                  ? 'border-cyan-500/30'
                  : 'border-white/10'
              )}
            >
              {/* Zone Header */}
              <div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3
                      className="font-bold text-base text-foreground tracking-tight"
                      style={{ fontFamily: "'Ysabeau SC', sans-serif" }}
                    >
                      {zone.name}
                    </h3>
                    <p className="text-xs text-cyan-400 font-mono mt-0.5">{zone.id} · Sector Grid Node</p>
                  </div>
                  <span
                    className={cn(
                      'px-3 py-1 rounded-full text-xs font-mono font-bold uppercase border',
                      RISK_BADGE_CLASSES[level]
                    )}
                  >
                    {level}
                  </span>
                </div>

                {/* Threat index + Animated progress bar */}
                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <p className="text-3xl font-bold font-mono text-foreground">
                      {event ? event.risk_score.toFixed(2) : '0.20'}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono">Real-time Threat Index</p>
                  </div>
                  <RiskBar score={score} level={level} />
                </div>

                {/* Telemetry Metrics Row */}
                {event && (
                  <div className="grid grid-cols-3 gap-2.5 mt-4 text-xs font-mono">
                    <div className="rounded-xl bg-slate-900/70 border border-white/5 p-2.5">
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase mb-1">
                        <Users className="w-3.5 h-3.5 text-cyan-400" /> Density
                      </div>
                      <span className="font-bold text-foreground text-sm">{(event.density_per_sqm ?? 0).toFixed(1)} p/m²</span>
                    </div>
                    <div className="rounded-xl bg-slate-900/70 border border-white/5 p-2.5">
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase mb-1">
                        <Gauge className="w-3.5 h-3.5 text-emerald-400" /> Velocity
                      </div>
                      <span className="font-bold text-foreground text-sm">{(event.flow_speed_mps ?? 1.2).toFixed(2)} m/s</span>
                    </div>
                    <div className="rounded-xl bg-slate-900/70 border border-white/5 p-2.5">
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase mb-1">
                        <Clock className="w-3.5 h-3.5 text-amber-400" /> Breach Window
                      </div>
                      <span className={cn('font-bold text-sm', event.eta_minutes != null ? 'text-rose-400 font-extrabold' : 'text-foreground')}>
                        {event.eta_minutes != null ? `${event.eta_minutes}m ETA` : 'Nominal'}
                      </span>
                    </div>
                  </div>
                )}

                {/* AI Rationale & Action Plan Box */}
                <div className={cn('mt-4 rounded-xl border p-3 flex items-start gap-2.5 text-xs', rec.className)}>
                  <RecIcon className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold font-mono tracking-wide uppercase text-[11px] mb-0.5">{rec.title}</p>
                    <p className="text-[11px] leading-relaxed opacity-90">{rec.rationale}</p>
                  </div>
                </div>
              </div>

              {/* Action Buttons Matrix */}
              <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-white/5">
                {actionDefs.map((def) => (
                  <ActionButton
                    key={def.action}
                    zoneId={zone.id}
                    zoneName={zone.name}
                    action={def.action}
                    label={def.label}
                    icon={def.icon}
                    colorClass={def.colorClass}
                    iconClass={def.iconClass}
                    dispatched={dispatched}
                    onDispatch={handleDispatch}
                    addIntervention={addIntervention}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
