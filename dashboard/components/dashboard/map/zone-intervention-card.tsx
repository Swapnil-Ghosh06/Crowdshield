'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useCrowdShield } from '@/lib/crowdshield/context'
import { RISK_BADGE_CLASSES } from '@/lib/crowdshield/theme'
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
    window.setTimeout(() => setState('acknowledged'), 10000)
  }

  return (
    <button
      onClick={handleClick}
      disabled={state === 'acknowledged'}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-200',
        state === 'idle'
          ? 'bg-secondary border-border text-muted-foreground hover:text-foreground hover:border-accent/50 hover:bg-secondary/80'
          : state === 'confirmed'
          ? 'bg-success/10 border-success/30 text-success'
          : 'bg-secondary/50 border-border text-muted-foreground opacity-60 cursor-default'
      )}
    >
      {state === 'confirmed' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
      {state === 'idle' ? label : state === 'confirmed' ? 'Confirmed' : 'Acknowledged'}
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
  const level = zone.risk_level as RiskLevel
  const score = Math.round(zone.risk_score * 100)
  const isCritical = level === 'critical'
  const isHigh = level === 'high'
  const hasUrgentETA = zone.eta_minutes != null && zone.eta_minutes <= 10 && (isCritical || isHigh)

  const bar =
    level === 'critical'
      ? 'bg-destructive'
      : level === 'high'
      ? 'bg-orange-500'
      : level === 'medium'
      ? 'bg-warning'
      : 'bg-success'

  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-background border rounded-xl p-4 cursor-pointer transition-all duration-200 hover:border-accent/50 group',
        isSelected ? 'border-accent/70 ring-1 ring-accent/30' : 'border-border',
        isCritical && 'border-destructive/40 bg-destructive/5'
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <p className="text-xs font-mono text-muted-foreground mb-0.5">{zone.zone_id}</p>
          <p className="text-sm font-semibold text-foreground">{zone.zone_name}</p>
        </div>
        <div
          className={cn(
            'flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold uppercase',
            RISK_BADGE_CLASSES[level] ?? RISK_BADGE_CLASSES.none
          )}
        >
          <ShieldAlert className="w-3 h-3" />
          {level}
        </div>
      </div>

      {hasUrgentETA && (
        <div className="mb-3 p-2 rounded-lg bg-destructive/15 border border-destructive/40 text-xs flex items-center gap-2 text-destructive animate-pulse">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span className="font-semibold">
            Threshold breach forecast in {zone.eta_minutes} minute{zone.eta_minutes === 1 ? '' : 's'} — deploy protocols
          </span>
        </div>
      )}

      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-muted-foreground">Risk Score</span>
          <span className="font-mono font-bold text-foreground">{score}%</span>
        </div>
        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-700', bar)}
            style={{ width: `${score}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-0 rounded-lg overflow-hidden border border-border bg-secondary/30 mb-3">
        <div className="flex flex-col gap-0.5 p-2">
          <div className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
            <Users className="w-3 h-3" />
            Density
          </div>
          <span className="text-xs font-bold font-mono text-foreground">
            {zone.density_per_sqm}/m²
          </span>
        </div>
        <div className="flex flex-col gap-0.5 p-2 border-l border-border">
          <div className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
            <Gauge className="w-3 h-3" />
            Flow
          </div>
          <span className="text-xs font-bold font-mono text-foreground">
            {zone.flow_speed_mps}m/s
          </span>
        </div>
        <div className="flex flex-col gap-0.5 p-2 border-l border-border">
          <div className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
            <Clock className="w-3 h-3" />
            ETA
          </div>
          <span
            className={cn(
              'text-xs font-bold font-mono',
              hasUrgentETA ? 'text-destructive font-black' : 'text-foreground'
            )}
          >
            {zone.eta_minutes != null ? `${zone.eta_minutes}m` : '—'}
          </span>
        </div>
      </div>

      {zone.announcement && (
        <div className="mb-3 p-2.5 rounded-lg bg-secondary/40 border border-border text-xs space-y-1">
          <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
            <Megaphone className="w-3 h-3" /> Broadcast Announcement
          </div>
          <p className="text-foreground leading-snug">{zone.announcement.en}</p>
          <p className="text-muted-foreground leading-snug text-[11px]">{zone.announcement.hi}</p>
        </div>
      )}

      <div className="pt-2 border-t border-border">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
          Interventions
        </p>
        <div className="flex flex-wrap gap-1.5">
          <InterventionButton
            icon={DoorClosed}
            label="Close Gate"
            action={`close_gate_${zone.zone_id}`}
            zone={zone}
          />
          <InterventionButton
            icon={Megaphone}
            label="Broadcast"
            action={`broadcast_${zone.zone_id}`}
            zone={zone}
          />
          <InterventionButton
            icon={UserCheck}
            label="Deploy Staff"
            action={`deploy_staff_${zone.zone_id}`}
            zone={zone}
          />
          <InterventionButton
            icon={ArrowRightLeft}
            label="Reroute"
            action={`reroute_${zone.zone_id}`}
            zone={zone}
          />
        </div>
      </div>
    </div>
  )
}
