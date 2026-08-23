'use client'

import React from 'react'
import { useCrowdShield } from '@/lib/crowdshield/context'
import { ZONES } from '@/lib/crowdshield/zones'
import { CommandKpiCards } from '@/components/dashboard/command-kpi-cards'
import { RiskTrendChart } from '@/components/dashboard/charts/risk-trend-chart'
import { GateMasterDetailConsole } from '@/components/dashboard/gate-master-detail-console'
import {
  ShieldCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export function OverviewSection() {
  const {
    events,
    history,
    totalEvents,
    interventions,
    setRefreshMode,
    addIntervention,
    connectionStatus,
    triggerSurge,
    triggerMitigation,
  } = useCrowdShield()

  const [now, setNow] = React.useState<number>(Date.now())

  React.useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Map zone data
  const zoneList = ZONES.map((z) => events.get(z.id) ?? {
    zone_id: z.id,
    zone_name: z.name,
    timestamp: '',
    density_per_sqm: 1.2,
    flow_speed_mps: 1.1,
    risk_score: 0.22,
    risk_level: 'low' as const,
    eta_minutes: null,
    recommendations: ['maintain_standard_flow'],
    announcement: { en: 'All areas clear, normal flow.', hi: 'सभी क्षेत्र सामान्य हैं।' },
  }).sort((a, b) => (b.risk_score ?? 0) - (a.risk_score ?? 0))

  const activeInterventionsCount = interventions.filter(
    (item) => item.state === 'confirmed' || item.state === 'acknowledged'
  ).length

  // Scan all zone events for any with eta_minutes !== null and risk_level !== 'low'
  const activeEtaZones = zoneList.filter(
    (z) => z.eta_minutes !== null && z.eta_minutes !== undefined && z.risk_level !== 'low'
  )

  let criticalZoneWithLowestEta: (typeof zoneList[0] & { remainingMinutes: number }) | null = null

  if (activeEtaZones.length > 0) {
    const withComputedEta = activeEtaZones.map((z) => {
      const eventTime = z.timestamp ? new Date(z.timestamp).getTime() : now
      const etaMs = (z.eta_minutes ?? 0) * 60 * 1000
      const targetTime = eventTime + etaMs
      const remainingMs = targetTime - now
      const remainingMinutes = Math.max(1, Math.ceil(remainingMs / (60 * 1000)))
      return { ...z, remainingMinutes }
    })

    withComputedEta.sort((a, b) => a.remainingMinutes - b.remainingMinutes)
    criticalZoneWithLowestEta = withComputedEta[0]
  }

  // Quick simulation triggers with direct reactive state updating
  const handleSimulateSurge = async () => {
    setRefreshMode('live')
    triggerSurge('gate_3') // North Entrance
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000'
      await fetch(`${backendUrl}/demo/scenario?type=before`, { method: 'GET' })
    } catch {
      // Local fallback active
    }
  }

  const handleSimulateMitigate = async () => {
    setRefreshMode('live')
    triggerMitigation()
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000'
      await fetch(`${backendUrl}/demo/scenario?type=after`, { method: 'GET' })
    } catch {
      // Local fallback active
    }
  }

  const handleDispatch = (
    zoneId: string,
    zoneName: string,
    action: string,
    label: string
  ) => {
    addIntervention({
      zone_id: zoneId,
      zone_name: zoneName,
      action,
      label,
    })
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300 min-w-0 max-w-full pb-10 select-none">
      {/* ── PROMINENT PREDICTIVE EARLY WARNING BANNER ─────────────────── */}
      {criticalZoneWithLowestEta ? (
        <div
          className={cn(
            'w-full rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4 border shadow-sm transition-all animate-pulse',
            criticalZoneWithLowestEta.risk_level === 'critical'
              ? 'bg-destructive/10 border-destructive/40 text-destructive'
              : 'bg-warning/10 border-warning/40 text-warning'
          )}
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div
              className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                criticalZoneWithLowestEta.risk_level === 'critical'
                  ? 'bg-destructive/20 text-destructive'
                  : 'bg-warning/20 text-warning'
              )}
            >
              <AlertTriangle className="w-5 h-5 shrink-0" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold tracking-tight text-sm sm:text-base">
                  ⚠ {criticalZoneWithLowestEta.zone_name} projected to reach CRITICAL density in{' '}
                  <span className="font-mono underline underline-offset-4 decoration-2">
                    {criticalZoneWithLowestEta.remainingMinutes}
                  </span>{' '}
                  {criticalZoneWithLowestEta.remainingMinutes === 1 ? 'minute' : 'minutes'} — AI intervention recommended.
                </span>
              </div>
              <p className="text-xs opacity-90 mt-0.5 font-medium">
                Predictive AI Early Warning · 10-Minute Target Intervention Window Active
              </p>
            </div>
          </div>
          <div className="shrink-0 hidden md:flex items-center gap-2 font-mono text-xs font-bold px-3 py-1.5 rounded-lg border border-current/20 bg-background/50">
            <span>ETA: ~{criticalZoneWithLowestEta.remainingMinutes}m</span>
          </div>
        </div>
      ) : (
        <div className="w-full rounded-2xl p-3.5 sm:p-4 flex items-center justify-between gap-3 border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-bold">
                All zones stable — no imminent risk detected.
              </p>
              <p className="text-[11px] text-muted-foreground">
                Predictive telemetry nominal · Egress corridors clear
              </p>
            </div>
          </div>
          <span className="text-[11px] font-mono font-semibold px-2.5 py-1 rounded-md bg-background/50 border border-emerald-500/20 hidden sm:inline">
            Status: Nominal
          </span>
        </div>
      )}

      {/* ── 4 TOP DESIGNER KPI CARDS WITH EMBEDDED MICRO-CHARTS ───────── */}
      <CommandKpiCards
        zoneList={zoneList}
        activeInterventionsCount={activeInterventionsCount}
        onSimulateSurge={handleSimulateSurge}
        onSimulateMitigate={handleSimulateMitigate}
      />

      {/* ── MAIN UNIFIED MULTI-LINE TELEMETRY & TRAJECTORY GRAPH ───────── */}
      <RiskTrendChart />

      {/* ── SECTOR OPERATIONS & RAPID DISPATCH MATRIX ──────────────────── */}
      <GateMasterDetailConsole
        zoneList={zoneList}
        history={history}
        onDispatch={handleDispatch}
      />

      {/* ── SAFETY PROTOCOL AUDIT TRAIL ───────────────────────────────── */}
      <div className="bg-card/80 border border-border/80 rounded-2xl p-4 text-xs font-mono">
        <div className="flex items-center justify-between mb-2 pb-2 border-b border-border/40">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-accent" />
            <span className="font-semibold text-foreground tracking-tight text-[12px]">
              Safety Protocol Audit Stream
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground uppercase">
            {interventions.length} Logged Actions
          </span>
        </div>

        {interventions.length === 0 ? (
          <div className="py-1 text-center text-muted-foreground/70 text-[11px] flex items-center justify-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>All automated safety protocols on standby · All sectors operating within normal limits</span>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 max-h-[90px] overflow-y-auto pt-1">
            {interventions.slice(0, 6).map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-secondary/80 border border-border text-[11px]"
              >
                <Clock className="w-3 h-3 text-muted-foreground" />
                <span className="font-semibold text-foreground">{item.zone_name}</span>
                <span className="text-muted-foreground/40">·</span>
                <span className="text-accent">{item.label}</span>
                <span
                  className={cn(
                    'text-[9px] font-bold uppercase px-1.5 py-0.2 rounded',
                    item.state === 'acknowledged'
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'bg-accent/15 text-accent'
                  )}
                >
                  {item.state}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
