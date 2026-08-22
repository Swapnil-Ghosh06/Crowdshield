'use client'

import { useCrowdShield } from '@/lib/crowdshield/context'
import { MetricCard } from '@/components/dashboard/metric-card'
import { RiskTrendChart } from '@/components/dashboard/charts/risk-trend-chart'
import { ZoneRiskBreakdown } from '@/components/dashboard/charts/zone-risk-breakdown'
import { AlertFeed } from '@/components/dashboard/alert-feed'
import { HighRiskZones } from '@/components/dashboard/high-risk-zones'
import { Users, ShieldAlert, Timer, Activity } from 'lucide-react'

export function OverviewSection() {
  const { events, totalEvents, interventions } = useCrowdShield()
  const zoneList = Array.from(events.values())
  const criticalCount = zoneList.filter((zone) => zone.risk_level === 'critical').length
  const highCount = zoneList.filter((zone) => zone.risk_level === 'high').length
  const atRiskCount = criticalCount + highCount
  const validETAs = zoneList.map((zone) => zone.eta_minutes).filter((eta): eta is number => eta !== null)
  const fastestETA = validETAs.length > 0 ? Math.min(...validETAs) : null
  const peakDensity = zoneList.length > 0 ? Math.max(...zoneList.map((zone) => zone.density_per_sqm ?? 0)) : 0
  const confirmedInterventions = interventions.filter((intervention) => intervention.state === 'confirmed' || intervention.state === 'acknowledged').length

  return (
    <div className="space-y-6">
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
