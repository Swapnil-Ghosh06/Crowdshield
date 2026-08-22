'use client'

import { useCrowdShield } from '@/lib/crowdshield/context'
import { ShieldAlert, TrendingUp, Flame } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RISK_BADGE_CLASSES } from '@/lib/crowdshield/theme'
import type { RiskLevel } from '@/lib/crowdshield/types'

export function HighRiskZones() {
  const { events } = useCrowdShield()
  const ranked = Array.from(events.values()).sort((a, b) => b.risk_score - a.risk_score).slice(0, 5)
  return <div className="bg-card border border-border rounded-xl p-5 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300"><div className="flex items-center justify-between mb-5"><div><h3 className="text-base font-semibold text-foreground">Highest Risk Zones</h3><p className="text-sm text-muted-foreground mt-0.5">Ranked by current threat score</p></div><Flame className="w-5 h-5 text-warning" /></div>{ranked.length === 0 ? <div className="py-10 text-center text-sm text-muted-foreground animate-pulse">Awaiting telemetry stream…</div> : <div className="space-y-3">{ranked.map((zone, index) => { const level = zone.risk_level as RiskLevel; const badgeCls = RISK_BADGE_CLASSES[level] ?? RISK_BADGE_CLASSES.none; const isCritical = level === 'critical'; const isHigh = level === 'high'; return <div key={zone.zone_id} className="group flex items-center justify-between p-3 rounded-lg hover:bg-secondary/50 transition-all duration-200 cursor-pointer animate-in fade-in slide-in-from-right-2" style={{ animationDelay: `${(index + 4) * 100}ms`, animationFillMode: 'both' }}><div className="flex items-center gap-3"><div className="relative"><div className={cn('w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold', isCritical ? 'bg-destructive/20 text-destructive' : isHigh ? 'bg-orange-500/20 text-orange-400' : 'bg-secondary text-muted-foreground')}>{index + 1}</div>{index < 2 && <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-warning flex items-center justify-center"><ShieldAlert className="w-2.5 h-2.5 text-background" /></div>}</div><div><p className="text-sm font-medium text-foreground">{zone.zone_name}</p><p className="text-xs text-muted-foreground">{zone.density_per_sqm}/m² · ETA {zone.eta_minutes}m</p></div></div><div className="text-right"><p className="text-sm font-semibold text-foreground font-mono">{zone.risk_score.toFixed(2)}</p><div className={cn('flex items-center justify-end gap-1 text-xs font-semibold uppercase mt-0.5 px-1.5 py-0.5 rounded', badgeCls)}><TrendingUp className="w-3 h-3" />{level}</div></div></div> })}</div>}</div>
}
