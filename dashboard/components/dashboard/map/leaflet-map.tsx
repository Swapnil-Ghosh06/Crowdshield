'use client'

import { useEffect, useRef, useState } from 'react'
import type { RiskEvent } from '@/lib/crowdshield/types'
import { ZONES } from '@/lib/crowdshield/zones'
import { getRiskColor, RISK_COLORS } from '@/lib/crowdshield/theme'
import { Layers, Shield, Navigation, Users, Radio, Activity } from 'lucide-react'

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
  [[28.6147, 77.2075], [28.6160, 77.2065], [28.6172, 77.2055]], // West -> North-West Boulevard
  [[28.6142, 77.2108], [28.6155, 77.2125], [28.6168, 77.2140]], // East -> Outer Plaza
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

      const map = L.map(containerRef.current, {
        center: [28.6147, 77.209],
        zoom: 16,
        scrollWheelZoom: true,
        zoomControl: true,
      })

      // Dark CartoDB Tile Layer
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap © CartoDB',
        maxZoom: 19,
      }).addTo(map)

      mapRef.current = map

      // 1. Render Zone Markers with Rich Popups
      ZONES.forEach((zone) => {
        const ev = events.get(zone.id)
        const color = getRiskColor(ev?.risk_level)
        const density = ev?.density_per_sqm ?? 0
        const speed = ev?.flow_speed_mps ?? 1.2

        const marker = L.circleMarker(zone.coords, {
          radius: 22,
          color,
          fillColor: color,
          fillOpacity: 0.55,
          weight: 3,
        })

        // Custom Rich Tooltip
        marker.bindTooltip(
          `<div class="leaflet-custom-tooltip">
            <div class="tooltip-title">${zone.name}</div>
            <div class="tooltip-stats">
              <span>Density: <b>${density} p/m²</b></span>
              <span>Speed: <b>${speed} m/s</b></span>
            </div>
          </div>`,
          { permanent: true, direction: 'top', offset: [0, -24], className: 'leaflet-tooltip-dark' }
        )

        marker.on('click', () => onZoneClick(zone.id)).addTo(map)
        markersRef.current.set(zone.id, marker)
      })

      // 2. Render Animated Directional Vector Polylines
      PATH_COORDS.forEach((path) => {
        const polyline = L.polyline(path.coords, {
          color: '#00f0ff',
          weight: 3,
          dashArray: '8, 8',
          opacity: 0.7,
          className: 'animated-flow-line',
        }).addTo(map)
        vectorPolylinesRef.current.push(polyline)
      })

      // 3. Render Evacuation Safe Corridors
      EVACUATION_ROUTES.forEach((route) => {
        const evacLine = L.polyline(route, {
          color: '#22c55e',
          weight: 4,
          dashArray: '10, 6',
          opacity: 0.85,
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

  // Update Markers and Heatmap when events change
  useEffect(() => {
    if (!mapRef.current) return
    const update = async () => {
      const L = (await import('leaflet')).default

      ZONES.forEach((zone) => {
        const marker = markersRef.current.get(zone.id)
        const ev = events.get(zone.id)
        const color = getRiskColor(ev?.risk_level)
        marker?.setStyle({ color, fillColor: color })

        if (marker) {
          marker.setTooltipContent(
            `<div class="leaflet-custom-tooltip">
              <div class="tooltip-title">${zone.name}</div>
              <div class="tooltip-stats">
                <span>Density: <b>${ev?.density_per_sqm ?? 0} p/m²</b></span>
                <span>Speed: <b>${ev?.flow_speed_mps ?? 1.2} m/s</b></span>
              </div>
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
  }, [events, showHeat])

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

  // Selected Zone highlight pulse
  useEffect(() => {
    const marker = selectedZoneId ? markersRef.current.get(selectedZoneId) : null
    if (!marker) return
    marker.setStyle({ weight: 7, fillOpacity: 0.9 })
    const timer = window.setTimeout(() => marker.setStyle({ weight: 3, fillOpacity: 0.55 }), 1500)
    return () => window.clearTimeout(timer)
  }, [selectedZoneId])

  return (
    <div className="relative w-full h-full">
      {/* Tactical Map Layer Controls */}
      <div className="absolute top-3 right-3 z-[1000] flex items-center gap-1.5 bg-background/85 backdrop-blur-md p-1.5 rounded-lg border border-border/80 text-xs shadow-md">
        <button
          onClick={() => setShowHeat(!showHeat)}
          className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
            showHeat ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
          title="Toggle Thermal Density Heatmap"
        >
          <Layers className="w-3 h-3" />
          Heatmap
        </button>
        <button
          onClick={() => setShowVectors(!showVectors)}
          className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
            showVectors ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
          title="Toggle Crowd Direction Flow Vectors"
        >
          <Activity className="w-3 h-3" />
          Flow Vectors
        </button>
        <button
          onClick={() => setShowEvacRoutes(!showEvacRoutes)}
          className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
            showEvacRoutes ? 'bg-emerald-600 text-white' : 'text-muted-foreground hover:text-foreground'
          }`}
          title="Toggle Safe Evacuation Corridors"
        >
          <Navigation className="w-3 h-3" />
          Evacuation Routes
        </button>
      </div>

      <div ref={containerRef} className="w-full h-full rounded-xl" />

      <style>{`
        .leaflet-tooltip-dark {
          background: rgba(10, 26, 44, 0.92) !important;
          border: 1px solid #1f3d5c !important;
          color: #f4f8fa !important;
          padding: 4px 8px !important;
          border-radius: 8px !important;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4) !important;
          backdrop-filter: blur(4px);
        }
        .leaflet-tooltip-dark::before {
          border-top-color: #1f3d5c !important;
        }
        .leaflet-container {
          background: #060f18 !important;
        }
        .tooltip-title {
          font-weight: 700;
          font-size: 11px;
          color: #ffffff;
          margin-bottom: 2px;
        }
        .tooltip-stats {
          font-size: 10px;
          color: #94a3b8;
          display: flex;
          gap: 6px;
        }
        .animated-flow-line {
          animation: dashFlow 1.5s linear infinite;
        }
        @keyframes dashFlow {
          from {
            stroke-dashoffset: 24;
          }
          to {
            stroke-dashoffset: 0;
          }
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
    Math.min((events.get(zone.id)?.density_per_sqm ?? 0) / 8, 1),
  ])
  const heat = heatLayer(points, {
    radius: 50,
    blur: 28,
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
