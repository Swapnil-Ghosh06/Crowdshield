import { useCallback, useEffect, useRef, useState } from 'react'
import { ZONES_TUPLES as ZONES } from '../constants/zones'
import { RISK_COLORS as COLORS, getRiskColor as riskColor } from '../constants/theme'

export { ZONES, COLORS, riskColor }

export function useRiskEvents(wsUrl = 'ws://localhost:8000/ws/risk-events') {
  const [events, setEvents] = useState(new Map())
  const [history, setHistory] = useState(new Map())
  const [connectionStatus, setConnectionStatus] = useState('connecting')
  const [totalEventsReceived, setTotalEventsReceived] = useState(0)
  const [reconnectCount, setReconnectCount] = useState(0)
  const [lastEvent, setLastEvent] = useState(null)
  const socket = useRef(null)
  const reconnect = useRef(null)
  const autoTimer = useRef(null)

  const ingest = useCallback((incoming) => {
    if (!Array.isArray(incoming)) return
    setEvents(prev => {
      const next = new Map(prev)
      incoming.forEach(e => next.set(e.zone_id, e))
      return next
    })
    setHistory(prev => {
      const next = new Map(prev)
      incoming.forEach(e => {
        const arr = next.get(e.zone_id) ?? []
        next.set(e.zone_id, [...arr, {
          timestamp: e.timestamp,
          risk_score: e.risk_score,
          risk_level: e.risk_level
        }].slice(-20))
      })
      return next
    })
    if (incoming.length > 0) {
      setLastEvent(incoming[incoming.length - 1])
    }
    setTotalEventsReceived(n => n + incoming.length)
  }, [])

  const simulateEvent = useCallback(() => {
    const now = new Date().toISOString()
    ingest(ZONES.map(([id, name], i) => {
      const wave = Math.sin(Date.now() / 15000 + i * 1.3)
      const score = Math.max(0.08, Math.min(0.98,
        0.42 + wave * 0.22 + (i === 4 ? 0.18 : 0)
      ))
      const level = score > .82 ? 'critical' : score > .68 ? 'high'
                  : score > .42 ? 'medium' : 'low'
      return {
        zone_id: id, zone_name: name, timestamp: now,
        density_per_sqm: +(score * 7.2).toFixed(1),
        flow_speed_mps: +(0.9 - score * .6).toFixed(2),
        risk_score: +score.toFixed(2), risk_level: level,
        eta_minutes: score > .7 ? 2 : Math.round(4 + (1 - score) * 5),
        recommendations: score > .75
          ? [`close_gate_${id}`, 'deploy_staff']
          : ['monitor_zone'],
        announcement: {
          en: `${level === 'critical' ? 'Attention: Critical' : 'Notice:'} crowd conditions at ${name}.`,
          hi: `${name} पर भीड़ की स्थिति पर निगरानी रखी जा रही है।`
        }
      }
    }))
  }, [ingest])

  const startAutoSimulate = useCallback(() => {
    if (!autoTimer.current) {
      simulateEvent()
      autoTimer.current = setInterval(simulateEvent, 3000)
    }
  }, [simulateEvent])

  const stopAutoSimulate = useCallback(() => {
    if (autoTimer.current) {
      clearInterval(autoTimer.current)
      autoTimer.current = null
    }
  }, [])

  const connect = useCallback(() => {
    setConnectionStatus('connecting')
    try {
      const ws = new WebSocket(wsUrl)
      socket.current = ws
      ws.onopen = () => { setConnectionStatus('connected') }
      ws.onmessage = e => {
        try { ingest(JSON.parse(e.data)) } catch {}
      }
      ws.onclose = () => {
        setConnectionStatus('disconnected')
        setReconnectCount(c => c + 1)
        reconnect.current = setTimeout(connect, 3000)
      }
      ws.onerror = () => ws.close()
    } catch {
      setConnectionStatus('disconnected')
      setReconnectCount(c => c + 1)
      reconnect.current = setTimeout(connect, 3000)
    }
  }, [wsUrl, ingest])

  useEffect(() => {
    connect()
    return () => {
      socket.current?.close()
      if (reconnect.current) clearTimeout(reconnect.current)
      stopAutoSimulate()
    }
  }, [connect, stopAutoSimulate])

  return {
    events, history, connectionStatus,
    totalEvents: totalEventsReceived,
    totalEventsReceived,
    lastEvent, reconnectCount,
    simulateEvent, reconnect: connect,
    startAutoSimulate, stopAutoSimulate, ZONES
  }
}
