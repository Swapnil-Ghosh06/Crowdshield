# CrowdShield — Haripriya's Setup Guide

## What's here

```
mock-server/
  server.js               Node.js WebSocket server — fake risk events, no ML needed
  package.json

screens/
  HomeScreen.js           All zones list + live risk badges + language toggle + I'm Safe button
  MyZoneScreen.js         Zone picker + push notifications + evacuation route
  ReportScreen.js         Citizen incident reporting form
  AssistantScreen.js      AI-powered chat assistant (Groq Llama 3.1)

components/
  ZoneCard.js             Single zone card (animated pulse on critical)
  SafeCheckInButton.js    Floating I'm Safe button with pulse animation
  SafeCheckInModal.js     I'm Safe check-in modal with zone picker + share
  EvacuationRouteModal.js Evacuation route modal with venue map + exit guidance

hooks/
  useRiskFeed.js          WebSocket hook — auto-reconnects, keeps latest event per zone

constants/
  theme.js                Design tokens (colors, spacing, risk level config)

docs/
  architecture.md         Mermaid system architecture + data ethics diagrams
  data_ethics.md          Privacy by design documentation
  techstack.md            Final tech stack table + free tier breakdown

storage.js                AsyncStorage utility for check-in persistence
App.js                    Expo entry point + bottom tab navigator (4 tabs)
```

---

## 1. Start the mock server

```powershell
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

Test it: `curl http://localhost:8000/zones` — you'll get **4 zones** with fake data.

> **Note:** The mock server uses exactly 4 zones matching the backend contract:
> - gate_1 = South Entrance
> - gate_2 = West Entrance
> - gate_3 = North Entrance
> - gate_4 = East Entrance

---

## 2. Start the Expo app

```powershell
npm install
npx expo start
```

Then press `w` for web browser, `a` for Android emulator, or scan the QR code with Expo Go on your phone.

> **Testing on a physical device?** Both your phone and laptop must be on the same WiFi.
> Update `WS_URL` in `HomeScreen.js` from `ws://localhost:8000/...`
> to `ws://<YOUR_MACHINE_IP>:8000/ws/risk-events`
>
> **Connecting to Swapnil's backend?** Replace localhost with his machine's IP address.
> Ask him for it and update the `.env` file:
> ```
> EXPO_PUBLIC_WS_URL=ws://SWAPNIL_IP:8000/ws/risk-events
> EXPO_PUBLIC_API_URL=http://SWAPNIL_IP:8000
> ```

---

## 3. What you'll see

### Tab 1 — All Zones
- All 4 zones listed, sorted: critical → high → medium → low
- Color-coded risk badges (green / yellow / orange / red)
- Critical zones pulse red with animated glow
- Alert banner at top when any zone is high or critical
- Multilingual toggle (EN ↔ HI) — switches announcement text on all cards
- Live connection status bar (green dot = connected, yellow = reconnecting)
- Summary pills: how many critical / high / total zones
- Floating 🛡️ I'm Safe button (bottom right corner)

### Tab 2 — My Zone
- Zone picker dropdown — select which zone you're near
- Live status card for your selected zone (risk level, density, flow speed, ETA)
- Push notification fires when your zone transitions to high or critical
- Language toggle for announcement text
- 🧭 Get Evacuation Route button — shows safest exit based on current risk level

### Tab 3 — Report Incident
- Zone picker (live from feed)
- Category grid: Overcrowding / Medical Emergency / Blocked Exit / Other
- Description field (max 200 chars with live counter)
- Submits to `POST /report` endpoint
- Success confirmation state with "Report another" reset button

### Tab 4 — AI Assistant
- Chat-style UI with user and assistant bubbles
- Powered by Groq Llama 3.1 8B Instant (free tier)
- Live zone data injected into every message as context
- Animated typing indicator while waiting for response
- Ask anything: "Which zones are safe?", "What should I do near Gate 3?"

---

## 4. New features added (beyond original plan)

### 🛡️ I'm Safe Check-in
A floating green shield button on the Home screen. Tap to mark yourself safe — opens a modal with your current zone, timestamp, and last check-in time. Includes a Share button to notify family/contacts. Button pulses green for 30 minutes after check-in. Data stored locally via AsyncStorage.

### 🧭 Evacuation Route
A "Get Evacuation Route" button on the My Zone screen. Shows real-time exit guidance based on current risk level:
- **Low/Medium** — nearest exit is safe, no action needed
- **High** — alternate exit recommended, lists specific steps from recommendations
- **Critical** — EVACUATE NOW alert with bilingual announcement
Includes a visual venue map with your zone highlighted and a directional exit arrow. Share button to send route to contacts.

---

## 5. Environment variables

Create a `.env` file in the root (already in `.gitignore` — never commit this):

```
EXPO_PUBLIC_WS_URL=ws://localhost:8000/ws/risk-events
EXPO_PUBLIC_API_URL=http://localhost:8000
EXPO_PUBLIC_GROQ_KEY=your-groq-key-here
```

Get a free Groq API key at **console.groq.com** — no credit card needed.

---

## 6. Shared data contract

Everything in this app depends on this shape — do not change field names:

```json
{
  "zone_id": "gate_1",
  "zone_name": "South Entrance",
  "timestamp": "2026-08-08T18:42:00Z",
  "density_per_sqm": 4.2,
  "flow_speed_mps": 0.3,
  "risk_score": 0.78,
  "risk_level": "high",
  "eta_minutes": 6,
  "recommendations": ["open_gate_2", "redirect_flow_west"],
  "announcement": {
    "en": "Please move calmly towards Gate 2.",
    "hi": "कृपया शांति से गेट 2 की ओर बढ़ें।"
  }
}
```

When Swapnil's real engine is running, just update `EXPO_PUBLIC_WS_URL` in `.env` — nothing else changes.

---

## 7. Deliverables completed

**Mobile App:**
- [x] Expo app running with `npx expo start`
- [x] WebSocket hook connecting to pipeline — auto-reconnects
- [x] Home screen: 4 zones, live risk badges, language toggle, alert banner
- [x] My Zone screen: zone picker, push notifications on high/critical
- [x] Zone detail: risk level, density, flow speed, ETA, recommendations
- [x] Incident reporting form with success state
- [x] AI Assistant screen powered by Groq
- [x] I'm Safe check-in with share + AsyncStorage
- [x] Evacuation route with venue map and exit guidance

**Docs:**
- [x] `architecture.md` — Mermaid system flowchart + data ethics diagram
- [x] `data_ethics.md` — privacy by design, covers 10% judging criterion
- [x] `techstack.md` — final stack table + free tier breakdown
- [x] Pitch deck — 10 slides (submitted separately)
- [x] Process flow diagram
- [x] Use case diagram
- [x] Architecture diagram (horizontal, slide-ready)
- [x] Tech stack diagram
- [ ] Demo video — to be recorded after full integration with Swapnil's backend
