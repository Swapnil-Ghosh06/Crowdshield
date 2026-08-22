'use client'

import { cn } from '@/lib/utils'
import { useCrowdShield } from '@/lib/crowdshield/context'
import { ShieldAlert, AlertTriangle, Info, CheckCircle2 } from 'lucide-react'
import { RISK_BADGE_CLASSES } from '@/lib/crowdshield/theme'
import type { RiskLevel } from '@/lib/crowdshield/types'

const LEVEL_ICON = { critical: ShieldAlert, high: AlertTriangle, medium: Info, low: CheckCircle2 }

export function AlertFeed() {
  const { events } = useCrowdShield()
  const alerts = Array.from(events.values()).sort((a, b) => b.risk_score - a.risk_score).slice(0, 5)
  return <div className="bg-card border border-border rounded-xl p-5 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200"><div className="flex items-center justify-between mb-5"><div><h3 className="text-base font-semibold text-foreground">Live Alert Feed</h3><p className="text-sm text-muted-foreground mt-0.5">Zones ranked by risk score</p></div><span className="text-xs text-muted-foreground font-mono">{alerts.length} active</span></div>{alerts.length === 0 ? <div className="py-10 text-center text-sm text-muted-foreground animate-pulse">Awaiting telemetry stream…</div> : <div className="space-y-3">{alerts.map((zone, index) => { const level = zone.risk_level as RiskLevel; const Icon = LEVEL_ICON[level] ?? Info; const badgeCls = RISK_BADGE_CLASSES[level] ?? RISK_BADGE_CLASSES.none; const time = zone.timestamp ? new Date(zone.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'; return <div key={zone.zone_id} className="group flex items-center justify-between p-3 rounded-lg hover:bg-secondary/50 transition-all duration-200 cursor-pointer animate-in fade-in slide-in-from-left-2" style={{ animationDelay: `${(index + 3) * 100}ms`, animationFillMode: 'both' }}><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center group-hover:bg-accent/10 transition-all duration-200"><Icon className="w-4 h-4 text-muted-foreground group-hover:text-accent" /></div><div><p className="text-sm font-medium text-foreground">{zone.zone_name}</p><p className="text-xs text-muted-foreground font-mono">{zone.zone_id} · {time}</p></div></div><div className="flex items-center gap-3"><span className="text-sm font-semibold text-foreground font-mono">{zone.risk_score.toFixed(2)}</span><div className={cn('flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold uppercase', badgeCls)}><Icon className="w-3 h-3" />{level}</div></div></div> })}</div>}</div>
}
