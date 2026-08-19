import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, ZoomControl, useMap } from 'react-leaflet'
import { riskColor } from '../hooks/useRiskEvents'
import 'leaflet/dist/leaflet.css'

const COORDS = {
  gate_1:[28.6139,77.2090], gate_2:[28.6155,77.2090],
  gate_3:[28.6147,77.2105], gate_4:[28.6147,77.2075],
  gate_5:[28.6147,77.2090]
}

function HeatLayer({ events }) {
  const map = useMap()
  const heatRef = useRef(null)
  useEffect(() => {
    import('leaflet.heat').then(async () => {
      const L = window.L || (await import('leaflet')).default
      const points = events.map(e => {
        const [lat, lng] = COORDS[e.zone_id] || [0,0]
        return [lat, lng, Math.min(e.density_per_sqm / 8, 1)]
      }).filter(p => p[0] !== 0)
      if (heatRef.current) map.removeLayer(heatRef.current)
      if (points.length) {
        const heatFn = L.heatLayer || window.L?.heatLayer
        if (heatFn) {
          heatRef.current = heatFn(points, {
            radius: 45, blur: 30, maxZoom: 18,
            gradient: { 0.2:'#22c55e', 0.5:'#eab308', 0.75:'#f97316', 1.0:'#ef4444' }
          }).addTo(map)
        }
      }
    })
    return () => { if (heatRef.current) map.removeLayer(heatRef.current) }
  }, [events, map])
  return null
}

function ZoneCard({ event }) {
  const [lang, setLang] = useState('en')
  if (!event) return <div className="zone-card empty-card">Waiting for zone telemetry...</div>
  const c = riskColor(event)
  return (
    <article className="zone-card" style={{'--risk': c}}>
      <div className="zone-strip"/>
      <div className="zone-top">
        <div><b>{event.zone_name}</b><small>{event.zone_id}</small></div>
        <span className={`badge ${event.risk_level}`}>{event.risk_level}</span>
      </div>
      <div className="score-line"><span>Risk Score</span><b>{event.risk_score.toFixed(2)}</b></div>
      <div className="progress"><i style={{width:`${event.risk_score*100}%`}}/></div>
      <div className="metric-row">
        <span className="eta">
          {event.eta_minutes != null && event.eta_minutes < 3
            ? '⏱ Imminent' : `⏱ ${event.eta_minutes ?? '—'} min`}
        </span>
        <span className="recommendation">{event.recommendations[0]?.replaceAll('_',' ')}</span>
      </div>
      <div className="announcement">
        <div style={{display:'flex',gap:4,marginBottom:4}}>
          <button className={`lang${lang==='en'?' active':''}`} onClick={()=>setLang('en')}>EN</button>
          <button className={`lang${lang==='hi'?' active':''}`} onClick={()=>setLang('hi')}>HI</button>
        </div>
        <p>{event.announcement[lang]}</p>
      </div>
    </article>
  )
}

export default function MapView({ events }) {
  const list = [...events.values()].sort((a,b) => b.risk_score - a.risk_score)
  const critical = list.filter(e => e.risk_level==='high' || e.risk_level==='critical')
  return (
    <div className="map-view">
      <div className="map-pane">
        <MapContainer center={[28.6147,77.2090]} zoom={16} zoomControl={false} className="leaflet-map">
          <TileLayer
            attribution="&copy; OpenStreetMap contributors &copy; CARTO"
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          <ZoomControl position="bottomright"/>
          {list.map(e => (
            <CircleMarker
              key={e.zone_id}
              center={COORDS[e.zone_id]}
              radius={e.risk_level==='critical'?26:22}
              pathOptions={{
                color: riskColor(e), fillColor: riskColor(e),
                fillOpacity: 0.75, weight: 2
              }}
            >
              <Popup>
                <div className="popup">
                  <b>{e.zone_name}</b>
                  <span className={`badge ${e.risk_level}`}>{e.risk_level}</span>
                  <p>Score <strong>{e.risk_score.toFixed(2)}</strong> · ETA {e.eta_minutes} min</p>
                  <p>{e.recommendations.join(', ').replaceAll('_',' ')}</p>
                  <em>{e.announcement.en}</em>
                </div>
              </Popup>
            </CircleMarker>
          ))}
          <HeatLayer events={list}/>
        </MapContainer>
      </div>
      <aside className="risk-sidebar">
        <div className="side-head">
          <h2>Risk Zones</h2>
          <span>{list.length || 5} zones</span>
        </div>
        {critical.length > 0 && (
          <div className="alert-banner">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L1 21h22L12 2zm0 3l9 16H3L12 5zm-1 6v4h2v-4h-2zm0 6v2h2v-2h-2z"/>
            </svg>
            <div>
              <b>CRITICAL ALERT</b>
              <p>{critical.map(e=>e.zone_name).join(' · ')}</p>
            </div>
          </div>
        )}
        <div className="zone-list">
          {['gate_1','gate_2','gate_3','gate_4','gate_5'].map(id => (
            <ZoneCard key={id} event={events.get(id)}/>
          ))}
        </div>
      </aside>
    </div>
  )
}
