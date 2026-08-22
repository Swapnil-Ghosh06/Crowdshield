'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ZONES } from '@/lib/crowdshield/zones'
import type { RiskEvent, Intervention } from '@/lib/crowdshield/types'

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'
export type RefreshMode = '2min' | 'manual' | 'live'

export interface UseRiskEventsReturn {
  events: Map<string, RiskEvent>
  history: Map<string, RiskEvent[]>
  connectionStatus: ConnectionStatus
  totalEvents: number
  lastEvent: RiskEvent | null
  reconnectCount: number
  interventions: Intervention[]
  refreshMode: RefreshMode
  setRefreshMode: (mode: RefreshMode) => void
  refreshNow: () => void
  lastRefreshedAt: Date
  secondsUntilNextRefresh: number
  isRefreshing: boolean
  simulateEvent: () => void
  reconnect: () => void
  addIntervention: (intervention: Omit<Intervention, 'id' | 'timestamp' | 'state'>) => void
  acknowledgeIntervention: (id: string) => void
}

export function useRiskEvents(
  wsUrl = 'ws://localhost:8000/ws/risk-events',
  autoSimulate = true
): UseRiskEventsReturn {
  const [events, setEvents] = useState<Map<string, RiskEvent>>(new Map())
  const [history, setHistory] = useState<Map<string, RiskEvent[]>>(new Map())
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting')
  const [totalEvents, setTotalEvents] = useState(0)
  const [reconnectCount, setReconnectCount] = useState(0)
  const [lastEvent, setLastEvent] = useState<RiskEvent | null>(null)
  const [interventions, setInterventions] = useState<Intervention[]>([])
  
  // Refresh control state
  const [refreshMode, setRefreshMode] = useState<RefreshMode>('2min')
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date())
  const [secondsUntilNextRefresh, setSecondsUntilNextRefresh] = useState<number>(120)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)

  // Buffer to hold latest received events without constantly re-rendering the UI
  const latestBufferRef = useRef<RiskEvent[]>([])
  const socketRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoSimulateRef = useRef(autoSimulate)
  const refreshModeRef = useRef(refreshMode)

  useEffect(() => { autoSimulateRef.current = autoSimulate }, [autoSimulate])
  useEffect(() => { refreshModeRef.current = refreshMode }, [refreshMode])

  // Commit incoming/buffered events to UI state
  const commitToUI = useCallback((incoming: RiskEvent[]) => {
    if (!Array.isArray(incoming) || incoming.length === 0) return
    setIsRefreshing(true)
    setEvents(prev => {
      const next = new Map(prev)
      incoming.forEach(e => next.set(e.zone_id, e))
      return next
    })
    setHistory(prev => {
      const next = new Map(prev)
      incoming.forEach(e => {
        const arr = next.get(e.zone_id) ?? []
        next.set(e.zone_id, [...arr, e].slice(-25))
      })
      return next
    })
    setLastEvent(incoming[incoming.length - 1])
    setTotalEvents(n => n + incoming.length)
    setLastRefreshedAt(new Date())
    setSecondsUntilNextRefresh(120)
    setTimeout(() => setIsRefreshing(false), 400)
  }, [])

  // Manual refresh handler
  const refreshNow = useCallback(() => {
    if (latestBufferRef.current.length > 0) {
      commitToUI(latestBufferRef.current)
    } else {
      setIsRefreshing(true)
      setTimeout(() => setIsRefreshing(false), 400)
      setLastRefreshedAt(new Date())
      setSecondsUntilNextRefresh(120)
    }
  }, [commitToUI])

  const ingest = useCallback((incoming: RiskEvent[]) => {
    if (!Array.isArray(incoming)) return
    latestBufferRef.current = incoming

    // If UI is completely uninitialized (first message), commit immediately so user sees data
    setEvents(prev => {
      if (prev.size === 0) {
        commitToUI(incoming)
        return prev
      }
      return prev
    })

    // In 'live' mode, commit every tick immediately
    if (refreshModeRef.current === 'live') {
      commitToUI(incoming)
    }
  }, [commitToUI])

  // Interval timer for 2min refresh countdown & execution
  useEffect(() => {
    if (refreshMode !== '2min') return

    const interval = setInterval(() => {
      setSecondsUntilNextRefresh(prev => {
        if (prev <= 1) {
          if (latestBufferRef.current.length > 0) {
            commitToUI(latestBufferRef.current)
          }
          return 120
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [refreshMode, commitToUI])

  const simulateEvent = useCallback(() => {
    const now = new Date().toISOString()
    const simulated = ZONES.map((zone, i) => {
      const wave = Math.sin(Date.now() / 15000 + i * 1.3)
      const score = Math.max(0.08, Math.min(0.98, 0.35 + wave * 0.20))
      const level = score > 0.80 ? 'critical' : score > 0.60 ? 'high' : score > 0.35 ? 'medium' : 'low'
      const etaMinutes: number | null = score > 0.60 ? Math.round(3 + (1 - score) * 10) : null
      return {
        zone_id: zone.id,
        zone_name: zone.name,
        timestamp: now,
        density_per_sqm: +(score * 6.5).toFixed(1),
        flow_speed_mps: +(1.2 - score * 0.7).toFixed(2),
        risk_score: +score.toFixed(2),
        risk_level: level as RiskEvent['risk_level'],
        eta_minutes: etaMinutes,
        recommendations: score > 0.70 ? ['open_alternate_gate', 'deploy_staff'] : ['maintain_standard_flow'],
        announcement: {
          en: `${level === 'critical' ? 'ALERT: Critical crowd density' : 'Notice: Normal crowd conditions'} at ${zone.name}.`,
          hi: `${zone.name} पर भीड़ की स्थिति: ${level === 'critical' ? 'अत्यधिक' : 'सामान्य'} है।`
        }
      } satisfies RiskEvent
    })
    ingest(simulated)
  }, [ingest])

  const connect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.onclose = null
      try { socketRef.current.close() } catch { /* ignore */ }
      socketRef.current = null
    }
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current)
      reconnectTimer.current = null
    }

    setConnectionStatus('connecting')
    try {
      const ws = new WebSocket(wsUrl)
      socketRef.current = ws
      ws.onopen = () => setConnectionStatus('connected')
      ws.onmessage = e => {
        try {
          const parsed = JSON.parse(e.data)
          ingest(parsed)
        } catch { /* ignore */ }
      }
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
    connect()
    return () => {
      if (socketRef.current) {
        socketRef.current.onclose = null
        socketRef.current.close()
      }
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
    }
  }, [connect])

  // Offline fallback simulation
  useEffect(() => {
    if (connectionStatus !== 'disconnected') return
    if (!autoSimulateRef.current) return
    simulateEvent()
    const id = setInterval(() => {
      if (autoSimulateRef.current) simulateEvent()
    }, 4000)
    return () => clearInterval(id)
  }, [connectionStatus, simulateEvent])

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
    refreshMode, setRefreshMode,
    refreshNow, lastRefreshedAt, secondsUntilNextRefresh, isRefreshing,
    simulateEvent, reconnect: connect,
    addIntervention, acknowledgeIntervention,
  }
}
