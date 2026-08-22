'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { cn } from '@/lib/utils'
import { useCrowdShield } from '@/lib/crowdshield/context'
import { ZoneInterventionCard } from '@/components/dashboard/map/zone-intervention-card'
import { Radio, Wifi, WifiOff, RefreshCw } from 'lucide-react'

const LeafletMap = dynamic(() => import('@/components/dashboard/map/leaflet-map').then(m => m.LeafletMap), { ssr: false, loading: () => <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground animate-pulse rounded-xl bg-secondary/20">Loading map…</div> })
const STATUS_CONFIG = { connected: { icon: Wifi, label: 'Connected', dot: 'bg-success' }, connecting: { icon: RefreshCw, label: 'Connecting…', dot: 'bg-warning' }, disconnected: { icon: WifiOff, label: 'Disconnected', dot: 'bg-destructive' } }

export function LiveMapSection() {
  const { events, connectionStatus, totalEvents, reconnectCount, simulateEvent, reconnect } = useCrowdShield()
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)
  const zoneList = Array.from(events.values()).sort((a, b) => b.risk_score - a.risk_score)
  const status = STATUS_CONFIG[connectionStatus]
  const StatusIcon = status.icon
  return <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <div className="flex items-center justify-between flex-wrap gap-3"><div className={cn('flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold', connectionStatus === 'connected' ? 'bg-success/10 border-success/30 text-success' : connectionStatus === 'connecting' ? 'bg-warning/10 border-warning/30 text-warning' : 'bg-destructive/10 border-destructive/30 text-destructive')}><span className={cn('w-2 h-2 rounded-full animate-pulse', status.dot)} /><StatusIcon className="w-3.5 h-3.5" /><span>{status.label}</span><span className="text-muted-foreground border-l border-current/30 pl-2 font-mono">ws://localhost:8000</span></div><div className="flex items-center gap-2"><span className="text-xs text-muted-foreground font-mono">{totalEvents} events · {zoneList.length} zones</span>{connectionStatus === 'disconnected' && <button onClick={reconnect} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-secondary border border-border text-muted-foreground hover:text-foreground"><RefreshCw className="w-3.5 h-3.5" /> Retry</button>}<button onClick={simulateEvent} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-accent text-accent-foreground hover:bg-accent/90"><Radio className="w-3.5 h-3.5" /> Simulate</button></div></div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4"><div className="lg:col-span-2 bg-card border border-border rounded-xl p-4 h-[620px] flex flex-col"><div className="flex items-center justify-between mb-3"><div><h3 className="text-base font-semibold text-foreground">Spatial Risk Heatmap</h3><p className="text-sm text-muted-foreground mt-0.5">Live GPS telemetry · click a zone for details</p></div><div className="flex items-center gap-3 text-xs">{[['#22c55e','Low'],['#eab308','Medium'],['#f97316','High'],['#ef4444','Critical']].map(([color,label]) => <span key={label} className="flex items-center gap-1.5 text-muted-foreground"><span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />{label}</span>)}</div></div><div className="flex-1 rounded-lg overflow-hidden min-h-0"><LeafletMap events={events} onZoneClick={setSelectedZoneId} selectedZoneId={selectedZoneId} /></div></div><div className="bg-card border border-border rounded-xl p-4 h-[620px] flex flex-col"><div className="flex items-center justify-between mb-3"><h3 className="text-base font-semibold text-foreground">Zone Command</h3><span className="text-xs text-muted-foreground font-mono">{zoneList.length} zones</span></div>{zoneList.length === 0 ? <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground animate-pulse">Awaiting telemetry…</div> : <div className="flex-1 overflow-y-auto space-y-3 pr-1">{zoneList.map(zone => <ZoneInterventionCard key={zone.zone_id} zone={zone} isSelected={selectedZoneId === zone.zone_id} onClick={() => setSelectedZoneId(selectedZoneId === zone.zone_id ? null : zone.zone_id)} />)}</div>}</div></div>
  </div>
}
