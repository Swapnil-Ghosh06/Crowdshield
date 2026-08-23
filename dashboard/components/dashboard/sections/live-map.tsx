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
  TrendingUp,
  Activity,
  Layers,
  ArrowRight
} from 'lucide-react'

const LeafletMap = dynamic(
  () => import('@/components/dashboard/map/leaflet-map').then((m) => m.LeafletMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground animate-pulse rounded-xl bg-secondary/20">
        Loading Tactical GIS Engine…
      </div>
    ),
  }
)

const STATUS_CONFIG = {
  connected: { icon: Wifi, label: 'Live Telemetry', dot: 'bg-emerald-500' },
  connecting: { icon: RefreshCw, label: 'Reconnecting…', dot: 'bg-amber-500' },
  disconnected: { icon: WifiOff, label: 'Telemetry Offline', dot: 'bg-destructive' },
}

export function LiveMapSection() {
  const { events, connectionStatus, totalEvents, reconnectCount, simulateEvent, reconnect, addIntervention } =
    useCrowdShield()
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)
  const zoneList = Array.from(events.values()).sort((a, b) => b.risk_score - a.risk_score)
  const status = STATUS_CONFIG[connectionStatus]
  const StatusIcon = status.icon

  // Compute TechNova High-Level Diagnostics
  const criticalZone = zoneList.find((z) => z.risk_level === 'critical' || z.risk_level === 'high')
  const avgDensity =
    zoneList.reduce((acc, z) => acc + (z.density_per_sqm ?? 0), 0) / (zoneList.length || 1)

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Top Telemetry & Control Bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold',
            connectionStatus === 'connected'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : connectionStatus === 'connecting'
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
              : 'bg-destructive/10 border-destructive/30 text-destructive'
          )}
        >
          <span className={cn('w-2 h-2 rounded-full animate-pulse', status.dot)} />
          <StatusIcon className="w-3.5 h-3.5" />
          <span>{status.label}</span>
          <span className="text-muted-foreground border-l border-current/30 pl-2 font-mono">
            ws://localhost:8000
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-mono">
            {totalEvents} events · {zoneList.length} monitored gates
          </span>
          {connectionStatus === 'disconnected' && (
            <button
              onClick={reconnect}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-secondary border border-border text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retry
            </button>
          )}
          <button
            onClick={simulateEvent}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-accent text-accent-foreground hover:bg-accent/90 transition-colors shadow-sm"
          >
            <Radio className="w-3.5 h-3.5 animate-pulse" /> Trigger Surge Simulation
          </button>
        </div>
      </div>

      {/* TechNova Quick Questions Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-card border border-border/80 rounded-xl p-3 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              Primary Bottleneck
            </span>
            <p className="text-xs font-bold text-foreground mt-0.5">
              {criticalZone ? criticalZone.zone_name : 'All Gates Operating Smoothly'}
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-accent">
            {criticalZone ? `${criticalZone.density_per_sqm} p/m²` : `${avgDensity.toFixed(1)} p/m²`}
          </span>
        </div>

        <div className="bg-card border border-border/80 rounded-xl p-3 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
              <Navigation className="w-3.5 h-3.5 text-emerald-400" />
              Safest Evacuation Route
            </span>
            <p className="text-xs font-bold text-emerald-400 mt-0.5">
              North-West & East Outer Exits
            </p>
          </div>
          <span className="text-xs font-mono text-muted-foreground">Clearance: 2.8m</span>
        </div>

        <div className="bg-card border border-border/80 rounded-xl p-3 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
              <Volume2 className="w-3.5 h-3.5 text-accent" />
              Automated PA Broadcast
            </span>
            <p className="text-xs font-bold text-foreground mt-0.5">
              4 Languages Live Streaming
            </p>
          </div>
          <span className="text-xs font-mono text-emerald-400 font-semibold">Active</span>
        </div>
      </div>

      {/* Main Map & Zone Command Center */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Tactical Leaflet Map */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-4 h-[640px] flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                Tactical GIS Crowd Map
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/15 text-accent font-mono border border-accent/20">
                  Vector Flow Active
                </span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Animated directional vectors · bottleneck indicators · green evacuation paths
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              {[
                ['#22c55e', 'Low'],
                ['#eab308', 'Medium'],
                ['#f97316', 'High'],
                ['#ef4444', 'Critical'],
              ].map(([color, label]) => (
                <span key={label} className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                  {label}
                </span>
              ))}
            </div>
          </div>
          <div className="flex-1 rounded-lg overflow-hidden min-h-0 border border-border/50">
            <LeafletMap
              events={events}
              onZoneClick={setSelectedZoneId}
              selectedZoneId={selectedZoneId}
            />
          </div>
        </div>

        {/* Zone Command & Interventions Panel */}
        <div className="bg-card border border-border rounded-xl p-4 h-[640px] flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-base font-semibold text-foreground">Zone Command</h3>
              <p className="text-xs text-muted-foreground">Click a gate to trigger instant interventions</p>
            </div>
            <span className="text-xs text-muted-foreground font-mono">{zoneList.length} monitored</span>
          </div>
          {zoneList.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground animate-pulse">
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
