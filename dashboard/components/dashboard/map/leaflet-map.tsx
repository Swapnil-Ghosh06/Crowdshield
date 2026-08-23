'use client'

import { useEffect, useRef, useState } from 'react'
import type { RiskEvent } from '@/lib/crowdshield/types'
import { ZONES } from '@/lib/crowdshield/zones'
import { getRiskColor, RISK_COLORS } from '@/lib/crowdshield/theme'
import { Layers, Navigation, Activity, ShieldAlert, Users, Gauge, Clock, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LeafletMapProps {
  events: Map<string, RiskEvent>
  onZoneClick: (zoneId: string) => void
  selectedZoneId: string | null
}

// Coordinate links between gates and central hub
const PATH_COORDS: { from: string; to: string; coords: [number, number][] }[] = [
  { from: 'gate_1', to: 'gate_2', coords: [[28.6135, 77.2090], [28.6147, 77.2075]] },
  { from: 'gate_1', to: 'gate_4', coords: [[28.6135, 77.2090], [28.6142, 77.2108]] },
  { from: 'gate_2', to: 'gate_3', coords: [[28.6147, 77.2075], [28.6158, 77.2090]] },
  { from: 'gate_4', to: 'gate_3', coords: [[28.6142, 77.2108], [28.6158, 77.2090]] },
]

// Designated Evacuation Paths (Green Safe Routes)
const EVACUATION_ROUTES: [number, number][][] = [
  [[28.6147, 77.2075], [28.6160, 77.2065], [28.6172, 77.2055]], // West -> NW Exit
  [[28.6142, 77.2108], [28.6155, 77.2125], [28.6168, 77.2140]], // East -> Outer Plaza Exit
]

export function LeafletMap({ events, onZoneClick, selectedZoneId }: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<Map<string, any>>(new Map())
  const heatRef = useRef<any>(null)
  const vectorPolylinesRef = useRef<any[]>([])
  const evacuationPolylinesRef = useRef<any[]>([])

  // Layer Toggles
  const [showHeat, setShowHeat] = useState(true)
  const [showVectors, setShowVectors] = useState(true)
  const [showEvacRoutes, setShowEvacRoutes] = useState(true)

  const selectedEvent = selectedZoneId ? events.get(selectedZoneId) : null
  const selectedZone = selectedZoneId ? ZONES.find((z) => z.id === selectedZoneId) : null

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    let disposed = false

    const initMap = async () => {
      const L = (await import('leaflet')).default
      await import('leaflet.heat')
      if (disposed || !containerRef.current) return

      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      // Set initial view centered nicely over venue area with comfortable zoom
      const map = L.map(containerRef.current, {
        center: [28.6147, 77.2090],
        zoom: 16,
        scrollWheelZoom: true,
        zoomControl: false,
      })

      // Add Zoom Control at bottom right
      L.control.zoom({ position: 'bottomright' }).addTo(map)

      // Dark CartoDB Tile Layer
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap © CartoDB',
        maxZoom: 19,
      }).addTo(map)

      mapRef.current = map

      // 1. Render Zone Markers with Sleek Custom Pulse Icons (NO overlapping big boxes!)
      ZONES.forEach((zone) => {
        const ev = events.get(zone.id)
        const color = getRiskColor(ev?.risk_level)
        const score = Math.round((ev?.risk_score ?? 0.2) * 100)

        const customIcon = L.divIcon({
          className: 'custom-gis-marker',
          html: `
            <div class="marker-wrapper" id="marker-${zone.id}">
              <div class="radar-ping" style="border-color: ${color}; background-color: ${color}20;"></div>
              <div class="marker-pin" style="background: ${color}; box-shadow: 0 0 16px ${color};">
                <span class="marker-score">${score}%</span>
              </div>
              <div class="marker-tag">
                <span class="tag-text">${zone.name.split(' ')[0]}</span>
              </div>
            </div>
          `,
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        })

        const marker = L.marker(zone.coords, { icon: customIcon }).addTo(map)

        // Interactive hover popup (clean, non-overlapping)
        marker.bindTooltip(
          `<div class="sleek-map-popup">
            <div class="font-bold text-foreground text-xs">${zone.name}</div>
            <div class="text-[10px] text-cyan-400 font-mono mt-0.5">${zone.id} · ${(ev?.density_per_sqm ?? 0).toFixed(1)} p/m²</div>
            <div class="text-[10px] text-muted-foreground mt-0.5">Flow: ${(ev?.flow_speed_mps ?? 1.2).toFixed(1)} m/s · Threat: ${score}%</div>
          </div>`,
          { permanent: false, direction: 'top', offset: [0, -22], className: 'custom-leaflet-tooltip' }
        )

        marker.on('click', () => {
          onZoneClick(zone.id)
          map.flyTo(zone.coords, 16.5, { duration: 0.6 })
        })

        markersRef.current.set(zone.id, marker)
      })

      // 2. Render Animated Directional Vector Polylines
      PATH_COORDS.forEach((path) => {
        const polyline = L.polyline(path.coords, {
          color: '#00f0ff',
          weight: 3.5,
          dashArray: '8, 8',
          opacity: 0.75,
          className: 'animated-flow-vector',
        }).addTo(map)
        vectorPolylinesRef.current.push(polyline)
      })

      // 3. Render Evacuation Safe Corridors
      EVACUATION_ROUTES.forEach((route) => {
        const evacLine = L.polyline(route, {
          color: '#22c55e',
          weight: 4.5,
          dashArray: '10, 6',
          opacity: 0.85,
          className: 'animated-evac-route',
        }).addTo(map)
        evacuationPolylinesRef.current.push(evacLine)
      })

      // 4. Initial Heatmap
      heatRef.current = updateHeatmap(L, map, events)
    }

    initMap()

    return () => {
      disposed = true
      mapRef.current?.remove()
      mapRef.current = null
      markersRef.current.clear()
      vectorPolylinesRef.current = []
      evacuationPolylinesRef.current = []
      heatRef.current = null
    }
  }, [])

  // Update Markers and Heatmap dynamically on new telemetry
  useEffect(() => {
    if (!mapRef.current) return
    const update = async () => {
      const L = (await import('leaflet')).default

      ZONES.forEach((zone) => {
        const marker = markersRef.current.get(zone.id)
        const ev = events.get(zone.id)
        const color = getRiskColor(ev?.risk_level)
        const score = Math.round((ev?.risk_score ?? 0.2) * 100)
        const isSelected = selectedZoneId === zone.id

        if (marker) {
          const customIcon = L.divIcon({
            className: 'custom-gis-marker',
            html: `
              <div class="marker-wrapper ${isSelected ? 'is-selected' : ''}" id="marker-${zone.id}">
                <div class="radar-ping" style="border-color: ${color}; background-color: ${color}25;"></div>
                <div class="marker-pin" style="background: ${color}; box-shadow: 0 0 16px ${color};">
                  <span class="marker-score">${score}%</span>
                </div>
                <div class="marker-tag">
                  <span class="tag-text">${zone.name.split(' ')[0]}</span>
                </div>
              </div>
            `,
            iconSize: [44, 44],
            iconAnchor: [22, 22],
          })
          marker.setIcon(customIcon)

          marker.setTooltipContent(
            `<div class="sleek-map-popup">
              <div class="font-bold text-foreground text-xs">${zone.name}</div>
              <div class="text-[10px] text-cyan-400 font-mono mt-0.5">${zone.id} · ${(ev?.density_per_sqm ?? 0).toFixed(1)} p/m²</div>
              <div class="text-[10px] text-muted-foreground mt-0.5">Flow: ${(ev?.flow_speed_mps ?? 1.2).toFixed(1)} m/s · Threat: ${score}%</div>
            </div>`
          )
        }
      })

      if (heatRef.current) mapRef.current.removeLayer(heatRef.current)
      if (showHeat) {
        heatRef.current = updateHeatmap(L, mapRef.current, events)
      }
    }
    update()
  }, [events, showHeat, selectedZoneId])

  // Update Layer Visibility
  useEffect(() => {
    if (!mapRef.current) return
    vectorPolylinesRef.current.forEach((line) => {
      if (showVectors) mapRef.current.addLayer(line)
      else mapRef.current.removeLayer(line)
    })
    evacuationPolylinesRef.current.forEach((line) => {
      if (showEvacRoutes) mapRef.current.addLayer(line)
      else mapRef.current.removeLayer(line)
    })
  }, [showVectors, showEvacRoutes])

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden select-none">
      {/* Tactical Map Layer Controls */}
      <div className="absolute top-3 right-3 z-[1000] flex items-center gap-1.5 bg-slate-950/85 backdrop-blur-md p-1.5 rounded-xl border border-white/10 text-xs shadow-xl">
        <button
          onClick={() => setShowHeat(!showHeat)}
          className={cn(
            'flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all',
            showHeat ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-muted-foreground hover:text-foreground'
          )}
          title="Toggle Thermal Density Heatmap"
        >
          <Layers className="w-3 h-3" />
          Heatmap
        </button>
        <button
          onClick={() => setShowVectors(!showVectors)}
          className={cn(
            'flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all',
            showVectors ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-muted-foreground hover:text-foreground'
          )}
          title="Toggle Crowd Direction Flow Vectors"
        >
          <Activity className="w-3 h-3" />
          Vectors
        </button>
        <button
          onClick={() => setShowEvacRoutes(!showEvacRoutes)}
          className={cn(
            'flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all',
            showEvacRoutes ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'text-muted-foreground hover:text-foreground'
          )}
          title="Toggle Safe Evacuation Corridors"
        >
          <Navigation className="w-3 h-3" />
          Evacuation
        </button>
      </div>

      {/* Floating Tactical Inspector on Selected Gate */}
      {selectedZone && selectedEvent && (
        <div className="absolute bottom-4 left-4 z-[1000] bg-slate-950/90 backdrop-blur-md border border-cyan-500/40 rounded-2xl p-4 shadow-2xl w-72 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-start justify-between gap-2 pb-2 border-b border-white/10">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <h4 className="text-xs font-bold font-mono text-foreground uppercase tracking-wide">
                  {selectedZone.name}
                </h4>
              </div>
              <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{selectedZone.id}</p>
            </div>
            <span
              className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border uppercase"
              style={{
                borderColor: getRiskColor(selectedEvent.risk_level),
                color: getRiskColor(selectedEvent.risk_level),
                backgroundColor: `${getRiskColor(selectedEvent.risk_level)}15`,
              }}
            >
              {selectedEvent.risk_level}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-3 text-xs font-mono">
            <div className="bg-white/5 rounded-xl p-2 border border-white/5">
              <span className="text-[9px] text-muted-foreground flex items-center gap-1">
                <Users className="w-3 h-3 text-cyan-400" /> Density
              </span>
              <p className="font-bold text-foreground mt-0.5">{selectedEvent.density_per_sqm} p/m²</p>
            </div>
            <div className="bg-white/5 rounded-xl p-2 border border-white/5">
              <span className="text-[9px] text-muted-foreground flex items-center gap-1">
                <Gauge className="w-3 h-3 text-emerald-400" /> Velocity
              </span>
              <p className="font-bold text-foreground mt-0.5">{selectedEvent.flow_speed_mps} m/s</p>
            </div>
            <div className="bg-white/5 rounded-xl p-2 border border-white/5">
              <span className="text-[9px] text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-400" /> Breach
              </span>
              <p className="font-bold text-foreground mt-0.5">
                {selectedEvent.eta_minutes != null ? `${selectedEvent.eta_minutes}m` : 'Nominal'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Map Container */}
      <div ref={containerRef} className="w-full h-full" />

      <style>{`
        .custom-gis-marker {
          background: transparent;
          border: none;
        }
        .marker-wrapper {
          position: relative;
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .marker-pin {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid #ffffff;
          transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
          z-index: 2;
        }
        .marker-score {
          font-size: 9px;
          font-family: 'JetBrains Mono', monospace;
          font-weight: 800;
          color: #060f18;
        }
        .radar-ping {
          position: absolute;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          border: 1.5px solid;
          animation: radarWave 2s infinite cubic-bezier(0.215, 0.61, 0.355, 1);
          z-index: 1;
        }
        .marker-tag {
          position: absolute;
          bottom: -14px;
          background: rgba(6, 15, 24, 0.9);
          border: 1px solid rgba(255, 255, 255, 0.15);
          padding: 1px 5px;
          border-radius: 6px;
          white-space: nowrap;
          z-index: 3;
        }
        .tag-text {
          font-size: 8.5px;
          font-family: 'JetBrains Mono', monospace;
          font-weight: 700;
          color: #f1f5f9;
          text-transform: uppercase;
        }
        .marker-wrapper.is-selected .marker-pin {
          transform: scale(1.25);
          border-color: #00f0ff;
          box-shadow: 0 0 24px #00f0ff;
        }
        .custom-leaflet-tooltip {
          background: rgba(8, 17, 28, 0.95) !important;
          border: 1px solid rgba(0, 240, 255, 0.3) !important;
          color: #f8fafc !important;
          padding: 6px 10px !important;
          border-radius: 10px !important;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5) !important;
          backdrop-filter: blur(8px);
        }
        .custom-leaflet-tooltip::before {
          border-top-color: rgba(0, 240, 255, 0.3) !important;
        }
        .leaflet-container {
          background: #060f18 !important;
        }
        .animated-flow-vector {
          animation: vectorDash 1.2s linear infinite;
        }
        .animated-evac-route {
          animation: evacDash 2s linear infinite;
        }
        @keyframes vectorDash {
          from { stroke-dashoffset: 16; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes evacDash {
          from { stroke-dashoffset: 20; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes radarWave {
          0% { transform: scale(0.6); opacity: 1; }
          100% { transform: scale(1.6); opacity: 0; }
        }
      `}</style>
    </div>
  )
}

function updateHeatmap(L: any, map: any, events: Map<string, RiskEvent>) {
  const heatLayer = (L as any).heatLayer
  if (typeof heatLayer !== 'function') return null
  const points = ZONES.map((zone) => [
    zone.coords[0],
    zone.coords[1],
    Math.min((events.get(zone.id)?.density_per_sqm ?? 0) / 7.5, 1),
  ])
  const heat = heatLayer(points, {
    radius: 46,
    blur: 24,
    maxZoom: 17,
    max: 1,
    gradient: {
      0.2: RISK_COLORS.low,
      0.5: RISK_COLORS.medium,
      0.75: RISK_COLORS.high,
      1: RISK_COLORS.critical,
    },
  })
  heat.addTo(map)
  return heat
}
