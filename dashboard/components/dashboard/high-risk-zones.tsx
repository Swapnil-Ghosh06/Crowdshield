'use client'

import { useCrowdShield } from '@/lib/crowdshield/context'
import { ZONES } from '@/lib/crowdshield/zones'
import { ShieldAlert, TrendingUp, Flame } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RISK_BADGE_CLASSES } from '@/lib/crowdshield/theme'
import type { RiskLevel } from '@/lib/crowdshield/types'

export function HighRiskZones() {
  const { events } = useCrowdShield()
  const ranked = ZONES.map((z) => events.get(z.id) ?? {
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
          <h3 className="text-sm font-semibold text-foreground">Highest Risk Zones</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Ranked by current threat score</p>
        </div>
        <Flame className="w-4 h-4 text-warning" />
      </div>

      <div className="space-y-2.5">
        {ranked.map((zone, index) => {
          const level = zone.risk_level as RiskLevel
          const badgeCls = RISK_BADGE_CLASSES[level] ?? RISK_BADGE_CLASSES.none
          const isCritical = level === 'critical'
          const isHigh = level === 'high'

          return (
            <div
              key={zone.zone_id}
              className={cn(
                'group flex items-center justify-between p-3 rounded-lg border transition-all duration-200 cursor-pointer',
                isCritical
                  ? 'bg-destructive/10 border-destructive/30'
                  : isHigh
                  ? 'bg-orange-500/10 border-orange-500/20'
                  : 'bg-secondary/30 border-transparent hover:bg-secondary/50'
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold font-mono',
                    isCritical
                      ? 'bg-destructive/20 text-destructive'
                      : isHigh
                      ? 'bg-orange-500/20 text-orange-400'
                      : 'bg-secondary text-muted-foreground'
                  )}
                >
                  {index + 1}
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">{zone.zone_name}</p>
                  <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                    {zone.density_per_sqm}/m² · Flow: {zone.flow_speed_mps}m/s
                    {zone.eta_minutes != null ? ` · ETA ${zone.eta_minutes}m` : ''}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <p className="text-xs font-semibold text-foreground font-mono">
                  {zone.risk_score.toFixed(2)}
                </p>
                <div
                  className={cn(
                    'flex items-center justify-end gap-1 text-[10px] font-bold uppercase mt-0.5 px-1.5 py-0.5 rounded',
                    badgeCls
                  )}
                >
                  <TrendingUp className="w-2.5 h-2.5" />
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
