# CrowdShield — Project Plan (TechNova Round 2)

## 1. Problem, one paragraph
Predict crowd crush / stampede risk *before* it happens (not just show a live heatmap), and recommend interventions (gate open/close, reroute, announcements). Deliverables: mobile app + reporting portal, architecture diagram + source, ≤10-slide pitch deck + demo video, documentation (tech choices, assumptions, ethics/compliance). Judged on: Innovation 40%, Technical Feasibility 30%, User Friendliness 20%, Data Ethics & Privacy 10%.

## 2. Architecture

```
[Camera / sample video feed]
        │
        ▼
[Vision Engine] ── density, flow speed, bottleneck detection      ← Swapnil
        │
        ▼
[Risk Engine] ── risk score + time-to-risk + recommendation       ← Swapnil
        │
        ▼
[Realtime Pipeline] ── WebSocket broadcast of "risk events"       ← Swapnil
        │
   ┌────┴─────┐
   ▼          ▼
[Dashboard]  [Mobile App]
Zahid        Haripriya
```

## 3. THE SHARED CONTRACT (read this first, all three of you)

This is the single most important thing for working in parallel without blocking each other. Swapnil's engine and everyone else's UI only need to agree on **the shape of the data**, not on how it's produced. So:

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
  "announcement": {
    "en": "Please move calmly towards Gate 5.",
    "hi": "कृपया शांति से गेट 5 की ओर बढ़ें।"
  }
}
```

**Day 1 priority for Swapnil:** stand up a mock WebSocket/REST server that emits fake events in exactly this shape (randomized/scripted, no real model needed yet). This means Zahid and Haripriya can start building their real UI against real-looking data from day 1, instead of waiting on the ML model to work. Swapnil then swaps the mock generator for the real vision+risk engine later — nobody else's code has to change.

## 4. Roles — one-line summary

| Person | Owns | Why this split |
|---|---|---|
| **Swapnil** | Vision engine, risk prediction, recommendation logic, realtime pipeline, mock data server | Hardest, most judge-differentiating part (Innovation 40%) — needs deepest technical ownership |
| **Zahid** | Backend API, command dashboard, digital twin view (bonus) | Needs to consume the contract and turn it into something visual/operational |
| **Haripriya** | Mobile app, multilingual alerts, voice command (bonus), docs/pitch deck/demo video ownership | Citizen-facing + the mandatory deliverables that get forgotten under time pressure |

Full detail for each is in their own file — `01_SWAPNIL_PLAN.md`, `02_ZAHID_PLAN.md`, `03_HARIPRIYA_PLAN.md`.

## 5. Suggested timeline (adjust to your actual hackathon window)

| Phase | Swapnil | Zahid | Haripriya |
|---|---|---|---|
| Day 1 | Repo scaffold + mock WebSocket server emitting the contract | Dashboard skeleton consuming mock server | Mobile app skeleton consuming mock server |
| Day 2–3 | Real density estimation on sample video | Live map + heatmap + risk zones | Push notifications + incident reporting screen |
| Day 3–4 | Risk prediction (trend → score → ETA) | Analytics/trend charts + digital twin bonus | Multilingual alert text + voice bonus |
| Day 5 | Recommendation engine (LLM-generated interventions) | Polish dashboard, connect real engine | Polish app, connect real engine |
| Day 6 | Integration + bug fixes (everyone) | Integration + bug fixes | Docs, pitch deck, demo video recording |
| Day 7 | Buffer / rehearse demo | Buffer / rehearse demo | Finalize submission package |

## 6. Repo structure

```
crowdshield/
├── vision-engine/       (Swapnil)
├── risk-engine/         (Swapnil)
├── pipeline/            (Swapnil)
├── backend/             (Swapnil + Zahid)
├── dashboard/           (Zahid)
├── mobile-app/          (Haripriya)
├── docs/                (Haripriya owns, everyone contributes)
├── architecture-diagram/
└── README.md
```

## 7. Branches
`main` → `dev` (optional integration branch) → `feature/swapnil`, `feature/zahid`, `feature/haripriya`. If you want exactly 4 branches as you said, skip `dev` and just do: `main`, `swapnil`, `zahid`, `haripriya` — merge each into `main` via PR once a piece is stable.
