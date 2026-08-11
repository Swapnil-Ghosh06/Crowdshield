# CrowdShield — Tech Stack

> **Version:** 1.0 | **Last updated:** 2026-08-11

This document describes every technology choice made in CrowdShield, the rationale behind each choice, and the constraints that drove it. Any team member adding a new dependency should update this file.

---

## System Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                         CrowdShield                              │
│                                                                  │
│  ┌─────────────┐    ┌─────────────┐    ┌──────────────────────┐ │
│  │Vision Engine│───▶│ Risk Engine │───▶│  Realtime Pipeline   │ │
│  │  (OpenCV +  │    │ (Pure Python│    │ (FastAPI + WebSocket) │ │
│  │   YOLO/CSR) │    │  scoring)   │    │                      │ │
│  └─────────────┘    └─────────────┘    └──────────┬───────────┘ │
│                                                   │              │
│                              ┌────────────────────┤             │
│                              ▼                    ▼             │
│                    ┌──────────────────┐  ┌──────────────────┐  │
│                    │ Command Dashboard │  │   Mobile App     │  │
│                    │ (React + Vite)   │  │ (React Native /  │  │
│                    │                  │  │    Expo)         │  │
│                    └──────────────────┘  └──────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Component Breakdown

---

### 1. Vision Engine
**Owner:** Swapnil | **Directory:** `vision-engine/`

| Layer | Technology | Version | Rationale |
|---|---|---|---|
| Language | Python | 3.11+ | Ecosystem for CV/ML is unmatched; async support for pipeline integration |
| Computer Vision | OpenCV (`opencv-python`) | 4.x | Industry-standard frame processing; handles RTSP, MP4, and webcam inputs |
| Person Detection | YOLOv8 (Ultralytics) | 8.x | Fast, accurate head/body detection; pre-trained on COCO; runs on CPU for demo |
| Fallback model | CSRNet | — | Density-map based counting; alternative if YOLO proves too slow |
| NumPy | numpy | 1.26+ | Frame-level array math for density grid computation |

**Why YOLO over a pure density map?** YOLO gives bounding boxes, making it easier to compute flow vectors (centroid tracking across frames). CSRNet is a fallback for GPU-constrained environments where detection speed matters more than spatial precision.

**Privacy constraint:** Frames are never persisted. The detection pipeline outputs a per-zone person count and average optical-flow vector, then the frame buffer is dropped.

---

### 2. Risk Engine
**Owner:** Swapnil | **Directory:** `risk-engine/`

| Layer | Technology | Rationale |
|---|---|---|
| Language | Python | Shared runtime with vision engine; no serialisation overhead |
| Math | Pure Python + stdlib | Scoring formula is a transparent weighted linear combination — no ML black box that judges can't interrogate |
| Future LLM integration | Gemini API / Claude API | For recommendation phrasing and multilingual announcement generation |

**Scoring approach (explainable by design):**
```
density_factor  = min(density_per_sqm / 7.0,  1.0)   # 7 p/sqm = maximum danger
flow_factor     = max(0.0, 1.0 - flow_speed_mps / 1.5)  # low speed → jammed crowd

risk_score = (density_factor × 0.65) + (flow_factor × 0.35)
```

The coefficients (0.65 / 0.35) are based on published crowd-safety literature showing density is the primary predictor of crush events. This can be explained verbally in 30 seconds during a demo.

---

### 3. Realtime Pipeline
**Owner:** Swapnil | **Directory:** `pipeline/`

| Layer | Technology | Version | Rationale |
|---|---|---|---|
| Web framework | FastAPI | ≥ 0.111 | First-class async WebSocket support; auto-generates OpenAPI docs; minimal boilerplate |
| ASGI server | Uvicorn (standard) | ≥ 0.29 | Production-grade async server; `--reload` for dev; `[standard]` installs `websockets` extras |
| WebSocket protocol | `websockets` | ≥ 12.0 | RFC 6455 compliant; integrates transparently with FastAPI's WS handler |
| Data validation | Pydantic v2 | ≥ 2.7 | Schema validation at the boundary; `model_dump()` for zero-overhead serialisation |
| CORS | FastAPI built-in middleware | — | `allow_origins=["*"]` for dev; to be restricted per-domain before production |

**Key design decisions:**
- `MOCK_MODE` environment variable is the only thing that changes between mock and live. Both modes expose the exact same `generate_all_zones() -> list[RiskEvent]` interface.
- The broadcast loop is a single `asyncio.Task` — events are serialised once and fanned out to all clients, keeping CPU cost flat regardless of connection count.
- `GET /events/latest` keeps a `dict[zone_id → event]` in memory so REST clients never trigger a new generation cycle.

**API surface:**
| Endpoint | Protocol | Description |
|---|---|---|
| `/ws/risk-events` | WebSocket | Live stream of all-zone events every 3 s |
| `GET /events/latest` | HTTP/REST | Latest snapshot per zone (dict keyed by `zone_id`) |
| `GET /health` | HTTP/REST | Liveness probe with `mode` and `active_connections` |
| `GET /docs` | HTTP | Auto-generated Swagger UI (FastAPI built-in) |

---

### 4. Command Dashboard
**Owner:** Zahid | **Directory:** `dashboard/`

| Layer | Technology | Version | Rationale |
|---|---|---|---|
| Framework | React | 18.x | Component model ideal for realtime data; large hiring ecosystem; Zahid's primary language |
| Build tool | Vite | 5.x | Sub-second HMR; near-zero config; ES modules native |
| Styling | Tailwind CSS | 3.x | Utility-first; consistent design tokens without a custom design system |
| Map | Leaflet + react-leaflet | 1.9.x / 4.x | Open-source; no API key required for demo; adequate for a mock venue layout |
| Heatmap | leaflet.heat | — | Lightweight heatmap plugin for Leaflet; driven by `density_per_sqm` |
| Charts | Recharts | 2.x | React-native chart library; composable; excellent for rolling time-series |
| WebSocket client | Native browser WebSocket | — | No library needed; used inside a custom `useRiskEvents` hook |
| State management | React built-in (`useState`, `useRef`) | — | Event state is local and zone-keyed; no Redux/Zustand required at this scale |

**Bonus feature stack:**
| Feature | Technology |
|---|---|
| Digital twin view | SVG (inline React) with zone polygons driven by `risk_level` |

---

### 5. Mobile App
**Owner:** Haripriya | **Directory:** `mobile-app/`

| Layer | Technology | Version | Rationale |
|---|---|---|---|
| Framework | React Native (Expo) | SDK 51 | Cross-platform (iOS + Android) from one codebase; Expo managed workflow minimises native tooling setup during hackathon |
| WebSocket | Native WebSocket API | — | Available in React Native runtime without extra packages |
| Push notifications | Expo Notifications | — | Handles permission flow and device token registration; works in Expo Go for dev testing |
| Localisation | i18n-js or inline toggle | — | Simple `lang` state switch between `announcement.en` and `announcement.hi`; full i18n library if extending languages |
| Navigation | Expo Router | — | File-based routing; minimal setup |

**Bonus feature stack:**
| Feature | Technology |
|---|---|
| Voice/text assistant | LLM API (Gemini/Claude) called with current zone data as context |
| Incident photo upload | `expo-image-picker` |

---

### 6. Shared Infrastructure

| Concern | Approach |
|---|---|
| **Python env isolation** | `venv` (project root) — each team member activates before running any Python command |
| **Package management** | `pip` + `requirements.txt` per sub-project folder |
| **Environment variables** | `.env` file (gitignored) + `os.getenv()` with documented defaults |
| **Version control** | Git + GitHub (`Swapnil-Ghosh06/Crowdshield`) |
| **Branch strategy** | `main` (stable) ← `swapnil`, `zahid`, `haripriya` branches via PRs |
| **API documentation** | Auto-generated Swagger UI at `http://localhost:8000/docs` |
| **Linting / formatting** | Not enforced for hackathon MVP — PEP-8 style by convention |

---

## Dependency Version Summary

### Python (`pipeline/requirements.txt`)
```
fastapi>=0.111.0
uvicorn[standard]>=0.29.0
websockets>=12.0
pydantic>=2.7.0
```

### Vision Engine (planned)
```
opencv-python>=4.9.0
ultralytics>=8.2.0      # YOLOv8
numpy>=1.26.0
```

### Dashboard (`dashboard/package.json` — planned)
```
react@^18
vite@^5
tailwindcss@^3
react-leaflet@^4
recharts@^2
```

### Mobile App (`mobile-app/package.json` — planned)
```
expo@^51
expo-notifications
expo-router
```

---

## Architecture Decisions Log

| Decision | Alternatives Considered | Chosen Rationale |
|---|---|---|
| FastAPI over Flask | Flask, Django | Async-native; WebSocket support built-in; Pydantic integration |
| Pydantic v2 over dataclasses | dataclasses, TypedDict | Validation + serialisation in one; auto-generates OpenAPI schema |
| YOLO over CSRNet | CSRNet, MobileNet | Faster inference on CPU; bounding boxes enable flow tracking |
| React Native (Expo) over Flutter | Flutter, native Swift/Kotlin | Team familiarity; faster scaffold; JS shared with dashboard |
| Leaflet over Mapbox | Mapbox GL JS, Google Maps | No API key; no billing risk during hackathon |
| Linear scoring over ML model | Regression, neural net | Explainable in live demo; no training data dependency; fast iteration |
