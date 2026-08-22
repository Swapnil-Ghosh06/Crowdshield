'use client'

import { useEffect, useRef } from 'react'
import type { RiskEvent } from '@/lib/crowdshield/types'
import { ZONES } from '@/lib/crowdshield/zones'
import { getRiskColor, RISK_COLORS } from '@/lib/crowdshield/theme'

interface LeafletMapProps { events: Map<string, RiskEvent>; onZoneClick: (zoneId: string) => void; selectedZoneId: string | null }

export function LeafletMap({ events, onZoneClick, selectedZoneId }: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<Map<string, any>>(new Map())
  const heatRef = useRef<any>(null)

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
      const map = L.map(containerRef.current, { center: [28.6147, 77.209], zoom: 16, scrollWheelZoom: false, zoomControl: true })
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '© OpenStreetMap © CartoDB', maxZoom: 19 }).addTo(map)
      mapRef.current = map
      ZONES.forEach(zone => {
        const color = getRiskColor(events.get(zone.id)?.risk_level)
        const marker = L.circleMarker(zone.coords, { radius: 22, color, fillColor: color, fillOpacity: 0.55, weight: 3 })
        marker.bindTooltip(zone.name, { permanent: true, direction: 'top', offset: [0, -26], className: 'leaflet-tooltip-dark' })
        marker.on('click', () => onZoneClick(zone.id)).addTo(map)
        markersRef.current.set(zone.id, marker)
      })
      heatRef.current = updateHeatmap(L, map, events)
    }
    initMap()
    return () => { disposed = true; mapRef.current?.remove(); mapRef.current = null; markersRef.current.clear(); heatRef.current = null }
  }, [])

  useEffect(() => {
    if (!mapRef.current) return
    const update = async () => {
      const L = (await import('leaflet')).default
      ZONES.forEach(zone => { const marker = markersRef.current.get(zone.id); const color = getRiskColor(events.get(zone.id)?.risk_level); marker?.setStyle({ color, fillColor: color }) })
      if (heatRef.current) mapRef.current.removeLayer(heatRef.current)
      heatRef.current = updateHeatmap(L, mapRef.current, events)
    }
    update()
  }, [events])

  useEffect(() => {
    const marker = selectedZoneId ? markersRef.current.get(selectedZoneId) : null
    if (!marker) return
    marker.setStyle({ weight: 6, fillOpacity: 0.85 })
    const timer = window.setTimeout(() => marker.setStyle({ weight: 3, fillOpacity: 0.55 }), 1200)
    return () => window.clearTimeout(timer)
  }, [selectedZoneId])

  return <div className="relative w-full h-full"><div ref={containerRef} className="w-full h-full rounded-xl" /><style>{`.leaflet-tooltip-dark{background:#102D40;border:1px solid #1D3A4C;color:#F4F8FA;font-size:11px;font-weight:700;padding:3px 8px;border-radius:6px;white-space:nowrap}.leaflet-tooltip-dark::before{border-top-color:#1D3A4C!important}.leaflet-container{background:#071A2B}`}</style></div>
}

function updateHeatmap(L: any, map: any, events: Map<string, RiskEvent>) {
  const heatLayer = (L as any).heatLayer
  if (typeof heatLayer !== 'function') return null
  const points = ZONES.map(zone => [zone.coords[0], zone.coords[1], Math.min((events.get(zone.id)?.density_per_sqm ?? 0) / 8, 1)])
  const heat = heatLayer(points, { radius: 50, blur: 28, maxZoom: 17, max: 1, gradient: { 0.2: RISK_COLORS.low, 0.5: RISK_COLORS.medium, 0.75: RISK_COLORS.high, 1: RISK_COLORS.critical } })
  heat.addTo(map)
  return heat
}
