'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { cn } from '@/lib/utils'
import { useCrowdShield } from '@/lib/crowdshield/context'
import { ZoneInterventionCard } from '@/components/dashboard/map/zone-intervention-card'
import {
  Radio,
  Wifi,
  WifiOff,
  RefreshCw,
  AlertTriangle,
  Navigation,
  Shield,
  Volume2,
  Activity,
  Layers,
  Sparkles,
  Zap,
  TrendingUp
} from 'lucide-react'

const LeafletMap = dynamic(
  () => import('@/components/dashboard/map/leaflet-map').then((m) => m.LeafletMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center text-xs font-mono text-muted-foreground animate-pulse rounded-2xl bg-secondary/30 border border-white/5">
        Initializing Tactical GIS Spatial Engine…
      </div>
    ),
  }
)

const STATUS_CONFIG = {
  connected: { icon: Wifi, label: 'Live Telemetry Stream', dot: 'bg-emerald-400' },
  connecting: { icon: RefreshCw, label: 'Connecting…', dot: 'bg-amber-400' },
  disconnected: { icon: WifiOff, label: 'Offline / Simulated', dot: 'bg-rose-400' },
}

export function LiveMapSection() {
  const { events, connectionStatus, totalEvents, triggerSurge, triggerMitigation, reconnect } =
    useCrowdShield()
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)
  const zoneList = Array.from(events.values()).sort((a, b) => (b.risk_score ?? 0) - (a.risk_score ?? 0))
  const status = STATUS_CONFIG[connectionStatus]
  const StatusIcon = status.icon

  // High-Level Diagnostics
  const criticalZone = zoneList.find((z) => z.risk_level === 'critical' || z.risk_level === 'high')
  const avgDensity =
    zoneList.reduce((acc, z) => acc + (z.density_per_sqm ?? 0), 0) / (zoneList.length || 1)
  const highestDensity = Math.max(...zoneList.map((z) => z.density_per_sqm ?? 0), 0)

  return (
    <div className="space-y-4 animate-in fade-in duration-300 select-none">
      {/* Top Telemetry & Control Bar */}
      <div className="glass-panel rounded-2xl px-4 py-3 flex items-center justify-between flex-wrap gap-3 border border-white/10">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-mono font-semibold',
              connectionStatus === 'connected'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : connectionStatus === 'connecting'
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            )}
          >
            <span className={cn('w-2 h-2 rounded-full animate-pulse', status.dot)} />
            <StatusIcon className="w-3.5 h-3.5" />
            <span>{status.label}</span>
          </div>

          <span className="text-xs font-mono text-muted-foreground hidden sm:inline">
            4 Gates Spatial Grid · {totalEvents} telemetry events
          </span>
        </div>

        <div className="flex items-center gap-2">
          {connectionStatus === 'disconnected' && (
            <button
              onClick={reconnect}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-semibold bg-white/5 border border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Reconnect
            </button>
          )}
          <button
            onClick={() => triggerSurge('gate_3')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-semibold bg-rose-500/15 border border-rose-500/30 text-rose-300 hover:bg-rose-500/25 transition-all cursor-pointer shadow-sm"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400 animate-pulse" /> Simulate Surge
          </button>
          <button
            onClick={() => triggerMitigation()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-semibold bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition-all cursor-pointer font-bold shadow-md"
          >
            <Zap className="w-3.5 h-3.5 text-slate-950" /> Auto Mitigate
          </button>
        </div>
      </div>

      {/* Quick Diagnostics Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="glass-card rounded-2xl p-3.5 border border-white/10 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              Primary Bottleneck Area
            </span>
            <p className="text-xs font-bold text-foreground mt-1">
              {criticalZone ? criticalZone.zone_name : 'All Gates Fluid & Clear'}
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs font-mono font-bold text-cyan-400 block">
              {criticalZone ? `${criticalZone.density_per_sqm} p/m²` : `${avgDensity.toFixed(1)} p/m²`}
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">
              {criticalZone ? 'Congestion Choke' : 'Nominal'}
            </span>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-3.5 border border-white/10 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
              <Navigation className="w-3.5 h-3.5 text-emerald-400" />
              Optimal Evacuation Corridor
            </span>
            <p className="text-xs font-bold text-emerald-400 mt-1">
              North-West & East Outer Plazas
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs font-mono text-emerald-300 font-bold block">100% Clear</span>
            <span className="text-[10px] font-mono text-muted-foreground">Clearance: 3.2m</span>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-3.5 border border-white/10 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
              Automated PA Broadcast System
            </span>
            <p className="text-xs font-bold text-foreground mt-1">
              English, Hindi, Bengali, Tamil
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs font-mono text-emerald-400 font-bold block">Active</span>
            <span className="text-[10px] font-mono text-muted-foreground">Synthesizer Online</span>
          </div>
        </div>
      </div>

      {/* Main Map & Zone Command Center */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Tactical GIS Map */}
        <div className="lg:col-span-2 glass-card border border-white/10 rounded-2xl p-4 h-[620px] flex flex-col">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/5">
            <div>
              <h3
                className="text-base font-bold text-foreground flex items-center gap-2"
                style={{ fontFamily: "'Ysabeau SC', sans-serif" }}
              >
                Tactical GIS Spatial Grid
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 font-mono border border-cyan-500/30">
                  Vector Flow Active
                </span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Real-time density heatmap · directional flow vectors · green safe egress corridors
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono">
              {[
                ['#22c55e', 'Low'],
                ['#eab308', 'Med'],
                ['#f97316', 'High'],
                ['#ef4444', 'Crit'],
              ].map(([color, label]) => (
                <span key={label} className="flex items-center gap-1 text-muted-foreground text-[11px]">
                  <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                  {label}
                </span>
              ))}
            </div>
          </div>
          <div className="flex-1 rounded-xl overflow-hidden min-h-0 border border-white/5">
            <LeafletMap
              events={events}
              onZoneClick={setSelectedZoneId}
              selectedZoneId={selectedZoneId}
            />
          </div>
        </div>

        {/* Zone Command Interventions Panel */}
        <div className="glass-card border border-white/10 rounded-2xl p-4 h-[620px] flex flex-col">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/5">
            <div>
              <h3
                className="text-base font-bold text-foreground"
                style={{ fontFamily: "'Ysabeau SC', sans-serif" }}
              >
                Zone Tactical Matrix
              </h3>
              <p className="text-xs text-muted-foreground font-mono">Click a sector to inspect & dispatch</p>
            </div>
            <span className="text-xs text-cyan-400 font-mono font-bold">{zoneList.length} Gates</span>
          </div>

          {zoneList.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-xs font-mono text-muted-foreground animate-pulse">
              Awaiting telemetry…
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {zoneList.map((zone) => (
                <ZoneInterventionCard
                  key={zone.zone_id}
                  zone={zone}
                  isSelected={selectedZoneId === zone.zone_id}
                  onClick={() =>
                    setSelectedZoneId(selectedZoneId === zone.zone_id ? null : zone.zone_id)
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
