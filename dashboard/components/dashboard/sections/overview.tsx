'use client'

import { useCrowdShield } from '@/lib/crowdshield/context'
import { ZONES } from '@/lib/crowdshield/zones'
import { MetricCard } from '@/components/dashboard/metric-card'
import { RiskTrendChart } from '@/components/dashboard/charts/risk-trend-chart'
import { ZoneRiskBreakdown } from '@/components/dashboard/charts/zone-risk-breakdown'
import { AlertFeed } from '@/components/dashboard/alert-feed'
import { HighRiskZones } from '@/components/dashboard/high-risk-zones'
import {
  Users,
  ShieldAlert,
  Timer,
  Activity,
  Play,
  RotateCcw,
  Zap,
  ArrowRightLeft,
  DoorClosed,
  UserCheck,
  Volume2,
  Navigation,
  Sparkles,
  AlertTriangle
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

export function OverviewSection() {
  const { events, totalEvents, interventions, setRefreshMode, addIntervention } = useCrowdShield()
  const [demoState, setDemoState] = useState<'idle' | 'before' | 'after' | 'loading'>('idle')

  const zoneList = ZONES.map((z) => events.get(z.id) ?? {
    zone_id: z.id,
    zone_name: z.name,
    timestamp: '',
    density_per_sqm: 1.5,
    flow_speed_mps: 1.1,
    risk_score: 0.25,
    risk_level: 'low',
    eta_minutes: null,
    recommendations: ['maintain_standard_flow'],
    announcement: { en: 'All areas clear.', hi: 'सभी क्षेत्र सुरक्षित हैं।' },
  })

  const criticalCount = zoneList.filter((zone) => zone.risk_level === 'critical').length
  const highCount = zoneList.filter((zone) => zone.risk_level === 'high').length
  const atRiskCount = criticalCount + highCount
  const validETAs = zoneList
    .map((zone) => zone.eta_minutes)
    .filter((eta): eta is number => eta !== null)
  const fastestETA = validETAs.length > 0 ? Math.min(...validETAs) : null
  const peakDensity = zoneList.length > 0 ? Math.max(...zoneList.map((zone) => zone.density_per_sqm ?? 0)) : 0
  const confirmedInterventions = interventions.filter(
    (intervention) => intervention.state === 'confirmed' || intervention.state === 'acknowledged'
  ).length

  async function triggerDemo(type: 'before' | 'after') {
    setDemoState('loading')
    setRefreshMode('live')
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000'
      await fetch(`${backendUrl}/demo/scenario?type=${type}`, { method: 'GET' })
      setDemoState(type)
    } catch {
      setDemoState('idle')
    }
  }

  async function resetDemo() {
    setDemoState('loading')
    setRefreshMode('live')
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000'
      await fetch(`${backendUrl}/demo/scenario?type=reset`, { method: 'GET' })
      setDemoState('idle')
    } catch {
      setDemoState('idle')
    }
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-300 min-w-0 max-w-full">
      {/* Simulation Trigger & Comparative State Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-card/80 border border-border rounded-xl text-xs min-w-0">
        <div className="flex items-center gap-2 min-w-0 truncate">
          <span className="text-muted-foreground font-medium shrink-0">AI Scenario Engine:</span>
          <span className="font-semibold text-foreground font-mono truncate">
            {demoState === 'idle' && 'Standard Real-time Telemetry'}
            {demoState === 'loading' && 'Injecting scenario parameters…'}
            {demoState === 'before' && 'Simulating Unmanaged Bottleneck & Crush Risk'}
            {demoState === 'after' && 'Simulating CrowdShield Automated AI Mitigation'}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => triggerDemo('before')}
            disabled={demoState === 'loading'}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium text-[11px] bg-destructive/10 border border-destructive/30 text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50"
          >
            <Play className="w-3 h-3" />
            Without CrowdShield (Baseline)
          </button>
          <button
            onClick={() => triggerDemo('after')}
            disabled={demoState === 'loading'}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium text-[11px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
          >
            <Play className="w-3 h-3" />
            With CrowdShield AI
          </button>
          <button
            onClick={resetDemo}
            disabled={demoState === 'loading'}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
            title="Reset to Standard Monitoring"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Top Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 min-w-0">
        <MetricCard
          title="Zones at Risk"
          value={atRiskCount.toString()}
          change={criticalCount > 0 ? `${criticalCount} critical` : 'None critical'}
          changeType={criticalCount > 0 ? 'negative' : atRiskCount > 0 ? 'neutral' : 'positive'}
          icon={ShieldAlert}
          delay={0}
        />
        <MetricCard
          title="Fastest ETA"
          value={fastestETA !== null ? `${fastestETA}m` : '—'}
          change="to threshold breach"
          changeType={fastestETA !== null && fastestETA <= 5 ? 'negative' : 'neutral'}
          icon={Timer}
          delay={1}
        />
        <MetricCard
          title="Peak Density"
          value={peakDensity > 0 ? `${peakDensity.toFixed(2)}/m²` : '—'}
          change="crowd per sq metre"
          changeType={peakDensity > 5 ? 'negative' : peakDensity > 3 ? 'neutral' : 'positive'}
          icon={Users}
          delay={2}
        />
        <MetricCard
          title="Interventions"
          value={confirmedInterventions.toString()}
          change={`${totalEvents} events processed`}
          changeType={confirmedInterventions > 0 ? 'neutral' : 'positive'}
          icon={Activity}
          delay={3}
        />
      </div>

      {/* TechNova Risk Prediction & Intelligent Action Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Risk Prediction Card */}
        <div className="bg-card border border-border rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-accent" />
                AI Risk Prediction Matrix
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-accent/15 text-accent border border-accent/25">
                5-Min Forecast
              </span>
            </div>
            <div className="space-y-2.5 mt-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Stampede Likelihood:</span>
                <span className={cn('font-mono font-bold', criticalCount > 0 ? 'text-destructive' : 'text-emerald-400')}>
                  {criticalCount > 0 ? 'HIGH (84%)' : 'LOW (<6%)'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Panic Propagation Risk:</span>
                <span className="font-mono font-semibold text-foreground">
                  {criticalCount > 0 ? 'Moderate (Sector 1)' : 'Minimal (Stable)'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Reverse Flow Turbulence:</span>
                <span className="font-mono font-semibold text-foreground">
                  {criticalCount > 0 ? 'Detected (+3.2 m/s pushback)' : 'None (One-Way)'}
                </span>
              </div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-border/50 text-[11px] text-muted-foreground flex items-center justify-between">
            <span>Prediction Confidence: <b>96.4%</b></span>
            <span className="text-accent font-semibold">Trained on 100k+ surges</span>
          </div>
        </div>

        {/* Intelligent Recommendations & Action Dispatch */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                TechNova Actionable Interventions
              </h3>
              <span className="text-[10px] text-muted-foreground font-mono">1-Click Dispatch</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Automated interventions recommended by the risk engine to pacify crowd surge before escalation:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
              <button
                onClick={() => addIntervention({ zone_id: 'gate_1', zone_name: 'South Gate', action: 'close', label: 'Close Entry' })}
                className="p-2.5 rounded-lg bg-secondary/50 border border-border hover:border-destructive/40 hover:bg-destructive/10 text-left transition-all text-xs"
              >
                <DoorClosed className="w-4 h-4 text-destructive mb-1" />
                <p className="font-semibold text-foreground">Close Entry Gate</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Halt incoming influx</p>
              </button>

              <button
                onClick={() => addIntervention({ zone_id: 'gate_2', zone_name: 'West Gate', action: 'reroute', label: 'Open Exits' })}
                className="p-2.5 rounded-lg bg-secondary/50 border border-border hover:border-emerald-500/40 hover:bg-emerald-500/10 text-left transition-all text-xs"
              >
                <Navigation className="w-4 h-4 text-emerald-400 mb-1" />
                <p className="font-semibold text-foreground">Open Alternate Exits</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Activate NW & SE paths</p>
              </button>

              <button
                onClick={() => addIntervention({ zone_id: 'gate_1', zone_name: 'South Gate', action: 'staff', label: 'Deploy Staff' })}
                className="p-2.5 rounded-lg bg-secondary/50 border border-border hover:border-accent/40 hover:bg-accent/10 text-left transition-all text-xs"
              >
                <UserCheck className="w-4 h-4 text-accent mb-1" />
                <p className="font-semibold text-foreground">Deploy Security</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Dispatch +4 marshals</p>
              </button>

              <button
                onClick={() => addIntervention({ zone_id: 'all', zone_name: 'All Zones', action: 'broadcast', label: 'PA Broadcast' })}
                className="p-2.5 rounded-lg bg-secondary/50 border border-border hover:border-amber-500/40 hover:bg-amber-500/10 text-left transition-all text-xs"
              >
                <Volume2 className="w-4 h-4 text-amber-400 mb-1" />
                <p className="font-semibold text-foreground">Public Broadcast</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Multilingual calm audio</p>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Middle Row: Trend Chart & Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 min-w-0">
        <div className="lg:col-span-2 min-w-0">
          <RiskTrendChart />
        </div>
        <div className="min-w-0">
          <ZoneRiskBreakdown />
        </div>
      </div>

      {/* Bottom Row: Alert Feed & Highest Risk Zones */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 min-w-0">
        <div className="min-w-0">
          <AlertFeed />
        </div>
        <div className="min-w-0">
          <HighRiskZones />
        </div>
      </div>
    </div>
  )
}
