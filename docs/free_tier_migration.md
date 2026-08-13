# CrowdShield — Free-Tier Migration & Architecture Update
**Date:** August 2026 | **Author:** Swapnil | **Audience:** Team (Swapnil, Zahid, Haripriya)

---

## 📌 Executive Summary
We have completed a full **free-tier audit and upgrade** across the CrowdShield backend.
- **Removed:** Paid Anthropic Claude API requirement.
- **Added:** A **4-layer cascading LLM fallback** using generous free-tier APIs and zero-network deterministic rule templates.
- **Impact on Frontend / Mobile:** **Zero breaking changes.** All WebSocket endpoints, REST endpoints, and wire JSON data contracts remain 100% identical.

---

## 🔄 1. What Changed Under the Hood

### 4-Layer LLM Cascade Architecture
Instead of relying on a single paid API, announcements are generated through an automatic failover cascade:

```
[Live Risk Event]
       │
       ▼
[Layer 1: Google Gemini 1.5 Flash] ──(Success)──► Return Bilingual Announcement (used_llm="gemini")
       │ (Fails / Rate-limit / Missing Key)
       ▼
[Layer 2: Groq Llama 3.1 8B Instant] ──(Success)──► Return Bilingual Announcement (used_llm="groq")
       │ (Fails / Rate-limit / Missing Key)
       ▼
[Layer 3: Cohere Command R] ──(Success)──► Return Bilingual Announcement (used_llm="cohere")
       │ (Fails / Rate-limit / Missing Key)
       ▼
[Layer 4: Deterministic Rule Templates] ──► Guaranteed Fallback (Zero network, never fails)
```

### Free Tier Limits & Benefits
1. **Google Gemini (Layer 1 - Primary):** Free tier allows 15 RPM / 1M TPM / 1,500 requests per day.
2. **Groq Cloud (Layer 2 - Secondary):** Free tier allows 30 RPM / 14,400 requests per day with ultra-low inference latency (~200ms).
3. **Cohere (Layer 3 - Tertiary):** Free trial key with 1,000 monthly API calls.
4. **Rule Templates (Layer 4 - Quaternary):** Pure Python rule engine that runs locally with zero network calls.

---

## 💻 2. Impact on Zahid (Command Dashboard)

### ✅ What Stays the Same:
* **Endpoints:** All endpoints remain identical.
* **WebSocket URL:** `ws://localhost:8000/ws/risk-events` (broadcasts array of zone events every 3s).
* **Data Contract:** The JSON event schema has **not changed**:
  ```json
  {
    "zone_id": "gate_1",
    "zone_name": "South Entrance",
    "timestamp": "2026-08-11T18:42:00Z",
    "density_per_sqm": 4.2,
    "flow_speed_mps": 0.3,
    "risk_score": 0.78,
    "risk_level": "high",
    "eta_minutes": 6,
    "recommendations": ["deploy_staff_gate_1", "open_gate_2", "redirect_flow_west"],
    "announcement": {
      "en": "Attention: High crowd density at South Entrance. Please follow marshal instructions...",
      "hi": "महत्वपूर्ण सूचना: South Entrance पर अत्यधिक भीड़ है..."
    }
  }
  ```

### ℹ️ Architecture Clarification (Database vs. In-Memory):
* **No Database Needed:** CrowdShield is designed as a zero-latency in-memory streaming pipeline (satisfies the **10% Data Ethics & Privacy** hackathon criteria by not persisting visitor telemetry or raw video).
* **Trend Charts (Recharts):** In accordance with `02_ZAHID_PLAN.md` (Step 4), history for the line chart is stored **client-side** in React state using a rolling window of the incoming WebSocket ticks.

---

## 📱 3. Impact on Haripriya (Mobile App + Assistant + Docs)

### ✅ What Stays the Same:
* **Mobile Alerts:** Consumes `announcement.en` and `announcement.hi` exactly as before for language toggles and push notifications.

### 💡 Opportunities for Bonus Features:
* **Voice/Text Assistant Screen (Step 5 in your plan):** You can use the free Gemini or Groq SDKs already in the repo rather than worrying about paid API credits.
* **Documentation & Pitch Deck (Step 6 in your plan):**
  * Highlight the **"4-Layer Multi-Provider LLM Cascade"** in your architecture diagram and pitch deck.
  * Judges love seeing high fault-tolerance, zero single-points-of-failure, and 100% free-tier cost sustainability.

---

## 🔌 4. API Endpoints Reference

| Protocol | Route | Method | Description |
|---|---|---|---|
| **WebSocket** | `/ws/risk-events` | `WS` | Main real-time event feed. Pushes latest snapshot immediately on connect, then every 3s. |
| **REST** | `/events/latest` | `GET` | Returns latest snapshot dictionary keyed by `zone_id`. |
| **REST** | `/health` | `GET` | Health check probe with mode (`mock`/`live`), client count, and timestamps. |
| **REST** | `/demo/scenario?scenario=before` | `POST` | Replays 3-minute unmanaged crush incident over WebSocket. |
| **REST** | `/demo/scenario?scenario=after` | `POST` | Replays 3-minute CrowdShield early warning intervention. |
| **Docs** | `/docs` | `GET` | Interactive Swagger UI. |

---

## 🔑 5. Environment Variables (`.env.example`)

Copy `.env.example` to `.env` if you want to test with real LLM keys:

```env
# Pipeline Server Configuration
MOCK_MODE=true
VIDEO_PATH=sample.mp4
BROADCAST_INTERVAL=3

# Vision Engine
ZONE_AREA_SQM=50.0
VISION_SAMPLE_INTERVAL=3.0
DETECTOR_BACKEND=hog

# 4-Layer LLM Cascade
LLM_CASCADE_ENABLED=true
RECOMMENDATIONS_USE_LLM=true

# Free API Keys (Optional — if missing, automatically falls back to Layer 4 rule templates)
GEMINI_API_KEY=your_gemini_key_here
GROQ_API_KEY=your_groq_key_here
COHERE_API_KEY=your_cohere_key_here
```

> **Note:** If no API keys are provided or `LLM_CASCADE_ENABLED=false`, the server automatically and silently uses the deterministic Layer 4 bilingual templates. The backend will **never crash** due to missing API keys or network drops.

---

## 🧪 6. Testing & Verification

All 33 automated backend unit and integration tests are passing:
```bash
# Run risk engine + LLM cascade tests
python -m unittest discover -s crowdshield/risk-engine/tests -p "test_*.py" -v

# Run vision engine tests
python -m unittest discover -s crowdshield/vision-engine/tests -p "test_*.py" -v
```
- **Risk Engine Tests:** 22/22 passed
- **Vision Engine Tests:** 11/11 passed
