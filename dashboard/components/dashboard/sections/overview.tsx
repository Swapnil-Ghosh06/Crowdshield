'use client'

import { useCrowdShield } from '@/lib/crowdshield/context'
import { ZONES } from '@/lib/crowdshield/zones'
import { MetricCard } from '@/components/dashboard/metric-card'
import { RiskTrendChart } from '@/components/dashboard/charts/risk-trend-chart'
import { ZoneRiskBreakdown } from '@/components/dashboard/charts/zone-risk-breakdown'
import { AlertFeed } from '@/components/dashboard/alert-feed'
import { HighRiskZones } from '@/components/dashboard/high-risk-zones'
import { Users, ShieldAlert, Timer, Activity, Play, RotateCcw } from 'lucide-react'
import { useState } from 'react'

export function OverviewSection() {
  const { events, totalEvents, interventions, setRefreshMode } = useCrowdShield()
  const [demoState, setDemoState] = useState<'idle' | 'before' | 'after' | 'loading'>('idle')

  const zoneList = ZONES.map(z => events.get(z.id) ?? {
    zone_id: z.id,
    zone_name: z.name,
    timestamp: '',
    density_per_sqm: 1.5,
    flow_speed_mps: 1.1,
    risk_score: 0.25,
    risk_level: 'low',
    eta_minutes: null,
    recommendations: ['maintain_standard_flow'],
    announcement: { en: 'All areas clear.', hi: 'सभी क्षेत्र सुरक्षित हैं।' }
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

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Simulation Trigger Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-card/60 border border-border/80 rounded-xl text-xs">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground font-medium">Scenario:</span>
          <span className="font-semibold text-foreground font-mono">
            {demoState === 'idle' && 'Standard Monitoring'}
            {demoState === 'loading' && 'Triggering scenario…'}
            {demoState === 'before' && 'Simulating Uncontrolled Bottleneck'}
            {demoState === 'after' && 'Simulating CrowdShield Mitigation'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => triggerDemo('before')}
            disabled={demoState === 'loading'}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium text-[11px] bg-destructive/10 border border-destructive/30 text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50"
          >
            <Play className="w-3 h-3" />
            Without CrowdShield
          </button>
          <button
            onClick={() => triggerDemo('after')}
            disabled={demoState === 'loading'}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium text-[11px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
          >
            <Play className="w-3 h-3" />
            With CrowdShield
          </button>
          <button
            onClick={() => setDemoState('idle')}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            title="Reset"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Top Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

      {/* Middle Row: Trend Chart & Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <RiskTrendChart />
        </div>
        <ZoneRiskBreakdown />
      </div>

      {/* Bottom Row: Alert Feed & Highest Risk Zones */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <AlertFeed />
        <HighRiskZones />
      </div>
    </div>
  )
}
