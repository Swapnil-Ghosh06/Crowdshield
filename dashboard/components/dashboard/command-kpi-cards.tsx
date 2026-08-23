'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Users, ShieldAlert, Timer, ShieldCheck, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import type { RiskEvent } from '@/lib/crowdshield/types'

interface CommandKpiCardsProps {
  zoneList: RiskEvent[]
  activeInterventionsCount: number
  onSimulateSurge?: () => void
  onSimulateMitigate?: () => void
}

export function CommandKpiCards({
  zoneList,
  activeInterventionsCount,
  onSimulateSurge,
  onSimulateMitigate,
}: CommandKpiCardsProps) {
  const highestRiskZone = zoneList[0]
  const criticalCount = zoneList.filter((z) => z.risk_level === 'critical').length
  const highCount = zoneList.filter((z) => z.risk_level === 'high').length

  const validETAs = zoneList
    .map((z) => z.eta_minutes)
    .filter((eta): eta is number => eta !== null && eta > 0)
  const fastestETA = validETAs.length > 0 ? Math.min(...validETAs) : null

  const peakDensity =
    zoneList.length > 0 ? Math.max(...zoneList.map((z) => z.density_per_sqm ?? 0)) : 0

  // Bar heights for Card 1 sparkline
  const barHeights = [40, 65, 30, 85, 55, 95, 70, 80]

  // Wave points for Card 3 sparkline
  const wavePoints = [
    { x: 0, y: 35 },
    { x: 25, y: 30 },
    { x: 50, y: 25 },
    { x: 75, y: 15 },
    { x: 100, y: 18 },
    { x: 125, y: 10 },
    { x: 150, y: 6 },
  ]
  const pathD = `M 0 35 Q 35 32, 60 22 T 110 14 T 150 6`

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 select-none min-w-0">
      {/* ── CARD 1: PEAK CROWD DENSITY ── */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.05 }}
        whileHover={{ y: -2, transition: { duration: 0.15 } }}
        className="bg-card border border-border/80 hover:border-border rounded-2xl p-4 sm:p-5 flex flex-col justify-between relative overflow-hidden group shadow-sm min-w-0"
      >
        <div className="flex items-center justify-between mb-2 gap-2">
          <span className="text-[10px] sm:text-xs font-black text-muted-foreground uppercase tracking-wider truncate" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            Peak Density
          </span>
          <div className="w-8 h-8 rounded-xl bg-secondary/80 flex items-center justify-center text-muted-foreground group-hover:text-accent transition-colors shrink-0">
            <Users className="w-4 h-4" />
          </div>
        </div>

        <div className="my-1 min-w-0">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-foreground" style={{ fontFamily: "'Montserrat', sans-serif" }}>
              {peakDensity > 0 ? peakDensity.toFixed(1) : '0.0'}
            </span>
            <span className="text-xs text-muted-foreground font-semibold">p/m²</span>
          </div>

          <div className="flex items-center gap-1 mt-1 text-[10px] sm:text-xs flex-wrap">
            <span
              className={cn(
                'inline-flex items-center gap-0.5 font-bold shrink-0',
                peakDensity > 4.0 ? 'text-destructive' : peakDensity > 2.5 ? 'text-amber-400' : 'text-emerald-400'
              )}
            >
              {peakDensity > 3.0 ? (
                <ArrowUpRight className="w-3.5 h-3.5" />
              ) : (
                <ArrowDownRight className="w-3.5 h-3.5" />
              )}
              {peakDensity > 4.0 ? '+24% surge' : '+8% normal'}
            </span>
            <span className="text-muted-foreground/60 text-[10px] sm:text-[11px] truncate font-medium">vs baseline</span>
          </div>
        </div>

        {/* Embedded Mini Bar Sparkline */}
        <div className="mt-4 pt-3 border-t border-border/50 flex items-end justify-between gap-1.5 h-10">
          {barHeights.map((height, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${height}%` }}
                transition={{ duration: 0.5, delay: i * 0.05, ease: 'easeOut' }}
                className={cn(
                  'w-full rounded-sm transition-colors',
                  i === barHeights.length - 1
                    ? 'bg-accent shadow-[0_0_8px_rgba(0,214,143,0.4)]'
                    : 'bg-secondary hover:bg-secondary-foreground/20'
                )}
              />
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── CARD 2: PRIMARY THREAT SECTOR (FLUID & RESPONSIVE) ────────── */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
        whileHover={{ y: -2, transition: { duration: 0.15 } }}
        className="bg-card border border-border/80 hover:border-border rounded-2xl p-4 sm:p-5 flex flex-col justify-between relative overflow-hidden group shadow-sm min-w-0"
      >
        <div className="flex items-center justify-between mb-2 gap-2">
          <span className="text-[10px] sm:text-xs font-black text-muted-foreground uppercase tracking-wider truncate" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            Primary Threat Sector
          </span>
          <div
            className={cn(
              'w-8 h-8 rounded-xl flex items-center justify-center transition-colors shrink-0',
              criticalCount > 0
                ? 'bg-destructive/15 text-destructive'
                : highCount > 0
                ? 'bg-amber-500/15 text-amber-400'
                : 'bg-secondary/80 text-accent'
            )}
          >
            <ShieldAlert className="w-4 h-4" />
          </div>
        </div>

        <div className="my-1 min-w-0">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <span
              className="text-sm sm:text-base lg:text-lg xl:text-xl font-extrabold tracking-tight text-foreground truncate min-w-0 flex-1"
              style={{ fontFamily: "'Montserrat', sans-serif" }}
              title={highestRiskZone?.zone_name}
            >
              {highestRiskZone ? highestRiskZone.zone_name : 'All Normal'}
            </span>
            <span
              className={cn(
                'text-[9px] sm:text-[10px] font-bold uppercase px-1.5 sm:px-2 py-0.5 rounded border shrink-0',
                highestRiskZone?.risk_level === 'critical'
                  ? 'bg-destructive/15 border-destructive/40 text-destructive'
                  : highestRiskZone?.risk_level === 'high'
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                  : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
              )}
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              {highestRiskZone?.risk_level ?? 'LOW'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 mt-1.5 text-[10px] sm:text-xs text-muted-foreground flex-wrap font-medium">
            <span>Threat:</span>
            <span className="font-extrabold text-foreground">
              {highestRiskZone ? `${(highestRiskZone.risk_score * 100).toFixed(0)}%` : '0%'}
            </span>
            <span className="text-muted-foreground/40">·</span>
            <span>Flow: {highestRiskZone?.flow_speed_mps ?? 1.2} m/s</span>
          </div>
        </div>

        {/* Mini Risk Arc / Progress Gauge */}
        <div className="mt-4 pt-3 border-t border-border/50">
          <div className="flex items-center justify-between text-[10px] sm:text-[11px] mb-1 text-muted-foreground font-semibold">
            <span>Sector Capacity</span>
            <span className="font-extrabold text-foreground">
              {highestRiskZone ? Math.min(100, Math.round(((highestRiskZone.density_per_sqm ?? 0) / 5.0) * 100)) : 20}%
            </span>
          </div>
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{
                width: `${highestRiskZone ? Math.min(100, ((highestRiskZone.density_per_sqm ?? 0) / 5.0) * 100) : 20}%`,
              }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className={cn(
                'h-full rounded-full transition-colors',
                highestRiskZone?.risk_level === 'critical'
                  ? 'bg-destructive'
                  : highestRiskZone?.risk_level === 'high'
                  ? 'bg-amber-400'
                  : 'bg-accent'
              )}
            />
          </div>
        </div>
      </motion.div>

      {/* ── CARD 3: SAFETY BREACH HORIZON ── */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.15 }}
        whileHover={{ y: -2, transition: { duration: 0.15 } }}
        className="bg-card border border-border/80 hover:border-border rounded-2xl p-4 sm:p-5 flex flex-col justify-between relative overflow-hidden group shadow-sm min-w-0"
      >
        <div className="flex items-center justify-between mb-2 gap-2">
          <span className="text-[10px] sm:text-xs font-black text-muted-foreground uppercase tracking-wider truncate" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            Safety Horizon (ETA)
          </span>
          <div className="w-8 h-8 rounded-xl bg-secondary/80 flex items-center justify-center text-muted-foreground group-hover:text-accent transition-colors shrink-0">
            <Timer className="w-4 h-4" />
          </div>
        </div>

        <div className="my-1 min-w-0">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span
              className={cn(
                'text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight',
                fastestETA !== null && fastestETA <= 5
                  ? 'text-destructive font-black'
                  : fastestETA !== null
                  ? 'text-amber-600 font-extrabold'
                  : 'text-foreground'
              )}
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              {fastestETA !== null ? `${fastestETA}m` : 'Nominal'}
            </span>
            {fastestETA !== null && (
              <span className="text-xs font-semibold text-muted-foreground">mins</span>
            )}
          </div>

          <div className="flex items-center gap-1 mt-1 text-[10px] sm:text-xs font-semibold text-muted-foreground flex-wrap">
            {fastestETA !== null && fastestETA <= 5 ? (
              <span className="text-destructive font-bold">Critical window</span>
            ) : (
              <span className="text-emerald-700 font-bold">No breach projected</span>
            )}
            <span className="text-muted-foreground/40">·</span>
            <span className="font-semibold text-muted-foreground">0.70 ceiling</span>
          </div>
        </div>

        {/* Embedded Smooth Wave Sparkline */}
        <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between h-10 relative">
          <svg className="w-full h-full overflow-visible" viewBox="0 0 150 40">
            <motion.path
              d={pathD}
              fill="none"
              stroke="#00d68f"
              strokeWidth="2"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1, ease: 'easeInOut' }}
            />
            {wavePoints.map((pt, idx) => (
              <circle
                key={idx}
                cx={pt.x}
                cy={pt.y}
                r={idx === wavePoints.length - 1 ? '3.5' : '2'}
                className={idx === wavePoints.length - 1 ? 'fill-accent' : 'fill-accent/40'}
              />
            ))}
          </svg>
        </div>
      </motion.div>

      {/* ── CARD 4: ACTIVE PROTOCOLS & INSTANT DISPATCH CHIPS ── */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.2 }}
        whileHover={{ y: -2, transition: { duration: 0.15 } }}
        className="bg-card border border-border/80 hover:border-border rounded-2xl p-4 sm:p-5 flex flex-col justify-between relative overflow-hidden group shadow-sm min-w-0"
      >
        <div className="flex items-center justify-between mb-2 gap-2">
          <span className="text-[10px] sm:text-xs font-black text-muted-foreground uppercase tracking-wider truncate" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            Safety Protocols
          </span>
          <div className="w-8 h-8 rounded-xl bg-accent/15 text-accent flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
        </div>

        <div className="my-1 min-w-0">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-foreground" style={{ fontFamily: "'Montserrat', sans-serif" }}>
              {activeInterventionsCount}
            </span>
            <span className="text-[10px] sm:text-xs text-emerald-600 font-extrabold" style={{ fontFamily: "'Montserrat', sans-serif" }}>Active Deployed</span>
          </div>

          <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 truncate font-medium">
            Pipeline: <b className="text-foreground">Autonomous AI</b>
          </p>
        </div>

        {/* Mini Protocol Chips */}
        <div className="mt-4 pt-3 border-t border-border/50 flex items-center gap-1.5">
          <button
            onClick={onSimulateSurge}
            className="flex-1 py-1.5 px-1.5 sm:px-2 rounded-lg bg-secondary/80 hover:bg-destructive/15 border border-border hover:border-destructive/30 text-[10px] sm:text-[11px] font-bold text-muted-foreground hover:text-destructive transition-all cursor-pointer text-center truncate"
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            Simulate Surge
          </button>
          <button
            onClick={onSimulateMitigate}
            className="flex-1 py-1.5 px-1.5 sm:px-2 rounded-lg bg-secondary/80 hover:bg-accent/15 border border-border hover:border-accent/30 text-[10px] sm:text-[11px] font-bold text-muted-foreground hover:text-accent transition-all cursor-pointer text-center truncate"
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            Auto Mitigate
          </button>
        </div>
      </motion.div>
    </div>
  )
}
