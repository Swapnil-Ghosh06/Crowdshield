'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { RISK_BADGE_CLASSES } from '@/lib/crowdshield/theme'
import type { RiskEvent, RiskLevel } from '@/lib/crowdshield/types'
import {
  Users,
  Gauge,
  Clock,
  UserCheck,
  ArrowRightLeft,
  Megaphone,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Zap,
} from 'lucide-react'

interface GateMasterDetailConsoleProps {
  zoneList: RiskEvent[]
  history: Map<string, RiskEvent[]>
  onDispatch: (zoneId: string, zoneName: string, action: string, label: string) => void
}

export function GateMasterDetailConsole({
  zoneList,
  onDispatch,
}: GateMasterDetailConsoleProps) {
  const [activeActions, setActiveActions] = useState<
    Record<string, 'idle' | 'dispatched' | 'confirmed'>
  >({})

  const handleActionClick = (zone: RiskEvent, actionId: string, actionLabel: string) => {
    const key = `${zone.zone_id}-${actionId}`
    if (activeActions[key] === 'dispatched' || activeActions[key] === 'confirmed') return

    setActiveActions((prev) => ({ ...prev, [key]: 'dispatched' }))
    onDispatch(zone.zone_id, zone.zone_name, actionId, actionLabel)

    setTimeout(() => {
      setActiveActions((prev) => ({ ...prev, [key]: 'confirmed' }))
    }, 1000)

    setTimeout(() => {
      setActiveActions((prev) => ({ ...prev, [key]: 'idle' }))
    }, 5000)
  }

  return (
    <div className="bg-card border border-border/80 rounded-2xl p-4 sm:p-5 shadow-sm select-none">
      {/* ── COMPACT HEADER BAR ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 pb-3 mb-3 border-b border-border/60">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-accent/15 flex items-center justify-center text-accent">
            <Zap className="w-3.5 h-3.5" />
          </div>
          <h2
            className="text-xs sm:text-sm font-bold text-foreground tracking-tight"
            style={{ fontFamily: "'Ysabeau SC', sans-serif" }}
          >
            Sector Operations & Response Matrix
          </h2>
        </div>

        <span className="text-[10px] font-mono px-2 py-0.5 rounded-lg bg-secondary text-muted-foreground border border-border/60">
          {zoneList.length} MONITORED SECTORS
        </span>
      </div>

      {/* ── SLEEK COMPACT SECTOR ROWS ─────────────────────────────────── */}
      <div className="space-y-2">
        {zoneList.map((zone, index) => {
          const level = (zone.risk_level ?? 'low') as RiskLevel
          const isCritical = level === 'critical'
          const isHigh = level === 'high'
          const capacityPercent = Math.min(100, Math.round(((zone.density_per_sqm ?? 0) / 5.0) * 100))

          const actions = [
            { id: 'reroute', label: 'Reroute', icon: ArrowRightLeft },
            { id: 'staff', label: 'Deploy Staff', icon: UserCheck },
            { id: 'broadcast', label: 'PA Alert', icon: Megaphone },
          ]

          return (
            <motion.div
              key={zone.zone_id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: index * 0.04 }}
              className={cn(
                'flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3 rounded-xl border transition-all duration-200',
                isCritical
                  ? 'bg-destructive/[0.04] border-destructive/40 shadow-[0_0_12px_rgba(239,68,68,0.06)]'
                  : isHigh
                  ? 'bg-amber-500/[0.03] border-amber-500/30'
                  : 'bg-secondary/30 border-border/60 hover:border-border'
              )}
            >
              {/* Sector Name + Risk Badge + Alert Pill */}
              <div className="flex items-center gap-2.5 shrink-0 min-w-[210px]">
                <div
                  className={cn(
                    'w-7 h-7 rounded-lg flex items-center justify-center font-mono font-bold text-[11px] shrink-0',
                    isCritical
                      ? 'bg-destructive/20 text-destructive border border-destructive/40'
                      : isHigh
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                      : 'bg-secondary text-accent border border-border'
                  )}
                >
                  G{index + 1}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-xs sm:text-sm font-semibold text-foreground truncate">
                      {zone.zone_name}
                    </h3>
                    <span
                      className={cn(
                        'text-[9px] font-mono font-bold uppercase px-1.5 py-0.2 rounded border shrink-0',
                        RISK_BADGE_CLASSES[level]
                      )}
                    >
                      {level}
                    </span>
                  </div>
                  <p className="text-[10px] font-mono text-muted-foreground">
                    #{zone.zone_id.toUpperCase()}
                  </p>
                </div>
              </div>

              {/* Live Telemetry Inline (Density / Flow / Breach ETA) */}
              <div className="flex items-center gap-3 sm:gap-4 text-xs font-mono shrink-0">
                <div className="flex items-center gap-1">
                  <Users className="w-3 h-3 text-accent shrink-0" />
                  <span className="font-bold text-foreground">
                    {zone.density_per_sqm?.toFixed(1) ?? '—'}
                  </span>
                  <span className="text-[9px] text-muted-foreground">p/m²</span>
                </div>

                <span className="text-border">·</span>

                <div className="flex items-center gap-1">
                  <Gauge className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span className="font-bold text-foreground">
                    {zone.flow_speed_mps?.toFixed(2) ?? '—'}
                  </span>
                  <span className="text-[9px] text-muted-foreground">m/s</span>
                </div>

                <span className="text-border">·</span>

                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-400 shrink-0" />
                  <span
                    className={cn(
                      'font-bold',
                      zone.eta_minutes !== null && zone.eta_minutes <= 5
                        ? 'text-destructive font-black'
                        : 'text-foreground'
                    )}
                  >
                    {zone.eta_minutes !== null ? `${zone.eta_minutes}m` : 'Nominal'}
                  </span>
                </div>
              </div>

              {/* Compact Capacity Bar */}
              <div className="hidden xl:flex items-center gap-2 text-[10px] font-mono min-w-[120px] shrink-0">
                <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-300',
                      isCritical
                        ? 'bg-destructive'
                        : isHigh
                        ? 'bg-amber-400'
                        : 'bg-accent'
                    )}
                    style={{ width: `${capacityPercent}%` }}
                  />
                </div>
                <span className="text-muted-foreground">{capacityPercent}%</span>
              </div>

              {/* Compact 1-Click Action Buttons */}
              <div className="flex items-center gap-1.5 shrink-0 font-mono">
                {actions.map((act) => {
                  const Icon = act.icon
                  const key = `${zone.zone_id}-${act.id}`
                  const state = activeActions[key] ?? 'idle'

                  return (
                    <motion.button
                      key={act.id}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => handleActionClick(zone, act.id, act.label)}
                      className={cn(
                        'flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] font-semibold border transition-all duration-150 cursor-pointer whitespace-nowrap',
                        state === 'dispatched'
                          ? 'bg-accent/20 border-accent text-accent'
                          : state === 'confirmed'
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                          : 'bg-card/80 hover:bg-card border-border/80 hover:border-accent/40 text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {state === 'dispatched' ? (
                        <>
                          <Radio className="w-3 h-3 text-accent animate-pulse shrink-0" />
                          <span>Sending</span>
                        </>
                      ) : state === 'confirmed' ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span>Deployed</span>
                        </>
                      ) : (
                        <>
                          <Icon className="w-3 h-3 text-muted-foreground shrink-0" />
                          <span>{act.label}</span>
                        </>
                      )}
                    </motion.button>
                  )
                })}
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
