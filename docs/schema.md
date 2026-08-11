# CrowdShield — Data Contract & Schema Reference

> **Version:** 1.0 | **Last updated:** 2026-08-11  
> **Source of truth:** [`pipeline/models.py`](../pipeline/models.py)

This document is the canonical reference for every data shape that crosses a component boundary in CrowdShield. **All three sub-teams must conform to this contract exactly.** If you need to add or change a field, update this document and `pipeline/models.py` together — then notify all other owners.

---

## 1. The Risk Event

This is the single most important object in the system. The pipeline emits an array of these every 3 seconds over WebSocket, and the REST endpoint returns a dict of these keyed by `zone_id`.

### 1.1 JSON Wire Format

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
    "en": "Crowd density is high in this area. Please move calmly to the nearest exit.",
    "hi": "इस क्षेत्र में भीड़ घनत्व अधिक है। कृपया शांति से निकटतम निकास की ओर जाएं।"
  }
}
```

### 1.2 Field Reference

| Field | Type | Required | Constraints | Description |
|---|---|---|---|---|
| `zone_id` | `string` | ✅ | Stable; no spaces | Machine-readable zone identifier. Never changes for the lifetime of the event. |
| `zone_name` | `string` | ✅ | — | Human-readable display label shown in UI. |
| `timestamp` | `string` | ✅ | ISO 8601 UTC, ends with `Z` | Exact moment the snapshot was captured. Format: `YYYY-MM-DDTHH:MM:SSZ`. |
| `density_per_sqm` | `float` | ✅ | `≥ 0.0` | Estimated number of people per square metre in the zone. See §2 for typical ranges. |
| `flow_speed_mps` | `float` | ✅ | `≥ 0.0` | Average crowd movement speed in metres per second. |
| `risk_score` | `float` | ✅ | `0.0 ≤ x ≤ 1.0` | Normalised risk score. 0 = safe, 1 = maximum danger. See §3 for the scoring formula. |
| `risk_level` | `enum` | ✅ | One of `low`, `medium`, `high`, `critical` | Categorical bucket derived from `risk_score`. See §3 for thresholds. |
| `eta_minutes` | `int \| null` | ✅ | `≥ 1` or `null` | Estimated minutes until the situation becomes critical if trend continues. `null` when `risk_level == "low"`. |
| `recommendations` | `array[string]` | ✅ | Can be empty `[]` | Ordered list of operator actions. First item is highest priority. See §4 for the recommendation catalogue. |
| `announcement` | `object` | ✅ | Must have `en` and `hi` | Bilingual PA text. Both keys always present. See §5 for the full catalogue. |
| `announcement.en` | `string` | ✅ | — | English public-address text. |
| `announcement.hi` | `string` | ✅ | — | Hindi public-address text. |

### 1.3 Pydantic Model (Python)

Defined in [`pipeline/models.py`](../pipeline/models.py):

```python
class Announcement(BaseModel):
    en: str
    hi: str

class RiskEvent(BaseModel):
    zone_id:         str
    zone_name:       str
    timestamp:       str
    density_per_sqm: float         # ge=0.0
    flow_speed_mps:  float         # ge=0.0
    risk_score:      float         # ge=0.0, le=1.0
    risk_level:      Literal["low", "medium", "high", "critical"]
    eta_minutes:     Optional[int]
    recommendations: list[str]
    announcement:    Announcement
```

### 1.4 TypeScript Type (Dashboard / Mobile)

```typescript
export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface Announcement {
  en: string;
  hi: string;
}

export interface RiskEvent {
  zone_id:         string;
  zone_name:       string;
  timestamp:       string;          // ISO 8601 UTC
  density_per_sqm: number;
  flow_speed_mps:  number;
  risk_score:      number;          // 0.0 – 1.0
  risk_level:      RiskLevel;
  eta_minutes:     number | null;
  recommendations: string[];
  announcement:    Announcement;
}
```

---

## 2. Zone Registry

These are the four zones in the demo. The `zone_id` values are stable — UI components should key state maps on these identifiers.

| `zone_id` | `zone_name` | Notes |
|---|---|---|
| `gate_1` | South Entrance | Primary public entrance; highest baseline traffic |
| `gate_2` | West Entrance | Secondary entrance; staff + VIP access |
| `gate_3` | North Entrance | Emergency overflow exit; usually lower density |
| `gate_4` | East Entrance | Narrow corridor; side exits available (see recommendations) |

---

## 3. Risk Scoring Formula

### Score Calculation

```
density_factor  = min(density_per_sqm / 7.0, 1.0)
                  # 7 people/sqm is the accepted maximum danger threshold
                  # (above this, crowd crush becomes imminent)

flow_factor     = max(0.0, 1.0 - flow_speed_mps / 1.5)
                  # 1.5 m/s is free-flow walking speed
                  # low speed → crowd is jammed → higher risk contribution

risk_score      = round( (density_factor × 0.65) + (flow_factor × 0.35), 3 )
```

**Coefficient rationale:** Density (0.65 weight) is the primary predictor of crush events per published crowd-safety literature (Fruin, Still). Flow speed (0.35 weight) provides a leading indicator — flow slows before density peaks.

### Risk Level Thresholds

| `risk_level` | `risk_score` range | `eta_minutes` | Colour (UI) |
|---|---|---|---|
| `low` | `0.00 – 0.34` | `null` | 🟢 Green |
| `medium` | `0.35 – 0.59` | `15 – 30` | 🟡 Yellow |
| `high` | `0.60 – 0.79` | `6 – 14` | 🟠 Orange |
| `critical` | `0.80 – 1.00` | `1 – 5` | 🔴 Red |

### Density Reference

| `density_per_sqm` | Crowd condition |
|---|---|
| `< 1.0` | Comfortable; free movement |
| `1.0 – 2.0` | Normal event crowd; no concern |
| `2.0 – 4.0` | Busy; flow restrictions possible |
| `4.0 – 6.0` | High density; risk of flow stoppage |
| `6.0 – 7.0` | Dangerous; crush risk imminent |
| `> 7.0` | Critical; intervention required immediately |

---

## 4. Recommendation Catalogue

Recommendations are string tokens, not human sentences, so each consuming system can localise and render them as appropriate.

| Token | Trigger condition | Meaning |
|---|---|---|
| `increase_monitoring` | `medium` | Add attention to this zone; increase camera check frequency |
| `prepare_staff` | `medium` | Pre-position staff near the zone boundary |
| `open_alternate_gate` | `high` | Open a neighbouring gate to divert incoming flow |
| `redirect_crowd_flow` | `high` | Use barriers/staff to steer crowd away from bottleneck |
| `deploy_staff` | `high` | Send additional marshals into the zone immediately |
| `close_gate` | `critical` | Stop admitting new people into this zone |
| `emergency_broadcast` | `critical` | Trigger PA announcement immediately |
| `deploy_all_staff` | `critical` | All available staff to this zone |
| `call_security` | `critical` | Escalate to security control room |
| `open_side_corridor_exits` | `high`/`critical` at `gate_4` | East Entrance specific — open narrow side exits |

---

## 5. Announcement Catalogue

| `risk_level` | `en` | `hi` |
|---|---|---|
| `low` | All areas are clear. Enjoy the event. | सभी क्षेत्र सुरक्षित हैं। कार्यक्रम का आनंद लें। |
| `medium` | Some areas are getting busy. Please follow staff directions. | कुछ क्षेत्रों में भीड़ बढ़ रही है। कृपया कर्मचारियों के निर्देशों का पालन करें। |
| `high` | Crowd density is high in this area. Please move calmly to the nearest exit. | इस क्षेत्र में भीड़ घनत्व अधिक है। कृपया शांति से निकटतम निकास की ओर जाएं। |
| `critical` | URGENT: Please evacuate this area immediately and follow security staff. | तत्काल: कृपया इस क्षेत्र को तुरंत खाली करें और सुरक्षा कर्मियों का अनुसरण करें। |

---

## 6. WebSocket Wire Protocol

### Connection
```
ws://localhost:8000/ws/risk-events
```

### Broadcast Message Format
The server pushes a **JSON array** of `RiskEvent` objects every 3 seconds. All four zones are included in every message.

```json
[
  { "zone_id": "gate_1", ... },
  { "zone_id": "gate_2", ... },
  { "zone_id": "gate_3", ... },
  { "zone_id": "gate_4", ... }
]
```

### Behaviour
- On connect, the client immediately receives the latest cached snapshot (no blank wait).
- If the server restarts, the client must reconnect (no automatic server-side keep-alive for dropped connections).
- Clients should show a visible "reconnecting" state during disconnection — this is a judged criterion.

---

## 7. REST API

### `GET /events/latest`

Returns the most recent snapshot for each zone. Useful for initial page load or REST-only clients.

**Response:**
```json
{
  "gate_1": { <RiskEvent> },
  "gate_2": { <RiskEvent> },
  "gate_3": { <RiskEvent> },
  "gate_4": { <RiskEvent> }
}
```

### `GET /health`

```json
{
  "status": "ok",
  "mode": "mock",
  "active_connections": "2"
}
```

---

## 8. Contract Change Process

1. **Propose** the change by opening a GitHub issue or messaging the team.
2. **Update** `pipeline/models.py` first — Pydantic validation is the enforcement mechanism.
3. **Update** this document (`schema.md`) in the same commit.
4. **Update** the TypeScript type definition in `dashboard/` and `mobile-app/` before merging.
5. **Merge** into `main` via PR; all branches must `git pull main` before continuing.

> **Never** change the shape of a field silently. A missing field or type mismatch will break the dashboard and mobile app simultaneously.
