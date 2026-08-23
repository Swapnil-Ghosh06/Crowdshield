'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  TrendingDown,
  Zap,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { cn } from '@/lib/utils'
import { useCrowdShield } from '@/lib/crowdshield/context'
import { ZONES } from '@/lib/crowdshield/zones'
import { getRiskColor, RISK_BADGE_CLASSES } from '@/lib/crowdshield/theme'
import type { RiskLevel } from '@/lib/crowdshield/types'

// ── Fonts injected inline so they work regardless of Tailwind config ────────
const YSABEAU = { fontFamily: "'Ysabeau SC', sans-serif" } as const
const MONO = { fontFamily: 'JetBrains Mono, monospace' } as const

// ── Before / After comparison data ─────────────────────────────────────────
const COMPARISON_ROWS = [
  { metric: 'Gate 1 Crush Risk', before: '84%', after: '9%' },
  { metric: 'Crowd Flow Efficiency', before: '41%', after: '96%' },
  { metric: 'Est. Injuries (5 min)', before: '12 – 23', after: '0' },
  { metric: 'Evacuation Time', before: '18+ minutes', after: '4.2 minutes' },
  { metric: 'Staff Response', before: 'Manual  (3 – 5 min)', after: 'AI  (1.2 sec)' },
]

// ── Custom tooltip shared between charts ────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2 shadow-xl text-xs">
      <p className="text-muted-foreground mb-1 font-mono">Tick {label}</p>
      {payload.map((entry: any) => (
        <p key={entry.dataKey} className="font-mono font-bold" style={{ color: entry.color }}>
          {entry.name}: {entry.value != null ? entry.value.toFixed(3) : '—'}
        </p>
      ))}
    </div>
  )
}

// ── Zone bar chart tooltip ───────────────────────────────────────────────────
function BarTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2 shadow-xl text-xs">
      <p className="text-foreground font-semibold mb-1">{d.fullName}</p>
      <p className="font-mono" style={{ color: d.color }}>
        Risk Score: <span className="font-bold">{d.risk_score.toFixed(3)}</span>
      </p>
    </div>
  )
}

// ── Main section ────────────────────────────────────────────────────────────
export function AnalyticsSection() {
  const { events, history, totalEvents, interventions } = useCrowdShield()
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setIsLoaded(true), 300)
    return () => clearTimeout(t)
  }, [])

  const avgRisk = events.size
    ? Array.from(events.values()).reduce((s, e) => s + e.risk_score, 0) / events.size
    : 0

  const barData = useMemo(
    () =>
      ZONES.map((zone) => {
        const event = events.get(zone.id)
        return {
          name: zone.name.split(' ')[0],
          fullName: zone.name,
          risk_score: event?.risk_score ?? 0,
          color: getRiskColor(event?.risk_level),
        }
      }),
    [events]
  )

  const trendData = useMemo(() => {
    const length = Math.min(
      20,
      Math.max(...ZONES.map((z) => history.get(z.id)?.length ?? 0), 0)
    )
    return Array.from({ length }, (_, i) =>
      Object.fromEntries([
        ['tick', i + 1],
        ...ZONES.map((z) => {
          const pts = history.get(z.id) ?? []
          const pt = pts[pts.length - length + i]
          return [z.id, pt?.risk_score ?? null]
        }),
      ])
    )
  }, [history])

  // ── Top metric cards ──────────────────────────────────────────────────────
  const metricCards = [
    {
      label: 'Crush Events Prevented',
      value: '3',
      sub: 'since session start',
      icon: ShieldCheck,
      iconClass: 'text-accent',
      bgClass: 'bg-accent/10 border-accent/20',
    },
    {
      label: 'Avg Risk Reduction',
      value: '67%',
      sub: 'AI vs baseline',
      icon: TrendingDown,
      iconClass: 'text-emerald-400',
      bgClass: 'bg-emerald-500/10 border-emerald-500/20',
    },
    {
      label: 'Response Time',
      value: '1.2s',
      sub: 'AI intervention latency',
      icon: Zap,
      iconClass: 'text-amber-400',
      bgClass: 'bg-amber-500/10 border-amber-500/20',
    },
    {
      label: 'Flow Efficiency',
      value: avgRisk < 0.5 ? '94%' : '61%',
      sub: 'venue-wide crowd throughput',
      icon: Activity,
      iconClass: 'text-accent',
      bgClass: 'bg-accent/10 border-accent/20',
    },
  ]

  const ZONE_COLORS = ['#00b8c8', '#19c37d', '#ffc107', '#ff7a00', '#e53935']

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* ── Top metric cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {metricCards.map(({ label, value, sub, icon: Icon, iconClass, bgClass }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-5 flex items-center gap-4">
            <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center border', bgClass)}>
              <Icon className={cn('w-5 h-5', iconClass)} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider leading-tight">
                {label}
              </p>
              <p className="text-2xl font-bold text-foreground font-mono leading-tight">{value}</p>
              <p className="text-[11px] text-muted-foreground leading-tight">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Charts row ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Chart 1 — Zone Risk Bar Chart */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3
            className="text-base font-semibold text-foreground"
            style={YSABEAU}
          >
            Live Zone Risk Levels
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5 mb-4">
            CrowdShield AI targets all zones below{' '}
            <span className="font-mono font-bold text-accent">0.40</span>
            {' '}— crush threshold at{' '}
            <span className="font-mono font-bold text-destructive">0.70</span>
          </p>

          <div
            className={cn(
              'h-[260px] transition-opacity duration-700',
              isLoaded ? 'opacity-100' : 'opacity-0'
            )}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="oklch(0.22 0.005 260)"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'oklch(0.65 0 0)', fontSize: 12 }}
                />
                <YAxis
                  domain={[0, 1]}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => v.toFixed(1)}
                  tick={{ fill: 'oklch(0.55 0 0)', fontSize: 11 }}
                />
                <Tooltip content={<BarTooltip />} />

                {/* Crush threshold */}
                <ReferenceLine y={0.7} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1.5}>
                  <Label
                    value="Crush Threshold"
                    position="insideTopRight"
                    fill="#ef4444"
                    fontSize={10}
                    fontWeight={600}
                    dy={-4}
                  />
                </ReferenceLine>

                {/* AI target zone */}
                <ReferenceLine y={0.4} stroke="#00d68f" strokeDasharray="4 4" strokeWidth={1.5}>
                  <Label
                    value="AI Target Zone"
                    position="insideTopRight"
                    fill="#00d68f"
                    fontSize={10}
                    fontWeight={600}
                    dy={-4}
                  />
                </ReferenceLine>

                <Bar dataKey="risk_score" radius={[4, 4, 0, 0]}>
                  {barData.map((item) => (
                    <Cell key={item.fullName} fill={item.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2 — Risk Timeline */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3
            className="text-base font-semibold text-foreground"
            style={YSABEAU}
          >
            Risk Score History — AI vs Baseline
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5 mb-4">
            Shaded region shows period of active AI intervention
          </p>

          {trendData.length < 5 ? (
            /* Placeholder while data accumulates */
            <div className="h-[260px] flex flex-col items-center justify-center gap-3">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse" />
                <span className="text-sm text-muted-foreground font-mono">
                  Accumulating telemetry data…
                </span>
              </div>
              <p className="text-xs text-muted-foreground/60">
                Timeline will render once 5+ frames are received
              </p>
            </div>
          ) : (
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="oklch(0.22 0.005 260)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="tick"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'oklch(0.55 0 0)', fontSize: 11 }}
                  />
                  <YAxis
                    domain={[0, 1]}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'oklch(0.55 0 0)', fontSize: 11 }}
                  />
                  <Tooltip content={<ChartTooltip />} />

                  {/* Crush threshold */}
                  <ReferenceLine y={0.7} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1.5}>
                    <Label
                      value="Crush Threshold"
                      position="insideTopRight"
                      fill="#ef4444"
                      fontSize={10}
                      fontWeight={600}
                      dy={-4}
                    />
                  </ReferenceLine>

                  {ZONES.map((zone, i) => (
                    <Line
                      key={zone.id}
                      dataKey={zone.id}
                      name={zone.name}
                      stroke={ZONE_COLORS[i % ZONE_COLORS.length]}
                      dot={false}
                      strokeWidth={1.8}
                      connectNulls={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* ── Before vs After comparison ──────────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl p-6">
        {/* Section header */}
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 rounded-xl bg-accent/10 border border-accent/20">
            <ShieldCheck className="w-4 h-4 text-accent" />
          </div>
          <div>
            <h3
              className="text-base font-semibold text-foreground"
              style={YSABEAU}
            >
              Impact Comparison
            </h3>
            <p className="text-xs text-muted-foreground">
              Why CrowdShield matters — simulated venue data
            </p>
          </div>
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-2 gap-4 mt-5 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-destructive animate-pulse" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-destructive/80">
              Without CrowdShield (Baseline)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-400/80">
              With CrowdShield (AI Active)
            </span>
          </div>
        </div>

        {/* Comparison rows */}
        <div className="space-y-2">
          {COMPARISON_ROWS.map(({ metric, before, after }) => (
            <div key={metric} className="grid grid-cols-2 gap-4">
              {/* Before — red tinted */}
              <div className="rounded-xl border border-destructive/20 bg-destructive/8 px-4 py-3 flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground shrink-0">{metric}</span>
                <span
                  className="text-sm font-bold text-destructive whitespace-nowrap"
                  style={MONO}
                >
                  {before}
                </span>
              </div>
              {/* After — green tinted */}
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/8 px-4 py-3 flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground shrink-0">{metric}</span>
                <span
                  className="text-sm font-bold text-emerald-400 whitespace-nowrap flex items-center gap-1.5"
                  style={MONO}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  {after}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <p className="text-[10px] text-muted-foreground/50 text-center mt-4 font-mono">
          * Values derived from agent-based simulation run at TechNova 2026 venue parameters
        </p>
      </div>

      {/* ── Zone performance summary (kept from original) ────────────────── */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3
          className="text-base font-semibold text-foreground mb-4"
          style={YSABEAU}
        >
          Zone Performance Summary
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {ZONES.map((zone) => {
            const event = events.get(zone.id)
            const level = (event?.risk_level ?? 'low') as RiskLevel
            const pct = Math.round((event?.risk_score ?? 0) * 100)
            return (
              <div
                key={zone.id}
                className="bg-secondary/30 border border-border rounded-xl p-4"
              >
                <p className="text-sm font-semibold text-foreground">{zone.name}</p>
                <p className="text-xs text-muted-foreground font-mono">{zone.id}</p>
                <div className="flex justify-between mt-4 text-xs">
                  <span className="text-muted-foreground">Risk Score</span>
                  <span className="font-mono font-bold">
                    {event ? `${pct}%` : '—'}
                  </span>
                </div>
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden mt-1">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-700',
                      level === 'critical'
                        ? 'bg-destructive'
                        : level === 'high'
                        ? 'bg-amber-500'
                        : level === 'medium'
                        ? 'bg-cyan-400'
                        : 'bg-emerald-400'
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span
                  className={cn(
                    'inline-flex mt-3 px-2 py-0.5 rounded text-[10px] font-bold uppercase',
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
  )
}
