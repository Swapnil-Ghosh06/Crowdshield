# CrowdShield — Haripriya's Setup Guide

## What's here

```
mock-server/        Node.js WebSocket server — fake risk events, no ML needed
mobile-app/
  App.js            Expo entry point
  screens/
    HomeScreen.js   Zone list with live risk badges + language toggle
  components/
    ZoneCard.js     Single zone card (animated pulse on critical)
  hooks/
    useRiskFeed.js  WebSocket hook — auto-reconnects, keeps latest event per zone
  constants/
    theme.js        Design tokens (colors, spacing, risk level config)
```

---

## 1. Start the mock server

```bash
cd mock-server
npm install
npm start
```

You should see:
```
CrowdShield mock server running
  WS  → ws://localhost:8000/ws/risk-events
  REST → http://localhost:8000/zones
  Health → http://localhost:8000/health
```

Test it: `curl http://localhost:8000/zones` — you'll get 6 zones with fake data.

---

## 2. Start the Expo app

```bash
cd mobile-app
npx expo init . --template blank   # if not already initialized
npm install                        # install dependencies
npx expo start
```

Then press `i` for iOS simulator, `a` for Android, or scan the QR code with Expo Go.

> **Testing on a physical device?** Change `WS_URL` in `HomeScreen.js` from
> `ws://localhost:8000/...` to `ws://<YOUR_MACHINE_IP>:8000/ws/risk-events`

---

## 3. What you'll see

- All 6 zones listed, sorted: critical → high → medium → low
- Color-coded risk badges (green / yellow / red / hot pink)
- Critical zones pulse red
- Multilingual toggle (EN ↔ HI) — switches the announcement text on cards
- Live connection status bar at the top
- Summary pills: how many critical / high zones total

---

## Next steps (in order)

- [ ] **Step 2** — Zone picker ("I'm near Gate 3") + push notifications via Expo Notifications
- [ ] **Step 3** — Incident reporting screen
- [ ] **Step 4** — Expand language support via LLM at request time
- [ ] **Step 5** — Voice/text assistant screen (LLM call with current zone data as context)
- [ ] **Step 6** — Docs, pitch deck, demo video

---

## Shared contract reminder

Everything downstream of `useRiskFeed` depends on this shape — don't change field names:

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
  "recommendations": ["open_gate_5"],
  "announcement": { "en": "...", "hi": "..." }
}
```

When Swapnil's real engine is ready, you just point `WS_URL` at his server — nothing else changes.
