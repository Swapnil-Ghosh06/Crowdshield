'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ZONES } from '@/lib/crowdshield/zones'
import type { RiskEvent, Intervention } from '@/lib/crowdshield/types'

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'

export interface UseRiskEventsReturn {
  events: Map<string, RiskEvent>
  history: Map<string, RiskEvent[]>
  connectionStatus: ConnectionStatus
  totalEvents: number
  lastEvent: RiskEvent | null
  reconnectCount: number
  interventions: Intervention[]
  simulateEvent: () => void
  reconnect: () => void
  addIntervention: (intervention: Omit<Intervention, 'id' | 'timestamp' | 'state'>) => void
  acknowledgeIntervention: (id: string) => void
}

export function useRiskEvents(wsUrl = 'ws://localhost:8000/ws/risk-events'): UseRiskEventsReturn {
  const [events, setEvents] = useState<Map<string, RiskEvent>>(new Map())
  const [history, setHistory] = useState<Map<string, RiskEvent[]>>(new Map())
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting')
  const [totalEvents, setTotalEvents] = useState(0)
  const [reconnectCount, setReconnectCount] = useState(0)
  const [lastEvent, setLastEvent] = useState<RiskEvent | null>(null)
  const [interventions, setInterventions] = useState<Intervention[]>([])
  const socketRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const ingest = useCallback((incoming: RiskEvent[]) => {
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
        next.set(e.zone_id, [...arr, e].slice(-20))
      })
      return next
    })
    if (incoming.length > 0) setLastEvent(incoming[incoming.length - 1])
    setTotalEvents(n => n + incoming.length)
  }, [])

  const simulateEvent = useCallback(() => {
    const now = new Date().toISOString()
    ingest(ZONES.map((zone, i) => {
      const wave = Math.sin(Date.now() / 15000 + i * 1.3)
      const score = Math.max(0.08, Math.min(0.98, 0.42 + wave * 0.22 + (i === 4 ? 0.18 : 0)))
      const level = score > 0.82 ? 'critical' : score > 0.68 ? 'high' : score > 0.42 ? 'medium' : 'low'
      return {
        zone_id: zone.id,
        zone_name: zone.name,
        timestamp: now,
        density_per_sqm: +(score * 7.2).toFixed(1),
        flow_speed_mps: +(0.9 - score * 0.6).toFixed(2),
        risk_score: +score.toFixed(2),
        risk_level: level as RiskEvent['risk_level'],
        eta_minutes: score > 0.7 ? 2 : Math.round(4 + (1 - score) * 5),
        recommendations: score > 0.75 ? [`close_gate_${zone.id}`, 'deploy_staff'] : ['monitor_zone'],
        announcement: {
          en: `${level === 'critical' ? 'ALERT: Critical' : 'Notice:'} crowd conditions at ${zone.name}.`,
          hi: `${zone.name} पर भीड़ की स्थिति: ${level === 'critical' ? 'अत्यंत खतरनाक' : 'निगरानी जारी है'}।`
        }
      } satisfies RiskEvent
    }))
  }, [ingest])

  const connect = useCallback(() => {
    setConnectionStatus('connecting')
    try {
      const ws = new WebSocket(wsUrl)
      socketRef.current = ws
      ws.onopen = () => setConnectionStatus('connected')
      ws.onmessage = e => { try { ingest(JSON.parse(e.data)) } catch { /* ignore malformed */ } }
      ws.onclose = () => {
        setConnectionStatus('disconnected')
        setReconnectCount(c => c + 1)
        reconnectTimer.current = setTimeout(connect, 3000)
      }
      ws.onerror = () => ws.close()
    } catch {
      setConnectionStatus('disconnected')
      setReconnectCount(c => c + 1)
      reconnectTimer.current = setTimeout(connect, 3000)
    }
  }, [wsUrl, ingest])

  useEffect(() => {
    if (connectionStatus !== 'disconnected') return
    const id = setInterval(simulateEvent, 3000)
    simulateEvent()
    return () => clearInterval(id)
  }, [connectionStatus, simulateEvent])

  useEffect(() => {
    simulateEvent()
    connect()
    return () => {
      socketRef.current?.close()
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
    }
  }, [connect])

  const addIntervention = useCallback((data: Omit<Intervention, 'id' | 'timestamp' | 'state'>) => {
    const intervention: Intervention = {
      ...data,
      id: `int_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      state: 'confirmed',
    }
    setInterventions(prev => [intervention, ...prev].slice(0, 50))
    setTimeout(() => {
      setInterventions(prev => prev.map(item => item.id === intervention.id ? { ...item, state: 'acknowledged' } : item))
    }, 10000)
  }, [])

  const acknowledgeIntervention = useCallback((id: string) => {
    setInterventions(prev => prev.map(item => item.id === id ? { ...item, state: 'acknowledged' } : item))
  }, [])

  return {
    events, history, connectionStatus, totalEvents,
    lastEvent, reconnectCount, interventions,
    simulateEvent, reconnect: connect,
    addIntervention, acknowledgeIntervention,
  }
}
