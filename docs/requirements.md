# CrowdShield — Requirements

> **Version:** 1.0 | **Last updated:** 2026-08-11  
> **Context:** TechNova Round 2 hackathon submission

This document captures all functional and non-functional requirements for CrowdShield. Requirements are tagged with a unique ID, a priority, and the component they belong to.

**Priority scale:** `P0` = must have (demo-blocking) · `P1` = should have · `P2` = nice to have / bonus

---

## 1. Functional Requirements

### 1.1 AI / Data Pipeline (Swapnil)

| ID | Priority | Requirement |
|---|---|---|
| FR-P-01 | P0 | The pipeline MUST expose a WebSocket endpoint at `/ws/risk-events` that broadcasts events for all 4 zones every 3 seconds. |
| FR-P-02 | P0 | Each broadcast event MUST conform exactly to the data contract defined in `docs/schema.md`. No extra or missing fields. |
| FR-P-03 | P0 | The pipeline MUST expose `GET /events/latest` returning the most recent snapshot per zone as a JSON object keyed by `zone_id`. |
| FR-P-04 | P0 | The `MOCK_MODE` environment variable MUST control whether synthetic or real data is emitted, with no other code changes required to switch. |
| FR-P-05 | P0 | At least one zone MUST reach `risk_level: "high"` or `"critical"` within every 30–40 second window during the demo to demonstrate the alert lifecycle. |
| FR-P-06 | P0 | The risk score formula MUST be fully transparent, documented, and explainable verbally in ≤ 60 seconds (no black-box ML for the scoring step). |
| FR-P-07 | P1 | The vision engine SHOULD accept a video file path and output per-zone `density_per_sqm` and `flow_speed_mps` sampled every 3 seconds. |
| FR-P-08 | P1 | The recommendation engine SHOULD produce a rule-based list of intervention tokens (see `docs/schema.md §4`) appropriate to the zone ID and risk level. |
| FR-P-09 | P1 | Announcement text SHOULD be generated or retrieved in both English and Hindi for every event. |
| FR-P-10 | P2 | The recommendation engine MAY call an LLM API to phrase announcements naturally in languages beyond English and Hindi. |
| FR-P-11 | P2 | The vision engine MAY support a live RTSP stream in addition to pre-recorded video files. |

### 1.2 Command Dashboard (Zahid)

| ID | Priority | Requirement |
|---|---|---|
| FR-D-01 | P0 | The dashboard MUST connect to the WebSocket feed and render zone data within 2 seconds of page load. |
| FR-D-02 | P0 | Each zone MUST be displayed as a marker on a map, colour-coded by `risk_level` (green / yellow / orange / red). |
| FR-D-03 | P0 | Marker colours MUST update in realtime as `risk_level` changes, with no manual refresh required. |
| FR-D-04 | P0 | A risk-zone sidebar MUST list all zones sorted by `risk_score` descending, showing `zone_name`, `risk_level`, `eta_minutes`, and `recommendations`. |
| FR-D-05 | P0 | An alert banner MUST appear prominently when any zone reaches `risk_level: "high"` or `"critical"`. |
| FR-D-06 | P0 | The dashboard MUST display a visible "reconnecting…" state when the WebSocket connection is lost. |
| FR-D-07 | P1 | A heatmap overlay SHOULD render crowd density using `density_per_sqm` as the heat intensity signal. |
| FR-D-08 | P1 | A trend chart SHOULD show `risk_score` over the last 10 minutes per zone (client-side rolling buffer). |
| FR-D-09 | P2 | A 2D digital twin SVG view MAY display zones to approximate scale, with gate open/close state reflected when `close_gate` or `open_alternate_gate` is in the active recommendations. |

### 1.3 Mobile App (Haripriya)

| ID | Priority | Requirement |
|---|---|---|
| FR-M-01 | P0 | The app MUST display a home screen listing all zones with their current `risk_level` badge, within 3 seconds of launch. |
| FR-M-02 | P0 | The app MUST deliver a push notification within 5 seconds when a user's selected zone crosses to `risk_level: "high"` or `"critical"`. |
| FR-M-03 | P0 | The push notification body MUST contain the `announcement.en` (or `.hi` based on language preference) text from the event. |
| FR-M-04 | P0 | A language toggle MUST switch all displayed announcement text between English and Hindi. |
| FR-M-05 | P0 | An incident reporting form MUST allow the user to select a zone, a category (overcrowding / medical / blocked exit / other), add free text, and submit. |
| FR-M-06 | P0 | The incident form MUST show a confirmation state after submission. |
| FR-M-07 | P1 | The app SHOULD show a connection-lost state when the WebSocket feed is unavailable. |
| FR-M-08 | P2 | A voice/text assistant screen MAY let a user ask questions about current zone risk and receive LLM-generated answers using live event data as context. |
| FR-M-09 | P2 | An optional photo attachment MAY be supported in the incident report form. |

---

## 2. Non-Functional Requirements

### 2.1 Performance

| ID | Priority | Requirement |
|---|---|---|
| NFR-01 | P0 | WebSocket broadcast latency from event generation to client receipt MUST be ≤ 500ms on localhost. |
| NFR-02 | P0 | `GET /events/latest` MUST respond in ≤ 200ms. |
| NFR-03 | P1 | The vision engine SHOULD process at ≥ 5 frames per second on a standard laptop CPU (no GPU required for demo). |
| NFR-04 | P1 | The dashboard SHOULD handle a minimum of 10 concurrent WebSocket connections without degradation. |

### 2.2 Reliability

| ID | Priority | Requirement |
|---|---|---|
| NFR-05 | P0 | The pipeline server MUST continue emitting events even if the WebSocket client pool is empty (no clients connected). |
| NFR-06 | P0 | The pipeline server MUST prune disconnected WebSocket clients silently without crashing or stalling the broadcast loop. |
| NFR-07 | P0 | The dashboard and mobile app MUST degrade gracefully on WebSocket disconnection — no silent stale state. |
| NFR-08 | P1 | The mock server SHOULD run continuously for ≥ 30 minutes without memory growth (no unbounded state accumulation). |

### 2.3 Privacy & Data Ethics

| ID | Priority | Requirement |
|---|---|---|
| NFR-09 | P0 | Raw video frames MUST NOT be stored on disk or transmitted over the network. |
| NFR-10 | P0 | The system MUST NOT capture, store, or transmit facial recognition data or individual identity information. |
| NFR-11 | P0 | All personally identifiable information (PII) in incident reports MUST be limited to what the user voluntarily provides. |
| NFR-12 | P1 | Crowd flow analysis SHOULD operate on aggregate vectors (optical flow grid), not individual tracking. |

### 2.4 Explainability

| ID | Priority | Requirement |
|---|---|---|
| NFR-13 | P0 | The risk score formula MUST be documented in `docs/schema.md §3` with all coefficients and their rationale. |
| NFR-14 | P0 | Any team member MUST be able to explain a specific risk score verbally (e.g. "it's 0.78 because density is 4.2 p/sqm and flow has slowed to 0.3 m/s") in ≤ 60 seconds during a demo. |

### 2.5 Portability

| ID | Priority | Requirement |
|---|---|---|
| NFR-15 | P0 | The pipeline server MUST run on any system with Python 3.11+ and the packages in `pipeline/requirements.txt`. |
| NFR-16 | P0 | The dashboard MUST render on Chrome 120+ and Firefox 120+. |
| NFR-17 | P1 | The mobile app SHOULD build for both iOS and Android from a single codebase via Expo. |

### 2.6 Developer Experience

| ID | Priority | Requirement |
|---|---|---|
| NFR-18 | P0 | Swapping from `MOCK_MODE=true` to `MOCK_MODE=false` MUST require zero code changes. |
| NFR-19 | P0 | Every Python function in the pipeline and engine modules MUST have a docstring explaining what it does and why. |
| NFR-20 | P1 | The pipeline server SHOULD surface a Swagger UI at `/docs` for manual endpoint testing. |
| NFR-21 | P1 | Environment variables SHOULD be documented in `README.md` with defaults and accepted values. |

---

## 3. Constraints

| Constraint | Detail |
|---|---|
| **Hackathon time limit** | All P0 requirements must be implemented and demo-ready within the 7-day window. |
| **Hardware** | Demo runs on a standard laptop (no cloud GPU, no server rack). |
| **Network** | Demo assumes localhost; no assumption of stable internet. |
| **Cost** | LLM API calls (if used) must stay within free-tier limits or a minimal budget. |
| **Team size** | 3 engineers working in parallel branches; no dedicated QA. |

---

## 4. Assumptions

| ID | Assumption |
|---|---|
| A-01 | The demo venue has 4 zones (gates). The system is designed to scale to more, but only 4 are demoed. |
| A-02 | The mock WebSocket server is sufficient for dashboard and mobile app development until the real vision engine is complete. |
| A-03 | All three team members are running the pipeline server locally; there is no shared staging server during development. |
| A-04 | Incident reports submitted by the mobile app do not need to be persisted beyond the demo session. |
| A-05 | The announcement text (en + hi) is sufficient for the language support demo. Additional languages are a bonus feature only. |
| A-06 | The digital twin view uses a schematic venue layout, not real-world GPS coordinates. |
