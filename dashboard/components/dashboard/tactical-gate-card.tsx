'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { RISK_BADGE_CLASSES } from '@/lib/crowdshield/theme'
import type { RiskEvent, RiskLevel } from '@/lib/crowdshield/types'
import {
  Users,
  Gauge,
  Clock,
  DoorClosed,
  UserCheck,
  ArrowRightLeft,
  Megaphone,
  CheckCircle2,
  AlertTriangle,
  Radio,
} from 'lucide-react'

interface TacticalGateCardProps {
  zone: RiskEvent
  onDispatch: (zoneId: string, zoneName: string, action: string, label: string) => void
  isPriority?: boolean
}

export function TacticalGateCard({
  zone,
  onDispatch,
  isPriority = false,
}: TacticalGateCardProps) {
  const level = (zone.risk_level ?? 'low') as RiskLevel
  const riskScore = Math.round((zone.risk_score ?? 0) * 100)
  const isCritical = level === 'critical'
  const isHigh = level === 'high'

  const [activeActions, setActiveActions] = useState<Record<string, 'idle' | 'dispatched' | 'confirmed'>>({})

  const handleActionClick = (action: string, label: string) => {
    if (activeActions[action] === 'dispatched' || activeActions[action] === 'confirmed') return

    setActiveActions((prev) => ({ ...prev, [action]: 'dispatched' }))
    onDispatch(zone.zone_id, zone.zone_name, action, label)

    setTimeout(() => {
      setActiveActions((prev) => ({ ...prev, [action]: 'confirmed' }))
    }, 1200)

    setTimeout(() => {
      setActiveActions((prev) => ({ ...prev, [action]: 'idle' }))
    }, 6000)
  }

  const actions = [
    { id: 'reroute', label: 'Reroute Flow', icon: ArrowRightLeft, hoverClass: 'hover:border-emerald-500/50 hover:bg-emerald-500/10' },
    { id: 'staff', label: 'Deploy Staff', icon: UserCheck, hoverClass: 'hover:border-accent/50 hover:bg-accent/10' },
    { id: 'gate', label: 'Gate Control', icon: DoorClosed, hoverClass: 'hover:border-amber-500/50 hover:bg-amber-500/10' },
    { id: 'broadcast', label: 'PA Broadcast', icon: Megaphone, hoverClass: 'hover:border-cyan-500/50 hover:bg-cyan-500/10' },
  ]

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'relative bg-card border rounded-xl p-4 transition-all duration-200 select-none overflow-hidden',
        isCritical
          ? 'border-destructive/40 bg-destructive/[0.03] shadow-[0_0_24px_rgba(239,68,68,0.08)]'
          : isHigh
          ? 'border-amber-500/30 bg-amber-500/[0.02]'
          : 'border-border hover:border-border/80'
      )}
    >
      {/* Priority Threat Beacon */}
      {isPriority && (isCritical || isHigh) && (
        <div className="absolute top-0 right-0 left-0 h-[2px] bg-gradient-to-r from-transparent via-destructive to-transparent animate-pulse" />
      )}

      {/* Top Row: Zone Identifier & Badges */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'w-2 h-2 rounded-full',
              isCritical
                ? 'bg-destructive animate-pulse'
                : isHigh
                ? 'bg-amber-400 animate-pulse'
                : 'bg-accent'
            )}
          />
          <div>
            <div className="flex items-center gap-2">
              <h4
                className="text-sm font-bold text-foreground tracking-tight"
                style={{ fontFamily: "'Montserrat', sans-serif" }}
              >
                {zone.zone_name}
              </h4>
              <span className="text-[10px] font-medium text-muted-foreground uppercase px-1.5 py-0.2 rounded bg-secondary/80 border border-border">
                {zone.zone_id}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={cn(
              'text-[10px] font-bold uppercase px-2 py-0.5 rounded border',
              RISK_BADGE_CLASSES[level]
            )}
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            {level}
          </span>
          <span className="text-xs font-extrabold text-foreground" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            {riskScore}%
          </span>
        </div>
      </div>

      {/* Critical Warning Horizon Notice (If Applicable) */}
      {zone.eta_minutes !== null && zone.eta_minutes <= 10 && (isCritical || isHigh) && (
        <div className="mb-3 px-2.5 py-1.5 rounded-lg bg-destructive/10 border border-destructive/30 flex items-center justify-between text-xs text-destructive">
          <div className="flex items-center gap-1.5 font-semibold">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>Threshold breach forecast in {zone.eta_minutes}m</span>
          </div>
          <span className="text-[10px] uppercase font-extrabold tracking-wider animate-pulse" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            ACTION REQUIRED
          </span>
        </div>
      )}

      {/* Key Telemetry Metrics Grid */}
      <div className="grid grid-cols-3 gap-2 px-2 py-1.5 rounded-lg bg-secondary/80 border border-border/80 text-xs mb-2.5">
        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] font-bold text-muted-foreground flex items-center gap-1 uppercase" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            <Users className="w-3 h-3 text-primary" /> Density
          </span>
          <span className="font-extrabold text-foreground text-xs">
            {zone.density_per_sqm ? zone.density_per_sqm.toFixed(1) : '—'} <span className="text-[9px] font-normal text-muted-foreground">p/m²</span>
          </span>
        </div>

        <div className="flex flex-col gap-0.5 border-l border-border/60 pl-2">
          <span className="text-[9px] font-bold text-muted-foreground flex items-center gap-1 uppercase" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            <Gauge className="w-3 h-3 text-emerald-700" /> Velocity
          </span>
          <span className="font-extrabold text-foreground text-xs">
            {zone.flow_speed_mps ? zone.flow_speed_mps.toFixed(2) : '—'} <span className="text-[9px] font-normal text-muted-foreground">m/s</span>
          </span>
        </div>

        <div className="flex flex-col gap-0.5 border-l border-border/60 pl-2">
          <span className="text-[9px] font-bold text-muted-foreground flex items-center gap-1 uppercase" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            <Clock className="w-3 h-3 text-amber-700" /> Breach ETA
          </span>
          <span
            className={cn(
              'font-extrabold text-xs',
              zone.eta_minutes !== null && zone.eta_minutes <= 10
                ? 'text-destructive font-black'
                : 'text-foreground'
            )}
          >
            {zone.eta_minutes !== null ? `${zone.eta_minutes}m` : 'Nominal'}
          </span>
        </div>
      </div>

      {/* 1-Click Action Dispatch Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
        {actions.map((act) => {
          const Icon = act.icon
          const state = activeActions[act.id] ?? 'idle'

          return (
            <motion.button
              key={act.id}
              whileTap={{ scale: 0.96 }}
              onClick={() => handleActionClick(act.id, act.label)}
              className={cn(
                'flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-bold border transition-all duration-200 text-[11px]',
                state === 'dispatched'
                  ? 'bg-accent/20 border-accent text-accent shadow-[0_0_12px_rgba(0,214,143,0.2)]'
                  : state === 'confirmed'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : cn('bg-secondary/60 border-border text-muted-foreground hover:text-foreground', act.hoverClass)
              )}
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              {state === 'dispatched' ? (
                <>
                  <Radio className="w-3 h-3 animate-pulse text-accent" />
                  <span>Dispatching</span>
                </>
              ) : state === 'confirmed' ? (
                <>
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>Deployed</span>
                </>
              ) : (
                <>
                  <Icon className="w-3 h-3 text-muted-foreground group-hover:text-foreground" />
                  <span>{act.label}</span>
                </>
              )}
            </motion.button>
          )
        })}
      </div>
    </motion.div>
  )
}
