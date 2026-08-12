import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook to connect to the Risk Events WebSocket server.
 * Expects an array of zone events (or single zone object) broadcasted periodically.
 * Maintains a rolling history of the last 20 entries per zone_id.
 * 
 * @param {string} url - WebSocket endpoint URL (default: 'ws://localhost:8000/ws/risk-events')
 * @returns {{
 *   events: Map<string, object>,
 *   history: Map<string, Array<{ timestamp: string, risk_score: number, risk_level: string }>>,
 *   connectionStatus: 'connecting' | 'connected' | 'disconnected',
 *   totalEvents: number,
 *   lastEvent: object | null,
 *   reconnectCount: number,
 *   simulateEvent: (mockData?: object | object[]) => void,
 *   reconnect: () => void
 * }}
 */
export function useRiskEvents(url = 'ws://localhost:8000/ws/risk-events') {
  const [events, setEvents] = useState(new Map());
  const [history, setHistory] = useState(new Map());
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [totalEvents, setTotalEvents] = useState(0);
  const [lastEvent, setLastEvent] = useState(null);
  const [reconnectCount, setReconnectCount] = useState(0);

  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const isUnmountedRef = useRef(false);

  // Process incoming risk events (supports array of zone events or single object)
  const handleRiskEvents = useCallback((data) => {
    if (!data) return;

    const eventList = Array.isArray(data) ? data : [data];
    const validEvents = eventList.filter(
      (item) => item && typeof item === 'object' && item.zone_id
    );

    if (validEvents.length === 0) {
      console.warn('[useRiskEvents] Received payload with no valid zone_id items:', data);
      return;
    }

    setLastEvent(validEvents[validEvents.length - 1]);
    setTotalEvents((prev) => prev + validEvents.length);

    // Update latest event per zone_id
    setEvents((prevMap) => {
      const nextMap = new Map(prevMap);
      validEvents.forEach((evt) => {
        nextMap.set(evt.zone_id, evt);
      });
      return nextMap;
    });

    // Update rolling history (last 20 entries per zone_id)
    setHistory((prevHistory) => {
      const nextHistory = new Map(prevHistory);
      validEvents.forEach((evt) => {
        const existing = nextHistory.get(evt.zone_id) || [];
        const newEntry = {
          timestamp: evt.timestamp || new Date().toISOString(),
          risk_score: evt.risk_score ?? 0,
          risk_level: evt.risk_level || 'low'
        };
        // Cap at 20 entries max
        const updated = [...existing, newEntry].slice(-20);
        nextHistory.set(evt.zone_id, updated);
      });
      return nextHistory;
    });
  }, []);

  const connect = useCallback(() => {
    if (isUnmountedRef.current) return;

    // Clear any existing reconnect timer to prevent duplicate connections
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Clean up previous socket if open/connecting
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.onclose = null;
      try {
        wsRef.current.close();
      } catch (e) {
        // Ignore close errors during reset
      }
      wsRef.current = null;
    }

    setConnectionStatus('connecting');

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isUnmountedRef.current) return;
        console.log(`[useRiskEvents] Connected to ${url}`);
        
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }

        setConnectionStatus('connected');
      };

      ws.onmessage = (event) => {
        if (isUnmountedRef.current) return;
        try {
          const parsed = JSON.parse(event.data);
          handleRiskEvents(parsed);
        } catch (err) {
          console.error('[useRiskEvents] Error parsing WebSocket message JSON:', err, event.data);
        }
      };

      ws.onerror = (err) => {
        if (isUnmountedRef.current) return;
        console.error('[useRiskEvents] WebSocket error:', err);
      };

      ws.onclose = (event) => {
        if (isUnmountedRef.current) return;
        console.warn(`[useRiskEvents] Disconnected (${event.code}). Retrying in 3s...`);
        setConnectionStatus('disconnected');

        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }

        // Auto-reconnect after 3-second delay
        reconnectTimeoutRef.current = setTimeout(() => {
          if (!isUnmountedRef.current) {
            setReconnectCount((count) => count + 1);
            connect();
          }
        }, 3000);
      };
    } catch (err) {
      console.error('[useRiskEvents] Connection setup exception:', err);
      setConnectionStatus('disconnected');

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      reconnectTimeoutRef.current = setTimeout(() => {
        if (!isUnmountedRef.current) {
          setReconnectCount((count) => count + 1);
          connect();
        }
      }, 3000);
    }
  }, [url, handleRiskEvents]);

  useEffect(() => {
    isUnmountedRef.current = false;
    connect();

    return () => {
      isUnmountedRef.current = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.onopen = null;
        wsRef.current.onmessage = null;
        wsRef.current.onerror = null;
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  // Dev utility method to simulate an array of incoming zone events
  const simulateEvent = useCallback((customData) => {
    if (customData) {
      handleRiskEvents(customData);
      return;
    }

    const riskLevels = ['low', 'medium', 'high', 'critical'];
    const zones = [
      { id: 'gate_1', name: 'South Entrance' },
      { id: 'gate_2', name: 'North Gate' },
      { id: 'gate_3', name: 'East Pavilion' },
      { id: 'gate_4', name: 'West Exit' },
      { id: 'gate_5', name: 'Main Arena' }
    ];

    const mockBatch = zones.map((z) => {
      const selectedRisk = riskLevels[Math.floor(Math.random() * riskLevels.length)];
      return {
        zone_id: z.id,
        zone_name: z.name,
        timestamp: new Date().toISOString(),
        density_per_sqm: +(Math.random() * 4.5 + 0.5).toFixed(2),
        flow_speed_mps: +(Math.random() * 1.8 + 0.1).toFixed(2),
        risk_score: +(Math.random()).toFixed(2),
        risk_level: selectedRisk,
        eta_minutes: Math.random() > 0.3 ? Math.floor(Math.random() * 25) + 2 : null,
        recommendations: [
          'Open emergency relief barrier B-4',
          'Dispatch crowd stewards to bottleneck'
        ].slice(0, Math.floor(Math.random() * 2) + 1),
        announcement: {
          en: `Notice: Density active in ${z.name}. Please follow steward guidance.`,
          hi: `सूचना: ${z.name} में गतिविधियां सक्रिय हैं। निर्देशों का पालन करें।`
        }
      };
    });

    handleRiskEvents(mockBatch);
  }, [handleRiskEvents]);

  return {
    events,
    history,
    connectionStatus,
    totalEvents,
    lastEvent,
    reconnectCount,
    simulateEvent,
    reconnect: connect
  };
}
