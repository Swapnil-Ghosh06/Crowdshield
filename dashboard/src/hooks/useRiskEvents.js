import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook to connect to the Risk Events WebSocket server.
 * 
 * @param {string} url - WebSocket endpoint URL
 * @returns {{
 *   events: Map<string, object>,
 *   connectionStatus: 'connecting' | 'connected' | 'disconnected',
 *   totalEvents: number,
 *   lastEvent: object | null,
 *   reconnectCount: number,
 *   simulateEvent: (mockData?: object) => void,
 *   reconnect: () => void
 * }}
 */
export function useRiskEvents(url = 'ws://localhost:8000/ws/risk-events') {
  const [events, setEvents] = useState(new Map());
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [totalEvents, setTotalEvents] = useState(0);
  const [lastEvent, setLastEvent] = useState(null);
  const [reconnectCount, setReconnectCount] = useState(0);

  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const isUnmountedRef = useRef(false);

  // Process valid incoming risk event
  const handleRiskEvent = useCallback((eventData) => {
    if (!eventData || typeof eventData !== 'object' || !eventData.zone_id) {
      console.warn('Received invalid risk event shape:', eventData);
      return;
    }

    setLastEvent(eventData);
    setTotalEvents((prev) => prev + 1);
    setEvents((prevMap) => {
      const nextMap = new Map(prevMap);
      nextMap.set(eventData.zone_id, eventData);
      return nextMap;
    });
  }, []);

  const connect = useCallback(() => {
    if (isUnmountedRef.current) return;

    // Clean up previous socket & pending reconnect timer
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.onclose = null;
      try {
        wsRef.current.close();
      } catch (e) {
        // Ignore close error
      }
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    setConnectionStatus('connecting');

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isUnmountedRef.current) return;
        console.log(`[useRiskEvents] Connected to ${url}`);
        setConnectionStatus('connected');
      };

      ws.onmessage = (event) => {
        if (isUnmountedRef.current) return;
        try {
          const parsed = JSON.parse(event.data);
          handleRiskEvent(parsed);
        } catch (err) {
          console.error('[useRiskEvents] Error parsing WebSocket message JSON:', err, event.data);
        }
      };

      ws.onerror = (err) => {
        if (isUnmountedRef.current) return;
        console.error('[useRiskEvents] WebSocket error:', err);
        // Note: browser automatically fires onclose following onerror
      };

      ws.onclose = (event) => {
        if (isUnmountedRef.current) return;
        console.warn(`[useRiskEvents] Disconnected (${event.code}). Retrying in 3 seconds...`);
        setConnectionStatus('disconnected');

        // Auto-reconnect with 3-second delay on drop
        reconnectTimeoutRef.current = setTimeout(() => {
          if (!isUnmountedRef.current) {
            setReconnectCount((count) => count + 1);
            connect();
          }
        }, 3000);
      };
    } catch (err) {
      console.error('[useRiskEvents] Connection exception:', err);
      setConnectionStatus('disconnected');

      reconnectTimeoutRef.current = setTimeout(() => {
        if (!isUnmountedRef.current) {
          setReconnectCount((count) => count + 1);
          connect();
        }
      }, 3000);
    }
  }, [url, handleRiskEvent]);

  useEffect(() => {
    isUnmountedRef.current = false;
    connect();

    return () => {
      isUnmountedRef.current = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.onopen = null;
        wsRef.current.onmessage = null;
        wsRef.current.onerror = null;
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [connect]);

  // Utility method to simulate an event (useful for UI testing & verification)
  const simulateEvent = useCallback((customData) => {
    const riskLevels = ['low', 'medium', 'high', 'critical'];
    const zones = [
      { id: 'zone_01', name: 'Main Gate Corridor' },
      { id: 'zone_02', name: 'North Plaza Amphitheater' },
      { id: 'zone_03', name: 'East Concourse Stairs' },
      { id: 'zone_04', name: 'VIP Transit Hub' }
    ];
    
    const randomZone = zones[Math.floor(Math.random() * zones.length)];
    const selectedRisk = riskLevels[Math.floor(Math.random() * riskLevels.length)];

    const mock = customData || {
      zone_id: randomZone.id,
      zone_name: randomZone.name,
      timestamp: new Date().toISOString(),
      density_per_sqm: +(Math.random() * 4.5 + 0.5).toFixed(2),
      flow_speed_mps: +(Math.random() * 1.8 + 0.1).toFixed(2),
      risk_score: +(Math.random()).toFixed(2),
      risk_level: selectedRisk,
      eta_minutes: Math.random() > 0.25 ? Math.floor(Math.random() * 25) + 2 : null,
      recommendations: [
        'Open emergency relief barrier B-4',
        'Dispatch crowd stewards to bottleneck',
        'Trigger bilingual voice announcement'
      ].slice(0, Math.floor(Math.random() * 2) + 1),
      announcement: {
        en: `Notice: Density increasing in ${randomZone.name}. Please follow steward guidance.`,
        hi: `सूचना: ${randomZone.name} में भीड़ बढ़ रही है। कृपया स्वयंसेवकों के निर्देशों का पालन करें।`
      }
    };

    handleRiskEvent(mock);
  }, [handleRiskEvent]);

  return {
    events,
    connectionStatus,
    totalEvents,
    lastEvent,
    reconnectCount,
    simulateEvent,
    reconnect: connect
  };
}
