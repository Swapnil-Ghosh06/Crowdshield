# CrowdShield

AI-powered early warning system for crowd stampede prevention.

## Repo structure

```
crowdshield/
├── vision-engine/       # Crowd density + flow estimation (Swapnil)
├── risk-engine/         # Risk scoring logic (Swapnil)
├── pipeline/            # WebSocket server + mock generator (Swapnil)
├── backend/             # API layer (Zahid + Swapnil)
├── dashboard/           # Command dashboard (Zahid)
├── mobile-app/          # Mobile app (Haripriya)
└── docs/                # Documentation, pitch deck, demo video (Haripriya)
```

## Branches

| Branch | Owner | Purpose |
|---|---|---|
| `main` | — | Stable, integrated code only |
| `swapnil` | Swapnil | Vision engine, risk engine, pipeline |
| `zahid` | Zahid | Backend API + dashboard |
| `haripriya` | Haripriya | Mobile app + docs |

## Shared Data Contract

All components communicate via this JSON shape (emitted every 3s over WebSocket):

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

## Running the mock WebSocket server

```bash
cd pipeline
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

WebSocket feed: `ws://localhost:8000/ws/risk-events`  
REST snapshot: `http://localhost:8000/events/latest`  
Health check: `http://localhost:8000/health`
