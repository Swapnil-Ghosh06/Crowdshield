# CrowdShield

> **AI-powered early-warning system for crowd stampede prevention**  
> TechNova Round 2 · Team: Swapnil, Zahid, Haripriya

---

## What Is CrowdShield?

Every year, crowd crushes at concerts, religious gatherings, and sporting events cause preventable deaths. The failure mode is always the same: operators only detect dangerous crowd density **after** the situation is already out of control.

CrowdShield solves this by:
1. Estimating crowd **density and flow speed** per zone from video in real time
2. Computing a **predictive risk score** with an ETA — giving operators a 6–15 minute intervention window
3. Broadcasting the result over **WebSocket** so a command dashboard and citizen mobile app update simultaneously

---

## Architecture

```
┌───────────────────────────────────────────────────────────────────┐
│                          CrowdShield                              │
│                                                                   │
│  [Camera / Video Feed]                                            │
│          │                                                        │
│          ▼                                                        │
│  [Vision Engine]  ──  density_per_sqm, flow_speed_mps            │
│    OpenCV + YOLOv8          │                    (Swapnil)        │
│                             ▼                                     │
│  [Risk Engine]  ──  risk_score, risk_level, eta_minutes          │
│    Pure Python rules        │                    (Swapnil)        │
│                             ▼                                     │
│  [Realtime Pipeline]  ── WebSocket broadcast every 3s            │
│    FastAPI + Uvicorn        │                    (Swapnil)        │
│                     ┌───────┴────────┐                           │
│                     ▼               ▼                             │
│             [Dashboard]       [Mobile App]                        │
│           React + Vite      React Native/Expo                     │
│             (Zahid)            (Haripriya)                        │
└───────────────────────────────────────────────────────────────────┘
```

---

## Repository Structure

```
crowdshield/
│
├── pipeline/                   # WebSocket server + mock generator (Swapnil)
│   ├── main.py                 # FastAPI app — WS /ws/risk-events + REST /events/latest
│   ├── mock_generator.py       # Synthetic event generator (realistic + spiking)
│   ├── models.py               # Pydantic v2 data contract models (source of truth)
│   └── requirements.txt
│
├── vision-engine/              # Crowd density + flow estimation (Swapnil) [WIP]
├── risk-engine/                # Risk scoring logic (Swapnil) [WIP]
│
├── dashboard/                  # Command dashboard — React + Vite (Zahid) [WIP]
├── mobile-app/                 # Citizen mobile app — Expo (Haripriya) [WIP]
│
├── docs/
│   ├── prd.md                  # Product Requirements Document
│   ├── techstack.md            # Full tech stack with rationale
│   ├── schema.md               # Data contract — the single source of truth
│   └── requirements.md        # Functional + non-functional requirements
│
├── 00_PROJECT_PLAN.md          # Team overview + architecture
├── 01_SWAPNIL_PLAN.md          # Swapnil's detailed build plan
├── 02_ZAHID_PLAN.md            # Zahid's detailed build plan
├── 03_HARIPRIYA_PLAN.md        # Haripriya's detailed build plan
└── README.md                   # This file
```

---

## Branches

| Branch | Owner | Scope |
|---|---|---|
| `main` | — | Stable, integrated, demo-ready code only |
| `swapnil` | Swapnil | Vision engine, risk engine, pipeline |
| `zahid` | Zahid | Backend API + command dashboard |
| `haripriya` | Haripriya | Mobile app + docs + pitch deck |

**Merge flow:** feature branches → `main` via pull request. Never commit directly to `main`.

**Staying up to date:**
```bash
git checkout <your-branch>
git fetch origin
git merge origin/main
```

---

## Quick Start — Pipeline Server

The mock WebSocket server is the first thing to run. Both the dashboard and mobile app connect to it.

### Prerequisites
- Python 3.11+
- A virtual environment (project root has `venv/`)

### 1. Activate the virtual environment

```bash
# From the repo root (crowdshield/)
source venv/bin/activate          # macOS / Linux
# or
venv\Scripts\activate             # Windows
```

### 2. Install dependencies

```bash
cd pipeline
pip install -r requirements.txt
```

### 3. Start the server

```bash
# Mock mode (default — no real camera needed)
MOCK_MODE=true uvicorn main:app --reload --port 8000

# Live mode (requires real_engine.py to be present)
MOCK_MODE=false uvicorn main:app --reload --port 8000
```

### 4. Verify it's working

| Check | URL |
|---|---|
| Health check | [http://localhost:8000/health](http://localhost:8000/health) |
| Latest events (REST) | [http://localhost:8000/events/latest](http://localhost:8000/events/latest) |
| Interactive API docs | [http://localhost:8000/docs](http://localhost:8000/docs) |
| WebSocket feed | `ws://localhost:8000/ws/risk-events` |

### 5. Connect a WebSocket client (quick test)

```javascript
// Paste in browser console
const ws = new WebSocket("ws://localhost:8000/ws/risk-events");
ws.onmessage = e => console.log(JSON.parse(e.data));
```

---

## Environment Variables

| Variable | Default | Accepted Values | Description |
|---|---|---|---|
| `MOCK_MODE` | `true` | `true`, `false`, `1`, `0`, `yes`, `no` | `true` → use mock generator. `false` → import `real_engine.generate_all_zones()`. |

---

## The Shared Data Contract

All components communicate via a single JSON shape. This is defined in full in [`docs/schema.md`](docs/schema.md) and enforced by [`pipeline/models.py`](pipeline/models.py).

```json
{
  "zone_id":         "gate_1",
  "zone_name":       "South Entrance",
  "timestamp":       "2026-08-11T11:21:00Z",
  "density_per_sqm": 4.2,
  "flow_speed_mps":  0.3,
  "risk_score":      0.78,
  "risk_level":      "high",
  "eta_minutes":     6,
  "recommendations": ["open_alternate_gate", "redirect_crowd_flow", "deploy_staff"],
  "announcement": {
    "en": "Crowd density is high. Please move calmly to the nearest exit.",
    "hi": "इस क्षेत्र में भीड़ घनत्व अधिक है। कृपया शांति से निकटतम निकास की ओर जाएं।"
  }
}
```

**⚠ Field changes require updating `pipeline/models.py` + `docs/schema.md` + TypeScript types. Never change silently.**

---

## Risk Zones (Demo)

| Zone ID | Zone Name | Notes |
|---|---|---|
| `gate_1` | South Entrance | Primary entrance; highest baseline traffic |
| `gate_2` | West Entrance | Secondary; staff + VIP |
| `gate_3` | North Entrance | Emergency overflow |
| `gate_4` | East Entrance | Narrow corridor; side exits exist |

---

## Risk Score Formula

```
density_factor = min(density_per_sqm / 7.0, 1.0)
flow_factor    = max(0.0, 1.0 - flow_speed_mps / 1.5)
risk_score     = (density_factor × 0.65) + (flow_factor × 0.35)
```

| `risk_score` | `risk_level` | `eta_minutes` |
|---|---|---|
| 0.00 – 0.34 | `low` | null |
| 0.35 – 0.59 | `medium` | 15 – 30 |
| 0.60 – 0.79 | `high` | 6 – 14 |
| 0.80 – 1.00 | `critical` | 1 – 5 |

Full documentation: [`docs/schema.md §3`](docs/schema.md)

---

## Demo Spike Behaviour

During the demo, the mock generator guarantees at least one zone escalates to `high` or `critical` every **30–40 seconds** using a `time.monotonic()` scheduler (not a random draw). This ensures the alert lifecycle is always visible without waiting.

---

## Documentation Index

| Document | Purpose |
|---|---|
| [`docs/prd.md`](docs/prd.md) | Product Requirements — user stories, goals, acceptance criteria, ethics |
| [`docs/techstack.md`](docs/techstack.md) | Every technology choice with rationale and version pins |
| [`docs/schema.md`](docs/schema.md) | Data contract reference — field types, risk scoring, recommendation catalogue |
| [`docs/requirements.md`](docs/requirements.md) | Full functional (FR-*) and non-functional (NFR-*) requirements |

---

## Privacy & Ethics

CrowdShield is designed privacy-first:

- **No raw video stored.** Frames are processed at the edge and immediately discarded.
- **No faces captured.** The model outputs aggregate person counts, not identities.
- **No individual tracking.** Crowd flow is analysed as a vector field — nobody is followed.
- **Minimal data retention.** Events are held in memory for the session only; no database.

See [`docs/prd.md §9`](docs/prd.md) for the full ethics rationale (addresses the Data Ethics & Privacy judging criterion directly).

---

## Contributing

1. **Always work on your own branch** (`swapnil`, `zahid`, or `haripriya`).
2. **Pull from `main` before starting new work** to avoid merge conflicts.
3. **Do not change the data contract** (`pipeline/models.py` or `docs/schema.md`) without notifying all three team members first.
4. **Write docstrings** on every Python function — it's a requirements criterion.
5. Open a PR into `main` when a stable feature is ready to integrate.

---

## Team

| Person | Role | Branch |
|---|---|---|
| **Swapnil** | Vision engine · Risk engine · Realtime pipeline | `swapnil` |
| **Zahid** | Backend API · Command dashboard | `zahid` |
| **Haripriya** | Mobile app · Docs · Pitch deck · Demo video | `haripriya` |
