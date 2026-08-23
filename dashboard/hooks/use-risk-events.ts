'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ZONES } from '@/lib/crowdshield/zones'
import type { RiskEvent, Intervention, RiskLevel } from '@/lib/crowdshield/types'

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
  simulateEvent: (customOverride?: Partial<RiskEvent>) => void
  triggerSurge: (targetZoneId?: string) => void
  triggerMitigation: (targetZoneId?: string) => void
  resetTelemetry: () => void
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
  const [refreshMode, setRefreshMode] = useState<RefreshMode>('live')
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date())
  const [secondsUntilNextRefresh, setSecondsUntilNextRefresh] = useState<number>(120)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)

  // Simulation mode state ref: zone_id -> target score multiplier
  const surgeTargetRef = useRef<{ zoneId: string | null; intensity: number }>({
    zoneId: null,
    intensity: 0,
  })

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
        next.set(e.zone_id, [...arr, e].slice(-30))
      })
      return next
    })

    setLastEvent(incoming[incoming.length - 1])
    setTotalEvents(n => n + incoming.length)
    setLastRefreshedAt(new Date())
    setTimeout(() => setIsRefreshing(false), 150)
  }, [])

  const ingest = useCallback((incoming: RiskEvent[]) => {
    if (!Array.isArray(incoming)) return
    latestBufferRef.current = incoming
    commitToUI(incoming)
  }, [commitToUI])

  // Generate dynamic telemetry frame
  const generateTelemetry = useCallback((surgeZoneId: string | null, intensity: number) => {
    const now = new Date().toISOString()

    return ZONES.map((zone, i) => {
      const isTarget = surgeZoneId === zone.id || surgeZoneId === 'all' || (surgeZoneId === null && i === 0 && intensity > 0)
      const baseWave = Math.sin(Date.now() / 4000 + i * 1.4) * 0.06

      let score: number
      if (isTarget && intensity > 0) {
        score = Math.min(0.95, 0.65 + intensity * 0.28 + baseWave)
      } else {
        score = Math.max(0.12, Math.min(0.42, 0.20 + baseWave + (i * 0.04)))
      }

      const level: RiskLevel =
        score >= 0.75
          ? 'critical'
          : score >= 0.50
          ? 'high'
          : score >= 0.30
          ? 'medium'
          : 'low'

      const etaMinutes: number | null =
        score >= 0.70
          ? Math.max(2, Math.round((1 - score) * 18))
          : score >= 0.50
          ? Math.max(6, Math.round((1 - score) * 32))
          : null

      const density = +(score * 6.2).toFixed(1)
      const flowSpeed = +(Math.max(0.35, 1.45 - score * 1.15)).toFixed(2)

      return {
        zone_id: zone.id,
        zone_name: zone.name,
        timestamp: now,
        density_per_sqm: density,
        flow_speed_mps: flowSpeed,
        risk_score: +score.toFixed(2),
        risk_level: level,
        eta_minutes: etaMinutes,
        recommendations:
          score > 0.70
            ? ['open_alternate_gate', 'deploy_staff', 'pa_broadcast']
            : score > 0.50
            ? ['monitor_flow', 'preposition_staff']
            : ['maintain_standard_flow'],
        announcement: {
          en:
            level === 'critical'
              ? `EMERGENCY ADVISORY: ${zone.name} is heavily congested. Emergency evacuation routes active.`
              : level === 'high'
              ? `NOTICE: Heavy crowd buildup at ${zone.name}. Please move towards open side gates.`
              : `All zones nominal. Flow at ${zone.name} is smooth and steady.`,
          hi:
            level === 'critical'
              ? `आपातकालीन सूचना: ${zone.name} पर भारी भीड़ का दबाव है। आपातकालीन निकास मार्ग शुरू।`
              : level === 'high'
              ? `सूचना: ${zone.name} पर भीड़ बढ़ रही है। कृपया वैकल्पिक गेट का उपयोग करें।`
              : `सभी क्षेत्र सुरक्षित हैं। ${zone.name} पर आवागमन सामान्य है।`,
        },
      } satisfies RiskEvent
    })
  }, [])

  // Manual refresh handler
  const refreshNow = useCallback(() => {
    const frame = generateTelemetry(surgeTargetRef.current.zoneId, surgeTargetRef.current.intensity)
    ingest(frame)
  }, [generateTelemetry, ingest])

  const simulateEvent = useCallback(() => {
    const frame = generateTelemetry(surgeTargetRef.current.zoneId, surgeTargetRef.current.intensity)
    ingest(frame)
  }, [generateTelemetry, ingest])

  // Explicit Trigger Surge
  const triggerSurge = useCallback((targetZoneId = 'gate_3') => {
    surgeTargetRef.current = { zoneId: targetZoneId, intensity: 0.95 }
    const frame = generateTelemetry(targetZoneId, 0.95)
    ingest(frame)
  }, [generateTelemetry, ingest])

  // Explicit Trigger Mitigation
  const triggerMitigation = useCallback((targetZoneId?: string) => {
    surgeTargetRef.current = { zoneId: null, intensity: 0 }
    const frame = generateTelemetry(null, 0)
    ingest(frame)
  }, [generateTelemetry, ingest])

  const resetTelemetry = useCallback(() => {
    surgeTargetRef.current = { zoneId: null, intensity: 0 }
    const frame = generateTelemetry(null, 0)
    ingest(frame)
  }, [generateTelemetry, ingest])

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

  // Dynamic telemetry timer loop (every 2 seconds) when socket is disconnected
  useEffect(() => {
    if (connectionStatus !== 'disconnected') return
    if (!autoSimulateRef.current) return

    // Seed initial dataset so history map has values
    for (let k = 0; k < 12; k++) {
      simulateEvent()
    }

    const id = setInterval(() => {
      if (autoSimulateRef.current) {
        simulateEvent()
      }
    }, 2000)

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
    
    // Immediately alleviate surge when user dispatches any intervention
    surgeTargetRef.current = { zoneId: null, intensity: 0 }
    setTimeout(() => {
      const frame = generateTelemetry(null, 0)
      ingest(frame)
    }, 150)

    setTimeout(() => {
      setInterventions(prev => prev.map(item => item.id === intervention.id ? { ...item, state: 'acknowledged' } : item))
    }, 8000)
  }, [generateTelemetry, ingest])

  const acknowledgeIntervention = useCallback((id: string) => {
    setInterventions(prev => prev.map(item => item.id === id ? { ...item, state: 'acknowledged' } : item))
  }, [])

  return {
    events, history, connectionStatus, totalEvents,
    lastEvent, reconnectCount, interventions,
    refreshMode, setRefreshMode,
    refreshNow, lastRefreshedAt, secondsUntilNextRefresh, isRefreshing,
    simulateEvent, triggerSurge, triggerMitigation, resetTelemetry, reconnect: connect,
    addIntervention, acknowledgeIntervention,
  }
}
