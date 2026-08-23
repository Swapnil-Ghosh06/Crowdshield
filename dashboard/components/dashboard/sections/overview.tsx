'use client'

import { useCrowdShield } from '@/lib/crowdshield/context'
import { MetricCard } from '@/components/dashboard/metric-card'
import { RiskTrendChart } from '@/components/dashboard/charts/risk-trend-chart'
import { ZoneRiskBreakdown } from '@/components/dashboard/charts/zone-risk-breakdown'
import { AlertFeed } from '@/components/dashboard/alert-feed'
import { HighRiskZones } from '@/components/dashboard/high-risk-zones'
import { Users, ShieldAlert, Timer, Activity, Play, RotateCcw } from 'lucide-react'
import { useState } from 'react'

export function OverviewSection() {
  const { events, totalEvents, interventions } = useCrowdShield()
  const [demoState, setDemoState] = useState<'idle' | 'before' | 'after' | 'loading'>('idle')

  const zoneList = Array.from(events.values())
  const criticalCount = zoneList.filter((zone) => zone.risk_level === 'critical').length
  const highCount = zoneList.filter((zone) => zone.risk_level === 'high').length
  const atRiskCount = criticalCount + highCount
  const validETAs = zoneList.map((zone) => zone.eta_minutes).filter((eta): eta is number => eta !== null)
  const fastestETA = validETAs.length > 0 ? Math.min(...validETAs) : null
  const peakDensity = zoneList.length > 0 ? Math.max(...zoneList.map((zone) => zone.density_per_sqm ?? 0)) : 0
  const confirmedInterventions = interventions.filter((intervention) => intervention.state === 'confirmed' || intervention.state === 'acknowledged').length

  async function triggerDemo(type: 'before' | 'after') {
    setDemoState('loading')
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000'
      await fetch(`${backendUrl}/demo/scenario?type=${type}`, { method: 'GET' })
      setDemoState(type)
    } catch {
      setDemoState('idle')
    }
  }

  return (
    <div className="space-y-6">
      {/* Demo Scenario Controls */}
      <div className="flex items-center gap-3 p-4 bg-card border border-border rounded-xl">
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">Live Demo Scenario</p>
          <p className="text-xs text-muted-foreground">
            {demoState === 'idle' && 'Trigger a scripted 20-second incident replay over WebSocket.'}
            {demoState === 'loading' && 'Starting scenario…'}
            {demoState === 'before' && '▶ Playing: Uncontrolled surge — no intervention. Watch gate_3 go critical.'}
            {demoState === 'after' && '▶ Playing: CrowdShield intervention active. Watch density drop.'}
          </p>
        </div>
        <button
          onClick={() => triggerDemo('before')}
          disabled={demoState === 'loading'}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold bg-destructive/20 border border-destructive/40 text-destructive hover:bg-destructive/30 transition-colors disabled:opacity-50"
        >
          <Play className="w-3 h-3" />
          Without CrowdShield
        </button>
        <button
          onClick={() => triggerDemo('after')}
          disabled={demoState === 'loading'}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold bg-green-500/20 border border-green-500/40 text-green-400 hover:bg-green-500/30 transition-colors disabled:opacity-50"
        >
          <Play className="w-3 h-3" />
          With CrowdShield
        </button>
        <button
          onClick={() => setDemoState('idle')}
          className="p-2 rounded-lg text-xs text-muted-foreground hover:bg-secondary transition-colors"
          title="Reset"
        >
          <RotateCcw className="w-3 h-3" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Zones at Risk" value={atRiskCount.toString()} change={criticalCount > 0 ? `${criticalCount} CRITICAL` : 'None critical'} changeType={criticalCount > 0 ? 'negative' : atRiskCount > 0 ? 'neutral' : 'positive'} icon={ShieldAlert} delay={0} />
        <MetricCard title="Fastest ETA" value={fastestETA !== null ? `${fastestETA}m` : '—'} change="to threshold breach" changeType={fastestETA !== null && fastestETA <= 3 ? 'negative' : 'neutral'} icon={Timer} delay={1} />
        <MetricCard title="Peak Density" value={peakDensity > 0 ? `${peakDensity}/m²` : '—'} change="crowd per sq metre" changeType={peakDensity > 5 ? 'negative' : peakDensity > 3 ? 'neutral' : 'positive'} icon={Users} delay={2} />
        <MetricCard title="Interventions" value={confirmedInterventions.toString()} change={`${totalEvents} events processed`} changeType={confirmedInterventions > 0 ? 'neutral' : 'positive'} icon={Activity} delay={3} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2"><RiskTrendChart /></div>
        <ZoneRiskBreakdown />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AlertFeed />
        <HighRiskZones />
      </div>
    </div>
  )
}
