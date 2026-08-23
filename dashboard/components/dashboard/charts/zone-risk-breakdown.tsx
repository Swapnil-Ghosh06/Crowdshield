'use client'

import { motion } from 'framer-motion'
import { useCrowdShield } from '@/lib/crowdshield/context'
import { ZONES } from '@/lib/crowdshield/zones'
import { RISK_BADGE_CLASSES } from '@/lib/crowdshield/theme'
import type { RiskLevel } from '@/lib/crowdshield/types'
import { Gauge, Users, ShieldAlert, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ZoneRiskBreakdown() {
  const { events } = useCrowdShield()

  const zoneData = ZONES.map((z) => {
    const ev = events.get(z.id)
    return {
      id: z.id,
      name: z.name,
      density: ev?.density_per_sqm ?? 1.2,
      flow: ev?.flow_speed_mps ?? 1.1,
      riskScore: ev?.risk_score ?? 0.2,
      riskLevel: (ev?.risk_level ?? 'low') as RiskLevel,
    }
  })

  // Capacity benchmark: 5.0 p/m² is considered 100% capacity limit
  const maxCapacityLimit = 5.0
  const avgDensity =
    zoneData.reduce((acc, curr) => acc + curr.density, 0) / (zoneData.length || 1)
  const peakZone = [...zoneData].sort((a, b) => b.density - a.density)[0]

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="bg-card border border-border rounded-xl p-4 lg:p-5 flex flex-col justify-between select-none"
    >
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center text-accent">
              <Gauge className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3
                className="text-sm font-semibold text-foreground tracking-tight"
                style={{ fontFamily: "'Ysabeau SC', sans-serif" }}
              >
                Sector Pressure & Capacity
              </h3>
              <p className="text-[11px] text-muted-foreground font-mono">
                Crowd density vs 5.0 p/m² safety ceiling
              </p>
            </div>
          </div>

          <div className="text-right font-mono">
            <span className="text-[10px] text-muted-foreground uppercase">Avg Load</span>
            <p className="text-xs font-bold text-foreground">
              {avgDensity.toFixed(1)} <span className="text-[10px] text-muted-foreground font-normal">p/m²</span>
            </p>
          </div>
        </div>

        {/* Gate Capacity Bars */}
        <div className="space-y-3">
          {zoneData.map((zone) => {
            const loadPercent = Math.min(100, Math.round((zone.density / maxCapacityLimit) * 100))
            const isHigh = zone.riskLevel === 'high' || zone.riskLevel === 'critical'

            return (
              <div key={zone.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground text-[12px]">{zone.name}</span>
                    <span
                      className={cn(
                        'text-[9px] px-1.5 py-0.2 rounded font-bold uppercase',
                        RISK_BADGE_CLASSES[zone.riskLevel]
                      )}
                    >
                      {zone.riskLevel}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-muted-foreground text-[11px]">
                    <span>
                      <b className="text-foreground">{zone.density.toFixed(1)}</b> p/m²
                    </span>
                    <span className="text-muted-foreground/40">|</span>
                    <span>
                      <b className="text-foreground">{zone.flow.toFixed(2)}</b> m/s
                    </span>
                  </div>
                </div>

                {/* Progress track */}
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden relative">
                  {/* Danger threshold indicator at 70% */}
                  <div className="absolute top-0 bottom-0 left-[70%] w-[1px] bg-white/20 z-10" />

                  <motion.div
                    className={cn(
                      'h-full rounded-full transition-colors duration-500',
                      zone.riskLevel === 'critical'
                        ? 'bg-destructive'
                        : zone.riskLevel === 'high'
                        ? 'bg-amber-400'
                        : zone.riskLevel === 'medium'
                        ? 'bg-cyan-400'
                        : 'bg-emerald-400'
                    )}
                    initial={{ width: 0 }}
                    animate={{ width: `${loadPercent}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-[11px] font-mono">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Users className="w-3.5 h-3.5 text-accent" />
          <span>Peak Sector:</span>
          <span className="font-semibold text-foreground">{peakZone?.name ?? '—'}</span>
        </div>
        <span
          className={cn(
            'font-bold px-2 py-0.5 rounded text-[10px]',
            peakZone?.riskLevel === 'critical'
              ? 'bg-destructive/10 text-destructive'
              : peakZone?.riskLevel === 'high'
              ? 'bg-amber-500/10 text-amber-400'
              : 'bg-emerald-500/10 text-emerald-400'
          )}
        >
          {peakZone?.density.toFixed(1)} p/m² ({Math.min(100, Math.round(((peakZone?.density ?? 0) / maxCapacityLimit) * 100))}%)
        </span>
      </div>
    </motion.div>
  )
}
