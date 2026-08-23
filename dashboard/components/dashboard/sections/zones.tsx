'use client'

import React, { useMemo, useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { useCrowdShield } from '@/lib/crowdshield/context'
import { ZONES } from '@/lib/crowdshield/zones'
import { RISK_BADGE_CLASSES } from '@/lib/crowdshield/theme'
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
} from 'lucide-react'

type Filter = 'all' | RiskLevel

// ── AI Recommendation copy per risk level ──────────────────────────────────
const AI_RECOMMENDATIONS: Record<string, { icon: string; text: string; className: string }> = {
  critical: {
    icon: '⚠',
    text: 'AI Recommendation: Immediate reroute + PA broadcast. Deploy 3 staff. Close secondary entrance.',
    className: 'bg-rose-500/10 border-rose-500/30 text-rose-300',
  },
  high: {
    icon: '↑',
    text: 'AI Recommendation: Open Gate 3 as overflow. Broadcast in Hindi + English.',
    className: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
  },
  medium: {
    icon: '→',
    text: 'AI Recommendation: Monitor flow. Pre-position 1 staff member.',
    className: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300',
  },
  low: {
    icon: '✓',
    text: 'Zone operating normally. No intervention required.',
    className: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
  },
  none: {
    icon: '–',
    text: 'Awaiting sensor data…',
    className: 'bg-white/5 border-white/10 text-muted-foreground',
  },
}

// ── Animated risk bar ──────────────────────────────────────────────────────
function RiskBar({ score, level }: { score: number; level: string }) {
  const [width, setWidth] = useState(0)
  const mounted = useRef(false)

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      // Trigger the CSS transition after a brief paint tick
      const raf = requestAnimationFrame(() => setWidth(score))
      return () => cancelAnimationFrame(raf)
    } else {
      setWidth(score)
    }
  }, [score])

  return (
    <div className="w-1/2">
      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full',
            level === 'critical'
              ? 'bg-rose-500'
              : level === 'high'
              ? 'bg-amber-500'
              : level === 'medium'
              ? 'bg-cyan-400'
              : 'bg-emerald-400'
          )}
          style={{
            width: `${width}%`,
            transition: 'width 1s ease-out',
          }}
        />
      </div>
      <p className="text-right text-xs font-mono text-cyan-300 font-bold mt-1">{score}%</p>
    </div>
  )
}

// ── Action button with dispatched-feedback state ───────────────────────────
interface ActionBtnProps {
  zoneId: string
  zoneName: string
  action: string
  label: string
  icon: React.ElementType
  colorClass: string   // e.g. 'hover:bg-cyan-500/20 hover:text-cyan-300'
  iconClass: string    // e.g. 'text-cyan-400'
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
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all duration-300',
        isDone
          ? 'bg-accent/20 text-accent border-accent/40 cursor-default'
          : `bg-white/5 text-foreground border-white/10 ${colorClass}`
      )}
    >
      {isDone ? (
        <>
          <CheckCircle2 className="w-3.5 h-3.5 text-accent" />
          Dispatched
        </>
      ) : (
        <>
          <Icon className={cn('w-3.5 h-3.5', iconClass)} />
          {label}
        </>
      )}
    </button>
  )
}

// ── Main section ───────────────────────────────────────────────────────────
export function ZonesSection() {
  const { events, addIntervention } = useCrowdShield()
  const [filter, setFilter] = useState<Filter>('all')
  const [dispatched, setDispatched] = useState<Record<string, string>>({})

  function handleDispatch(key: string) {
    setDispatched((prev) => ({ ...prev, [key]: Date.now().toString() }))
    setTimeout(() => {
      setDispatched((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }, 2000)
  }

  const cards = useMemo(
    () =>
      ZONES.map((zone) => ({ zone, event: events.get(zone.id) }))
        .filter(({ event }) => filter === 'all' || event?.risk_level === filter)
        .sort((a, b) => (b.event?.risk_score ?? 0) - (a.event?.risk_score ?? 0)),
    [events, filter]
  )

  const riskCount = Array.from(events.values()).filter(
    (e) => e.risk_level === 'high' || e.risk_level === 'critical'
  ).length

  const summaryCards = [
    { label: 'Zones Monitored', value: ZONES.length, sub: 'All gates online', subColor: 'text-cyan-400' },
    { label: 'AI Interventions Today', value: 7, sub: '+3 since last hour', subColor: 'text-accent' },
    { label: 'Crush Events Prevented', value: 3, sub: 'Since session start', subColor: 'text-emerald-400' },
    { label: 'Zones at Risk', value: riskCount, sub: riskCount > 0 ? 'Requires action' : 'All clear', subColor: riskCount > 0 ? 'text-rose-400' : 'text-emerald-400' },
  ]

  return (
    <div className="space-y-5 animate-in fade-in duration-300">

      {/* ── Top summary cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {summaryCards.map(({ label, value, sub, subColor }) => (
          <div key={label} className="glass-card rounded-2xl p-4 border border-white/10">
            <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">
              {label}
            </p>
            <p className="text-2xl font-bold font-mono text-foreground">{value}</p>
            <p className={cn('text-xs font-mono mt-0.5', subColor)}>{sub}</p>
          </div>
        ))}
      </div>

      {/* ── Filter bar (no search) ─────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl px-4 py-3 flex items-center justify-between border border-white/10">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-accent" />
          <span className="text-xs font-semibold text-muted-foreground">Filter by risk level</span>
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

      {/* ── Zone cards grid ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {cards.map(({ zone, event }) => {
          const level = (event?.risk_level ?? 'none') as RiskLevel | 'none'
          const score = Math.round((event?.risk_score ?? 0) * 100)
          const rec = AI_RECOMMENDATIONS[level] ?? AI_RECOMMENDATIONS.none

          const actionDefs = [
            {
              action: 'broadcast_alert', label: 'Broadcast',
              icon: Megaphone, colorClass: 'hover:bg-cyan-500/20 hover:text-cyan-300', iconClass: 'text-cyan-400',
            },
            {
              action: 'open_gate', label: 'Open Gate',
              icon: DoorClosed, colorClass: 'hover:bg-emerald-500/20 hover:text-emerald-300', iconClass: 'text-emerald-400',
            },
            {
              action: 'deploy_staff', label: 'Deploy Staff',
              icon: UserCheck, colorClass: 'hover:bg-amber-500/20 hover:text-amber-300', iconClass: 'text-amber-400',
            },
            {
              action: 'reroute', label: 'Reroute',
              icon: ArrowRightLeft, colorClass: 'hover:bg-violet-500/20 hover:text-violet-300', iconClass: 'text-violet-400',
            },
          ]

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
              {/* Zone header */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3
                    className="font-semibold text-base text-foreground"
                    style={{ fontFamily: "'Ysabeau SC', sans-serif" }}
                  >
                    {zone.name}
                  </h3>
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

              {/* Risk score + animated progress bar */}
              <div className="mt-5 flex items-end justify-between">
                <div>
                  <p className="text-3xl font-bold font-mono text-foreground">
                    {event ? event.risk_score.toFixed(2) : '—'}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono">Risk Index Score</p>
                </div>
                <RiskBar score={score} level={level} />
              </div>

              {/* Stats row */}
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

              {/* AI Recommendation banner */}
              <div className={cn('mt-4 rounded-xl border px-3 py-2.5 flex items-start gap-2', rec.className)}>
                <span className="text-sm mt-px shrink-0">{rec.icon}</span>
                <p className="text-[11px] leading-relaxed font-medium">{rec.text}</p>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2 mt-4">
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
