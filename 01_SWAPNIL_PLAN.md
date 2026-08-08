# Swapnil's Plan — AI Engine + Realtime Pipeline

Branch: `swapnil` (or `feature/swapnil-ai-engine`)

## Your scope
1. Mock data server (build this FIRST — unblocks Zahid & Haripriya)
2. Vision engine — crowd density + flow speed estimation from video
3. Risk engine — trend → risk score → time-to-risk (ETA)
4. Recommendation engine — rule-based + LLM-generated interventions
5. Realtime pipeline — WebSocket server broadcasting the shared contract (see `00_PROJECT_PLAN.md` section 3)

## Folder structure (your ownership)
```
vision-engine/    density + flow estimation
risk-engine/      risk scoring logic
pipeline/         WebSocket server, mock generator, contract schema
```

## Tech stack
- Python, FastAPI, OpenCV
- Crowd counting model: CSRNet or a YOLO head-detection approach on a public dataset (ShanghaiTech / Mall dataset) or your own recorded sample video
- WebSockets for the realtime feed
- An LLM API call (Claude/Gemini) for turning a risk event into a natural multilingual announcement

## Step-by-step build order

**Step 1 — Mock server (do this before anything else)**
Emits fake but realistic events matching the shared JSON contract every few seconds, for 3–5 zones. This is what Zahid and Haripriya build against immediately.

**Step 2 — Vision engine**
Feed a sample video into a density-estimation model. Output people-per-sqm and flow direction/speed per zone, on a timer/loop.

**Step 3 — Risk engine**
Take a rolling window of density + flow speed. Compute a risk score (0–1) using a transparent, explainable rule (e.g. weighted combination of density gradient + flow deceleration + historical bottleneck rate) rather than a black-box model — this is more defensible under "Technical Feasibility" judging and easier to explain live in the demo.

**Step 4 — Recommendation engine**
Given a risk event, map risk level + zone geometry to a recommendation (open alternate gate, reroute, deploy staff). For announcements, call an LLM to phrase it naturally in English + Hindi (or whichever languages you want to demo).

**Step 5 — Swap pipeline from mock → real**
Once steps 2–4 work, point the WebSocket server at your real engine output instead of the mock generator. Contract format doesn't change, so Zahid/Haripriya's code doesn't need to change.

## Antigravity workspace context (paste this into a Rules file, e.g. `.antigravity/rules.md`, at the start of your session)

```
Project: CrowdShield — AI-powered early warning system for crowd stampede prevention.
My role: I own the vision engine, risk prediction engine, recommendation engine,
and the realtime WebSocket pipeline (Python/FastAPI).

Shared data contract (all output must conform to this shape):
{
  "zone_id": string,
  "zone_name": string,
  "timestamp": ISO8601 string,
  "density_per_sqm": float,
  "flow_speed_mps": float,
  "risk_score": float (0-1),
  "risk_level": "low"|"medium"|"high"|"critical",
  "eta_minutes": int or null,
  "recommendations": [string],
  "announcement": { "en": string, "hi": string }
}

Constraints to respect: low-cost/minimal hardware, must degrade gracefully on
network outages, minimize false alarms, and anonymize any face data (no raw
video should be stored — process density metadata only, per data ethics
requirements).

Coding conventions: Python, FastAPI, type hints, docstrings on every function.
```

## Sequential prompts to run in Antigravity

1. "Scaffold a FastAPI project with a `/ws/risk-events` WebSocket endpoint. Build a mock event generator that emits a JSON object matching the contract above every 3 seconds for 4 zones (gate_1 through gate_4), with randomized but plausible values that occasionally spike into 'high'/'critical' risk to simulate an emerging incident. Include a REST endpoint `/events/latest` that returns the most recent event per zone."

2. "Add a crowd density estimation module under `vision-engine/`. It should accept a video file path, run frame-by-frame head/person detection using a pretrained crowd-counting approach, and output density (people per square meter, assuming a configurable zone area) and average flow speed/direction per frame, sampled every N seconds. Write it so I can plug in either CSRNet or a YOLO-based detector."

3. "Add a `risk-engine/` module that takes a rolling window of density + flow speed readings per zone and computes: (a) a risk_score between 0 and 1, (b) a risk_level bucket, (c) an eta_minutes estimate for when risk_score is likely to cross a critical threshold if the current trend continues. Make the scoring logic transparent and documented — I need to be able to explain exactly why a given score was produced in a live demo."

4. "Add a `recommendations` module that, given a risk event, returns a rule-based list of interventions (e.g. open alternate gate, redirect flow, deploy staff) based on zone_id, risk_level, and adjacent zone capacity. Then add a function that calls an LLM API to turn the recommendation + risk context into a short, calm, multilingual (English + Hindi) public announcement string."

5. "Wire the real vision-engine + risk-engine + recommendations output into the WebSocket pipeline from step 1, replacing the mock generator, but keep the mock generator available behind a feature flag / env var so we can fall back to it instantly if the live model breaks during the demo."
