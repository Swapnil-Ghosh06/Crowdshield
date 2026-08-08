# Zahid's Plan — Command Dashboard + Backend

Branch: `zahid` (or `feature/zahid-dashboard`)

## Your scope
1. Backend API layer that exposes Swapnil's WebSocket feed to the frontend cleanly
2. Live event map with zone markers
3. Crowd heatmap overlay
4. Risk zone highlighting (color-coded by risk_level)
5. Trend analytics charts (risk over time per zone)
6. Bonus: simple Digital Twin view (2D venue layout with live risk overlay)

**You don't need to wait for Swapnil's real model.** He'll have a mock WebSocket server running on Day 1 emitting data in the exact shape described below — connect to that immediately and build your whole UI against it. When he swaps in the real engine, your code doesn't change.

## Folder structure (your ownership)
```
backend/       (shared with Swapnil — you own the API-facing parts)
dashboard/     React web app
```

## Tech stack
- React + Vite
- Leaflet or Mapbox for the map/heatmap
- Recharts for analytics
- Native WebSocket client (or socket.io if Swapnil sets that up instead)

## The data you'll be consuming (from Swapnil's pipeline)
```json
{
  "zone_id": "gate_3",
  "zone_name": "North Entrance",
  "timestamp": "2026-08-08T18:42:00Z",
  "density_per_sqm": 4.2,
  "flow_speed_mps": 0.3,
  "risk_score": 0.78,
  "risk_level": "high",
  "eta_minutes": 6,
  "recommendations": ["open_gate_5", "redirect_flow_north"],
  "announcement": { "en": "...", "hi": "..." }
}
```

## Step-by-step build order

**Step 1** — Scaffold the React app, connect to Swapnil's mock WebSocket server, log incoming events to console to confirm the pipe works.

**Step 2** — Live map: place a marker per zone at fixed coordinates (you'll define a simple venue layout — doesn't need real GPS, a mock venue is fine), color-coded by current risk_level, updating in realtime as events arrive.

**Step 3** — Heatmap overlay: use density_per_sqm to render a heat intensity layer on top of the map.

**Step 4** — Risk zone panel: a sidebar listing zones sorted by risk_score, showing eta_minutes and current recommendations, with a "high risk" alert banner when any zone crosses a threshold.

**Step 5** — Trend analytics: a line chart per zone showing risk_score over the last N minutes, so operators can see whether a zone is trending up or stabilizing.

**Step 6 (bonus)** — Digital twin: a simplified 2D top-down venue diagram (SVG) with zones drawn to scale, risk-colored, and gate open/close state reflected visually — this scores well on Innovation for relatively low build effort since you're reusing the same event data.

## Antigravity workspace context (paste into `.antigravity/rules.md`)

```
Project: CrowdShield — command dashboard for crowd stampede early warning system.
My role: I build the React web dashboard and the backend API layer that serves
the realtime risk-event feed to the frontend.

I consume events shaped like:
{
  "zone_id": string, "zone_name": string, "timestamp": ISO8601,
  "density_per_sqm": float, "flow_speed_mps": float,
  "risk_score": float(0-1), "risk_level": "low"|"medium"|"high"|"critical",
  "eta_minutes": int|null, "recommendations": [string],
  "announcement": { "en": string, "hi": string }
}

The data source is a WebSocket at ws://localhost:8000/ws/risk-events (confirm
actual host/port with Swapnil). Build defensively — the connection may drop or
the feed may pause; the UI should show a clear "reconnecting" state rather than
silently going stale, since network resilience is a judged constraint.

Coding conventions: React + Vite, functional components, hooks, Tailwind for
styling.
```

## Sequential prompts to run in Antigravity

1. "Scaffold a React + Vite app with Tailwind. Create a WebSocket hook (`useRiskEvents`) that connects to `ws://localhost:8000/ws/risk-events`, parses incoming JSON events matching this shape: [paste contract], stores the latest event per zone_id in state, and exposes a `connectionStatus` ('connecting'|'connected'|'disconnected') so the UI can show reconnect states."

2. "Build a live map view using Leaflet with a fixed mock venue layout (define 4-6 zones with x/y coordinates I can adjust). Each zone renders as a marker colored by risk_level (green/yellow/orange/red) using the latest event data from useRiskEvents, updating in realtime."

3. "Add a heatmap layer to the map using density_per_sqm per zone, and a sidebar panel listing all zones sorted by risk_score descending, showing zone_name, risk_level, eta_minutes, and recommendations, with a prominent alert banner when any zone is 'high' or 'critical'."

4. "Add a trend analytics view using Recharts: a line chart showing risk_score over the last 10 minutes per zone, built by keeping a rolling client-side history of incoming events per zone_id."

5. "Add a simplified 2D digital twin view: an SVG top-down diagram of the venue with the same zones drawn to scale, color-coded by risk_level, and gates visually shown as open/closed based on whether a 'close_gate' or 'open_gate' recommendation is currently active for that zone."
