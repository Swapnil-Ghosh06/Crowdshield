'use client'

import { useEffect, useState } from 'react'
import { useCrowdShield } from '@/lib/crowdshield/context'

const LEVEL_CONFIG = [
  { level: 'critical', label: 'Critical', colorClass: 'bg-destructive' },
  { level: 'high', label: 'High Risk', colorClass: 'bg-orange-500' },
  { level: 'medium', label: 'Medium', colorClass: 'bg-warning' },
  { level: 'low', label: 'Low', colorClass: 'bg-success' },
] as const

export function ZoneRiskBreakdown() {
  const { events } = useCrowdShield()
  const [isLoaded, setIsLoaded] = useState(false)
  useEffect(() => { const timer = setTimeout(() => setIsLoaded(true), 400); return () => clearTimeout(timer) }, [])
  const zoneList = Array.from(events.values())
  const total = zoneList.length || 1
  const counts = LEVEL_CONFIG.map((config) => { const count = zoneList.filter((zone) => zone.risk_level === config.level).length; return { ...config, count, pct: Math.round((count / total) * 100) } })
  const peakDensity = zoneList.length ? Math.max(...zoneList.map((zone) => zone.density_per_sqm ?? 0)) : 0

  return <div className="bg-card border border-border rounded-xl p-5 h-[380px] animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100"><div className="mb-6"><h3 className="text-base font-semibold text-foreground">Zone Risk Breakdown</h3><p className="text-sm text-muted-foreground mt-0.5">Distribution by alert level</p></div><div className="space-y-5">{counts.map((config, index) => <div key={config.level} className="space-y-2"><div className="flex items-center justify-between"><span className="text-sm font-medium text-foreground">{config.label}</span><div className="flex items-center gap-2"><span className="text-sm text-muted-foreground">{config.count} zone{config.count !== 1 ? 's' : ''}</span><span className="text-sm font-semibold text-foreground">{config.pct}%</span></div></div><div className="h-2 bg-secondary rounded-full overflow-hidden"><div className={`h-full ${config.colorClass} rounded-full transition-all duration-1000 ease-out`} style={{ width: isLoaded ? `${config.pct}%` : '0%', transitionDelay: `${index * 150}ms` }} /></div></div>)}</div><div className="mt-6 pt-5 border-t border-border"><div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Peak Crowd Density</span><span className="text-xl font-bold text-foreground">{peakDensity > 0 ? `${peakDensity}/m²` : '—'}</span></div></div></div>
}
