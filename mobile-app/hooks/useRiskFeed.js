/**
 * useRiskFeed — connects to the CrowdShield WebSocket feed and maintains
 * a map of the latest event per zone_id.
 *
 * Usage:
 *   const { zones, connected, error } = useRiskFeed("ws://localhost:8000/ws/risk-events");
 */

import { useEffect, useRef, useState, useCallback } from "react";

const RECONNECT_DELAY_MS = 3000;

export function useRiskFeed(url) {
  const [zones, setZones] = useState({}); // keyed by zone_id
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const wsRef = useRef(null);
  const retryTimer = useRef(null);
  const unmounted = useRef(false);

  const applyEvents = useCallback((events) => {
    setZones((prev) => {
      const next = { ...prev };
      events.forEach((e) => {
        next[e.zone_id] = e;
      });
      return next;
    });
  }, []);

  const connect = useCallback(() => {
    if (unmounted.current) return;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (unmounted.current) return;
      setConnected(true);
      setError(null);
      console.log("[useRiskFeed] Connected");
    };

    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);
        // Both "snapshot" and "update" carry an `events` array
        if (data.events) applyEvents(data.events);
      } catch (e) {
        console.warn("[useRiskFeed] Bad message:", e);
      }
    };

    ws.onerror = (e) => {
      console.warn("[useRiskFeed] Error:", e.message);
      setError("Connection error — retrying…");
    };

    ws.onclose = () => {
      if (unmounted.current) return;
      setConnected(false);
      console.log(`[useRiskFeed] Disconnected, retrying in ${RECONNECT_DELAY_MS}ms`);
      retryTimer.current = setTimeout(connect, RECONNECT_DELAY_MS);
    };
  }, [url, applyEvents]);

  useEffect(() => {
    unmounted.current = false;
    connect();
    return () => {
      unmounted.current = true;
      clearTimeout(retryTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  // Sorted array for rendering — critical first, then high, medium, low
  const LEVEL_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
  const zoneList = Object.values(zones).sort(
    (a, b) => (LEVEL_ORDER[a.risk_level] ?? 4) - (LEVEL_ORDER[b.risk_level] ?? 4)
  );

  return { zones, zoneList, connected, error };
}
