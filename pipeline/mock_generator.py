"""
CrowdShield — Mock Event Generator
------------------------------------
Generates realistic but synthetic crowd-risk events for all 5 venue zones.
Used during pre-integration development so the dashboard and mobile app can
be built against the real data contract before the vision engine is wired in.
"""

from __future__ import annotations

import random
import time
import datetime
from typing import Optional

from models import Announcement, RiskEvent, RiskLevel

# ---------------------------------------------------------------------------
# Zone registry — 5 stadium perimeter & interior gates
# ---------------------------------------------------------------------------

ZONES: list[dict[str, str]] = [
    {"zone_id": "gate_1", "zone_name": "South Entrance"},
    {"zone_id": "gate_2", "zone_name": "North Gate"},
    {"zone_id": "gate_3", "zone_name": "East Pavilion"},
    {"zone_id": "gate_4", "zone_name": "West Exit"},
    {"zone_id": "gate_5", "zone_name": "Main Arena"},
]

# ---------------------------------------------------------------------------
# Per-zone mutable state — persists between calls to produce realistic trends
# ---------------------------------------------------------------------------

_zone_state: dict[str, dict] = {
    z["zone_id"]: {
        "density": round(random.uniform(0.8, 2.2), 2),
        "flow_speed": round(random.uniform(0.8, 1.3), 2),
    }
    for z in ZONES
}

_last_spike_time: float = time.monotonic()
_next_spike_interval: float = random.uniform(30.0, 40.0)


# ---------------------------------------------------------------------------
# Scenario trigger support (for live pitch demos)
# ---------------------------------------------------------------------------


def trigger_scenario(scenario_name: str) -> dict[str, str]:
    """Manually inject a specific pitch scenario."""
    scenario = scenario_name.strip().lower()
    if scenario == "before":
        # Critical stampede risk without CrowdShield intervention
        _zone_state["gate_1"]["density"] = 6.9
        _zone_state["gate_1"]["flow_speed"] = 0.15
        _zone_state["gate_5"]["density"] = 6.4
        _zone_state["gate_5"]["flow_speed"] = 0.20
        _zone_state["gate_3"]["density"] = 4.8
        _zone_state["gate_3"]["flow_speed"] = 0.40
        return {"status": "success", "scenario": "before", "message": "Simulating high-density bottleneck surge (No CrowdShield active)"}
    elif scenario == "after":
        # Crowd mitigation, automated rerouting, and gates opened
        _zone_state["gate_1"]["density"] = 2.1
        _zone_state["gate_1"]["flow_speed"] = 1.10
        _zone_state["gate_5"]["density"] = 2.8
        _zone_state["gate_5"]["flow_speed"] = 0.95
        _zone_state["gate_4"]["density"] = 3.2
        _zone_state["gate_4"]["flow_speed"] = 1.20
        _zone_state["gate_2"]["density"] = 2.5
        _zone_state["gate_2"]["flow_speed"] = 1.05
        return {"status": "success", "scenario": "after", "message": "Simulating active CrowdShield intervention and crowd dispersion"}
    return {"status": "ignored", "scenario": scenario_name, "message": "Unknown scenario"}


# ---------------------------------------------------------------------------
# Risk computation
# ---------------------------------------------------------------------------


def _compute_risk(
    density: float, flow_speed: float
) -> tuple[float, RiskLevel, Optional[int]]:
    """Compute a normalised risk score, categorical level, and ETA from sensor readings."""
    density_factor = min(density / 7.0, 1.0)
    flow_factor = max(0.0, 1.0 - (flow_speed / 1.5))

    score = round(min((density_factor * 0.65) + (flow_factor * 0.35), 1.0), 3)

    if score < 0.35:
        level: RiskLevel = "low"
        eta: Optional[int] = None
    elif score < 0.60:
        level = "medium"
        eta = random.randint(15, 30)
    elif score < 0.80:
        level = "high"
        eta = random.randint(6, 14)
    else:
        level = "critical"
        eta = random.randint(1, 5)

    return score, level, eta


# ---------------------------------------------------------------------------
# Recommendation catalogue
# ---------------------------------------------------------------------------


def _get_recommendations(risk_level: RiskLevel, zone_id: str) -> list[str]:
    base: dict[str, list[str]] = {
        "low": ["maintain_standard_flow"],
        "medium": ["increase_monitoring", "prepare_staff"],
        "high": ["open_alternate_gate", "redirect_crowd_flow", "deploy_staff"],
        "critical": [
            "close_gate",
            "emergency_broadcast",
            "deploy_all_staff",
            "call_security",
        ],
    }
    recs = list(base.get(risk_level, []))
    if zone_id == "gate_4" and risk_level in ("high", "critical"):
        recs.append("open_side_corridor_exits")
    return recs


# ---------------------------------------------------------------------------
# Announcement copy
# ---------------------------------------------------------------------------


def _get_announcement(risk_level: RiskLevel) -> Announcement:
    messages: dict[str, dict[str, str]] = {
        "low": {
            "en": "All areas are clear. Enjoy the event safely.",
            "hi": "सभी क्षेत्र सुरक्षित हैं। कार्यक्रम का सुरक्षित आनंद लें।",
        },
        "medium": {
            "en": "Some areas are experiencing heavy flow. Please follow staff directions.",
            "hi": "कुछ क्षेत्रों में भीड़ बढ़ रही है। कृपया कर्मचारियों के निर्देशों का पालन करें।",
        },
        "high": {
            "en": "Crowd density is elevated in this zone. Please move calmly toward open exit gates.",
            "hi": "इस क्षेत्र में भीड़ अधिक है। कृपया शांति से खुले निकास द्वार की ओर बढ़ें।",
        },
        "critical": {
            "en": "URGENT SAFETY ALERT: Please disperse calmly and follow emergency security personnel.",
            "hi": "तत्काल सुरक्षा चेतावनी: कृपया शांति से हटें और सुरक्षा कर्मियों के निर्देशों का पालन करें।",
        },
    }
    raw = messages.get(risk_level, messages["low"])
    return Announcement(**raw)


# ---------------------------------------------------------------------------
# Spike scheduler
# ---------------------------------------------------------------------------


def _maybe_apply_spike(zone_id: str) -> float:
    global _last_spike_time, _next_spike_interval

    now = time.monotonic()
    elapsed = now - _last_spike_time

    if elapsed >= _next_spike_interval:
        target = random.choice(ZONES)["zone_id"]
        if zone_id == target:
            _last_spike_time = now
            _next_spike_interval = random.uniform(30.0, 40.0)
            return random.uniform(3.5, 4.8)
        else:
            if elapsed >= _next_spike_interval + 3.0:
                _last_spike_time = now
                _next_spike_interval = random.uniform(30.0, 40.0)

    return 0.0


# ---------------------------------------------------------------------------
# Single-zone event generation
# ---------------------------------------------------------------------------


def generate_event(zone: dict[str, str]) -> RiskEvent:
    zone_id = zone["zone_id"]
    state = _zone_state[zone_id]

    walk = random.uniform(-0.25, 0.25)
    if random.random() < 0.05:
        walk += random.uniform(0.4, 0.9)
    spike = _maybe_apply_spike(zone_id)

    state["density"] = round(max(0.2, min(8.0, state["density"] + walk + spike)), 2)

    density = state["density"]
    flow_speed = state.get("flow_speed", round(random.uniform(0.2, 1.3), 2))

    risk_score, risk_level, eta_minutes = _compute_risk(density, flow_speed)
    recommendations = _get_recommendations(risk_level, zone_id)
    announcement = _get_announcement(risk_level)

    return RiskEvent(
        zone_id=zone_id,
        zone_name=zone["zone_name"],
        timestamp=datetime.datetime.now(datetime.timezone.utc).strftime(
            "%Y-%m-%dT%H:%M:%SZ"
        ),
        density_per_sqm=density,
        flow_speed_mps=flow_speed,
        risk_score=risk_score,
        risk_level=risk_level,
        eta_minutes=eta_minutes,
        recommendations=recommendations,
        announcement=announcement,
    )


# ---------------------------------------------------------------------------
# All-zones batch
# ---------------------------------------------------------------------------


def generate_all_zones() -> list[RiskEvent]:
    return [generate_event(z) for z in ZONES]
