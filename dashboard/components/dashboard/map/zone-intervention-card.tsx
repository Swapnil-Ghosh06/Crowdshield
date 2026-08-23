'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useCrowdShield } from '@/lib/crowdshield/context'
import { RISK_BADGE_CLASSES, getRiskColor } from '@/lib/crowdshield/theme'
import type { RiskEvent, RiskLevel } from '@/lib/crowdshield/types'
import {
  ShieldAlert,
  Users,
  Gauge,
  Clock,
  Megaphone,
  DoorClosed,
  UserCheck,
  ArrowRightLeft,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Sparkles
} from 'lucide-react'

function InterventionButton({
  icon: Icon,
  label,
  action,
  zone,
}: {
  icon: React.ElementType
  label: string
  action: string
  zone: RiskEvent
}) {
  const { addIntervention } = useCrowdShield()
  const [state, setState] = useState<'idle' | 'confirmed' | 'acknowledged'>('idle')

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (state !== 'idle') return
    setState('confirmed')
    addIntervention({ zone_id: zone.zone_id, zone_name: zone.zone_name, action, label })
    window.setTimeout(() => setState('acknowledged'), 6000)
    window.setTimeout(() => setState('idle'), 12000)
  }

  return (
    <button
      onClick={handleClick}
      disabled={state === 'acknowledged'}
      className={cn(
        'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all duration-200 cursor-pointer',
        state === 'idle'
          ? 'bg-white/5 border-white/10 text-muted-foreground hover:text-cyan-300 hover:border-cyan-500/40 hover:bg-cyan-500/10'
          : state === 'confirmed'
          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-sm'
          : 'bg-white/5 border-white/5 text-muted-foreground/60 cursor-default'
      )}
      style={{ fontFamily: "'Montserrat', sans-serif" }}
    >
      {state === 'confirmed' ? (
        <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
      ) : (
        <Icon className="w-3 h-3 shrink-0" />
      )}
      <span>{state === 'idle' ? label : state === 'confirmed' ? 'Dispatched' : 'Active'}</span>
    </button>
  )
}

export function ZoneInterventionCard({
  zone,
  isSelected,
  onClick,
}: {
  zone: RiskEvent
  isSelected: boolean
  onClick: () => void
}) {
  const level = (zone.risk_level ?? 'low') as RiskLevel
  const score = Math.round((zone.risk_score ?? 0.2) * 100)
  const isCritical = level === 'critical'
  const isHigh = level === 'high'
  const hasUrgentETA = zone.eta_minutes != null && zone.eta_minutes <= 10 && (isCritical || isHigh)
  const color = getRiskColor(level)

  return (
    <div
      onClick={onClick}
      className={cn(
        'glass-card rounded-2xl p-4 cursor-pointer transition-all duration-300 border relative overflow-hidden select-none',
        isSelected
          ? 'border-primary bg-accent/10 shadow-md ring-1 ring-primary/30'
          : isCritical
          ? 'border-rose-500/40 bg-rose-500/10 hover:border-rose-500/60'
          : 'border-border hover:border-primary/40'
      )}
    >
      {/* Top Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: color }}
            />
            <h4
              className="text-sm font-bold text-foreground tracking-tight"
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              {zone.zone_name}
            </h4>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">{zone.zone_id}</p>
        </div>
        <div
          className={cn(
            'flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border',
            RISK_BADGE_CLASSES[level]
          )}
          style={{ fontFamily: "'Montserrat', sans-serif" }}
        >
          <ShieldAlert className="w-2.5 h-2.5" />
          {level}
        </div>
      </div>

      {/* Critical Early Warning Forecast Banner */}
      {hasUrgentETA && (
        <div className="mb-3 p-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs flex items-center gap-2 text-rose-700 animate-pulse">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
          <span className="text-[11px] font-semibold">
            Surge breach in {zone.eta_minutes}m — AI recommends gate release
          </span>
        </div>
      )}

      {/* Risk Progress Bar */}
      <div className="mb-3">
        <div className="flex justify-between text-[11px] mb-1">
          <span className="text-muted-foreground font-medium">Threat Factor</span>
          <span className="font-extrabold text-foreground" style={{ color, fontFamily: "'Montserrat', sans-serif" }}>
            {score}%
          </span>
        </div>
        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${score}%`, backgroundColor: color }}
          />
        </div>
      </div>

      {/* Metrics Strip */}
      <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-border bg-secondary/50 p-2 mb-3 text-xs">
        <div className="flex flex-col">
          <span className="text-[9px] text-muted-foreground uppercase flex items-center gap-1">
            <Users className="w-2.5 h-2.5 text-primary" /> Density
          </span>
          <span className="font-bold text-foreground mt-0.5">
            {(zone.density_per_sqm ?? 0).toFixed(1)} p/m²
          </span>
        </div>
        <div className="flex flex-col border-l border-border pl-2">
          <span className="text-[9px] text-muted-foreground uppercase flex items-center gap-1">
            <Gauge className="w-2.5 h-2.5 text-emerald-600" /> Flow
          </span>
          <span className="font-bold text-foreground mt-0.5">
            {(zone.flow_speed_mps ?? 1.2).toFixed(1)} m/s
          </span>
        </div>
        <div className="flex flex-col border-l border-border pl-2">
          <span className="text-[9px] text-muted-foreground uppercase flex items-center gap-1">
            <Clock className="w-2.5 h-2.5 text-amber-600" /> ETA
          </span>
          <span
            className={cn(
              'font-bold mt-0.5',
              hasUrgentETA ? 'text-rose-600' : 'text-foreground'
            )}
          >
            {zone.eta_minutes != null ? `${zone.eta_minutes}m` : 'Nominal'}
          </span>
        </div>
      </div>

      {/* Live PA Announcement Preview */}
      {zone.announcement && (
        <div className="mb-3 p-2 rounded-xl bg-secondary/80 border border-border text-[11px] space-y-0.5 font-mono">
          <div className="flex items-center gap-1 text-[9px] font-bold text-primary uppercase tracking-wider">
            <Radio className="w-2.5 h-2.5 animate-pulse" /> Live PA Stream
          </div>
          <p className="text-foreground text-[11px] leading-tight truncate">{zone.announcement.en}</p>
        </div>
      )}

      {/* Tactical Interventions Matrix */}
      <div className="pt-2 border-t border-white/5">
        <div className="flex flex-wrap gap-1.5">
          <InterventionButton
            icon={DoorClosed}
            label="Pulse Gate"
            action={`pulse_gate_${zone.zone_id}`}
            zone={zone}
          />
          <InterventionButton
            icon={Megaphone}
            label="PA Broadcast"
            action={`broadcast_${zone.zone_id}`}
            zone={zone}
          />
          <InterventionButton
            icon={UserCheck}
            label="Deploy Marshals"
            action={`deploy_staff_${zone.zone_id}`}
            zone={zone}
          />
          <InterventionButton
            icon={ArrowRightLeft}
            label="Reroute Flow"
            action={`reroute_${zone.zone_id}`}
            zone={zone}
          />
        </div>
      </div>
    </div>
  )
}
