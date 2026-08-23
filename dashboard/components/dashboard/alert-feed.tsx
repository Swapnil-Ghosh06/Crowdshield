'use client'

import { cn } from '@/lib/utils'
import { useCrowdShield } from '@/lib/crowdshield/context'
import { ZONES } from '@/lib/crowdshield/zones'
import { ShieldAlert, AlertTriangle, Info, CheckCircle2 } from 'lucide-react'
import { RISK_BADGE_CLASSES } from '@/lib/crowdshield/theme'
import type { RiskLevel } from '@/lib/crowdshield/types'

const LEVEL_ICON = {
  critical: ShieldAlert,
  high: AlertTriangle,
  medium: Info,
  low: CheckCircle2,
}

function formatUtcTime(timestamp?: string) {
  if (!timestamp) return 'Live'
  try {
    const d = new Date(timestamp)
    if (isNaN(d.getTime())) return 'Live'
    return d.toISOString().slice(11, 19)
  } catch {
    return 'Live'
  }
}

export function AlertFeed() {
  const { events } = useCrowdShield()

  const alerts = ZONES.map((z) => events.get(z.id) ?? {
    zone_id: z.id,
    zone_name: z.name,
    timestamp: '',
    density_per_sqm: 1.5,
    flow_speed_mps: 1.1,
    risk_score: 0.25,
    risk_level: 'low' as RiskLevel,
    eta_minutes: null,
    recommendations: ['maintain_standard_flow'],
    announcement: { en: 'All areas clear.', hi: 'सभी क्षेत्र सुरक्षित हैं।' }
  }).sort((a, b) => b.risk_score - a.risk_score)

  return (
    <div className="bg-card border border-border rounded-xl p-5 animate-in fade-in duration-300">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-foreground" style={{ fontFamily: "'Montserrat', sans-serif" }}>Live Alert Feed</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Gates ranked by threat index</p>
        </div>
        <span className="text-xs text-muted-foreground font-semibold" style={{ fontFamily: "'Montserrat', sans-serif" }}>{alerts.length} gates active</span>
      </div>

      <div className="space-y-2.5">
        {alerts.map((zone) => {
          const level = zone.risk_level as RiskLevel
          const Icon = LEVEL_ICON[level] ?? Info
          const badgeCls = RISK_BADGE_CLASSES[level] ?? RISK_BADGE_CLASSES.none
          const time = formatUtcTime(zone.timestamp)

          return (
            <div
              key={zone.zone_id}
              className="group flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 border border-transparent transition-all duration-200 cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                  <Icon className="w-4 h-4 text-muted-foreground group-hover:text-accent" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground" style={{ fontFamily: "'Montserrat', sans-serif" }}>{zone.zone_name}</p>
                  <p className="text-[11px] text-muted-foreground font-medium mt-0.5" suppressHydrationWarning>
                    {zone.zone_id} · {time}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-extrabold text-foreground" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                  {zone.risk_score.toFixed(2)}
                </span>
                <div
                  className={cn(
                    'flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase',
                    badgeCls
                  )}
                  style={{ fontFamily: "'Montserrat', sans-serif" }}
                >
                  <Icon className="w-2.5 h-2.5" />
                  {level}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
