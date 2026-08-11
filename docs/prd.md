# CrowdShield — Product Requirements Document (PRD)

> **Hackathon:** TechNova Round 2  
> **Version:** 1.0  
> **Last updated:** 2026-08-11  
> **Status:** Active Development

---

## 1. Problem Statement

Every year, crowd crushes at concerts, religious gatherings, and sporting events cause preventable deaths. The common failure mode is always the same: operators only notice dangerous density levels *after* the situation is already out of control — when crowd management is no longer effective and evacuation becomes the only option.

Existing CCTV-based systems show a live picture but do not **predict** what will happen next. They generate no proactive recommendations and have no built-in escalation path.

**CrowdShield** solves this by turning raw video feeds into a predictive risk signal with an ETA — giving operators a window of 6–15 minutes to intervene before a crush becomes a casualty.

---

## 2. Target Users

| User Persona | Description | Primary Touchpoint |
| --- | --- | --- |
| **Event Safety Officer** | Experienced operator monitoring 4–16 zones simultaneously from a control room | Command Dashboard (web) |
| **Gate Marshal** | Staff member physically present at a zone gate | Mobile App (citizen-facing) |
| **Event Attendee / Citizen** | Person inside the venue who needs to navigate safely | Mobile App |
| **Venue Director** | Senior stakeholder who reviews post-event reports | Dashboard + Analytics |

---

## 3. Goals and Non-Goals

### Goals (in-scope for hackathon MVP)

- **G1 — Predictive risk scoring**: compute a risk score (0–1) and an ETA-to-critical estimate from density + flow speed, updating every 3 seconds.
- **G2 — Realtime multi-zone broadcast**: push events for all 4 zones simultaneously over WebSocket so every connected client stays in sync.
- **G3 — Operator command dashboard**: a web UI showing a live map, heatmap overlay, per-zone risk panel, and trend charts.
- **G4 — Citizen mobile app**: push alerts, zone-based warnings, multilingual announcements (English + Hindi), and incident reporting.
- **G5 — Intervention recommendations**: rule-based actions (open alternate gate, redirect flow, deploy staff) surfaced per zone per risk level.
- **G6 — Bilingual PA text**: every event carries a `announcement.en` and `announcement.hi` field ready for public address broadcast.
- **G7 — Mock-first development**: a mock server emitting contract-compliant events so the dashboard and mobile app can be built independently of the real AI model.

### Non-Goals (out of scope for MVP)

- Raw video storage or cloud streaming (privacy constraint — see §9)
- More than 4 zones in the demo (scaffolded to scale, but demo is fixed at 4)
- Real GPS integration in the mobile app (simulated location picker for MVP)
- Multi-venue or multi-event orchestration
- Payment or ticketing integration

---

## 4. Key Features

### 4.1 Vision Engine (Swapnil)

- Accept a video file or RTSP stream per zone
- Run frame-by-frame person/head detection
- Output `density_per_sqm` and `flow_speed_mps` every 3 seconds
- Anonymise at the edge — no raw frames stored, only aggregate metrics

### 4.2 Risk Engine (Swapnil)

- Rolling-window density + flow trend analysis
- Transparent scoring formula (weighted linear combination, fully explainable)
- Compute `risk_score` (0–1), `risk_level` bucket, and `eta_minutes`
- Emit recommendations based on zone geometry and risk level

### 4.3 Realtime Pipeline (Swapnil)

- FastAPI WebSocket server broadcasting all zone events every 3 seconds
- REST endpoint `GET /events/latest` for stateless polling clients
- `MOCK_MODE` flag to hot-swap between mock generator and real engine

### 4.4 Command Dashboard (Zahid)

- React + Vite web app consuming the WebSocket feed
- Live map with zone markers colour-coded by `risk_level`
- Crowd heatmap overlay driven by `density_per_sqm`
- Sorted risk-zone sidebar with ETA countdown and recommendations
- Risk-over-time trend chart (rolling 10-minute window)
- **Bonus:** 2D digital twin SVG with gate open/close state

### 4.5 Mobile App (Haripriya)

- React Native (Expo) citizen app
- Home screen: all zones + live `risk_level` badge
- Zone-based push notifications on `high`/`critical` crossings
- Language toggle: English ↔ Hindi announcement rendering
- Incident reporting form (zone, category, description, optional photo)
- **Bonus:** Voice/text assistant querying current zone risk from LLM

---

## 5. Success Criteria

| ID | Criterion | Measurement |
| --- | --- | --- |
| SC-1 | System predicts crush risk ≥ 6 minutes before density peaks | Demo video shows alert at `eta_minutes=8` before simulated spike |
| SC-2 | All four zones update within 3 seconds of event generation | WebSocket broadcast latency measured in demo |
| SC-3 | Dashboard renders correctly on 1080p display | Manual verification during demo |
| SC-4 | Mobile app delivers push notification within 5 seconds of `high` event | Tested on device during demo |
| SC-5 | Bilingual announcement displayed correctly in both en and hi | Visual check in mobile app language toggle |
| SC-6 | Risk score is fully explainable | Verbal explanation of formula in pitch |

---

## 6. User Stories

### Safety Officer (Dashboard)

- **US-01:** As a safety officer, I want to see all zone risk levels on a single screen so I can spot danger without clicking between tabs.
- **US-02:** As a safety officer, I want to see ETA countdown so I know how long I have before I must act.
- **US-03:** As a safety officer, I want recommended actions displayed per zone so I don't have to think under pressure.
- **US-04:** As a safety officer, I want a trend chart so I can see if a zone is stabilising or still escalating.

### Gate Marshal (Mobile)

- **US-05:** As a gate marshal, I want a push notification the moment my zone goes high-risk so I can act even when not watching the screen.
- **US-06:** As a gate marshal, I want to submit an incident report from my phone without returning to the control room.

### Attendee (Mobile)

- **US-07:** As an attendee, I want a real-time warning if the area I'm in is becoming dangerous.
- **US-08:** As an attendee, I want the warning in Hindi so I can understand it immediately without translation.

---

## 7. Acceptance Criteria by Component

### Pipeline Server

- [ ] WebSocket at `/ws/risk-events` broadcasts all 4 zones every 3 ± 0.5 seconds
- [ ] REST `GET /events/latest` returns `{ zone_id: RiskEvent }` for all zones within 200ms
- [ ] `MOCK_MODE=false` starts without error when `real_engine.py` is present
- [ ] At least one zone reaches `high` or `critical` in every 30–40-second demo window

### Dashboard

- [ ] Connects to WebSocket and renders zone markers within 2 seconds of page load
- [ ] Zone marker colour updates in realtime as `risk_level` changes
- [ ] Alert banner appears when any zone crosses to `high`/`critical`
- [ ] Trend chart shows last 10 minutes of `risk_score` per zone
- [ ] Shows "reconnecting" state on WebSocket disconnect

### Mobile App

- [ ] App launches and lists all zones within 3 seconds
- [ ] Push notification fires within 5 seconds of a `high`/`critical` event
- [ ] Language toggle switches all announcement text between en/hi
- [ ] Incident report form submits and shows confirmation state

---

## 8. Timeline

| Phase | Dates | Milestone |
| --- | --- | --- |
| Day 1 | — | Mock server live; dashboard + app skeletons consuming it |
| Day 2–3 | — | Vision engine outputs real density; dashboard map + heatmap working |
| Day 3–4 | — | Risk engine producing scored events; app push notifications live |
| Day 5 | — | Recommendation engine + LLM announcements; real engine wired into pipeline |
| Day 6 | — | Full integration; bug fixes across all components |
| Day 7 | — | Buffer; demo rehearsal; submission package finalised |

---

## 9. Data Ethics & Privacy

CrowdShield is designed to comply with privacy-by-design principles:

1. **No raw video stored.** Camera frames are processed at the edge (on the local server) and immediately discarded. Only aggregate metrics (`density_per_sqm`, `flow_speed_mps`) leave the device.
2. **No face data captured.** The detection model outputs a person count per region, not face identities.
3. **No personal tracking.** Crowd flow is directional (vector field), not individual tracking — no individual is singled out or followed.
4. **Minimal data retention.** Event data is held in memory for the session duration only; no database persistence in the MVP.
5. **Consent and disclosure.** In a production deployment, venue operators would display signage informing attendees that anonymous crowd-density monitoring is active.

These choices directly address the **Data Ethics & Privacy (10%)** judging criterion.

---

## 10. Open Questions

| # | Question | Owner | Status |
| --- | --- | --- | --- |
| OQ-1 | Will the demo use a pre-recorded video or a live RTSP stream? | Swapnil | Open |
| OQ-2 | How many zones will the physical demo venue layout show on the dashboard? | Zahid | 4 (confirmed) |
| OQ-3 | What languages beyond en/hi should the mobile app support? | Haripriya | en + hi for MVP |
| OQ-4 | Does the incident report need a backend endpoint to persist submissions? | Zahid/Haripriya | Mock endpoint for MVP |
