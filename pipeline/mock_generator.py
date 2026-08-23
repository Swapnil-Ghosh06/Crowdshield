"""
CrowdShield — Mock Event Generator
------------------------------------
Generates realistic but synthetic crowd-risk events for the 4 venue zones.
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
# Zone registry — 4 stadium perimeter & interior gates
# ---------------------------------------------------------------------------

ZONES: list[dict[str, str]] = [
    {"zone_id": "gate_1", "zone_name": "South Entrance"},
    {"zone_id": "gate_2", "zone_name": "West Entrance"},
    {"zone_id": "gate_3", "zone_name": "North Entrance"},
    {"zone_id": "gate_4", "zone_name": "East Entrance"},
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
        # Critical stampede risk at North Entrance without CrowdShield intervention
        _zone_state["gate_3"]["density"] = 6.8
        _zone_state["gate_3"]["flow_speed"] = 0.12
        _zone_state["gate_1"]["density"] = 4.6
        _zone_state["gate_1"]["flow_speed"] = 0.35
        _zone_state["gate_2"]["density"] = 2.4
        _zone_state["gate_2"]["flow_speed"] = 0.90
        _zone_state["gate_4"]["density"] = 2.1
        _zone_state["gate_4"]["flow_speed"] = 1.05
        return {"status": "success", "scenario": "before", "message": "Simulating North Entrance bottleneck surge (No CrowdShield active)"}
    elif scenario == "after":
        # Crowd mitigation, automated rerouting, and gates opened
        _zone_state["gate_3"]["density"] = 2.1
        _zone_state["gate_3"]["flow_speed"] = 1.15
        _zone_state["gate_1"]["density"] = 2.0
        _zone_state["gate_1"]["flow_speed"] = 1.10
        _zone_state["gate_2"]["density"] = 2.3
        _zone_state["gate_2"]["flow_speed"] = 1.05
        _zone_state["gate_4"]["density"] = 2.2
        _zone_state["gate_4"]["flow_speed"] = 1.20
    elif scenario in ("idle", "reset", "none"):
        for z in ZONES:
            _zone_state[z["zone_id"]]["density"] = round(random.uniform(1.2, 1.8), 2)
            _zone_state[z["zone_id"]]["flow_speed"] = round(random.uniform(1.1, 1.3), 2)
        return {"status": "success", "scenario": "idle", "message": "Reset to standard baseline monitoring"}
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
    if zone_id == "gate_3" and risk_level in ("high", "critical"):
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
            "en": "Moderate crowd flow. Please move steadily towards open exits.",
            "hi": "मध्यम भीड़ का बहाव। कृपया खुले निकास द्वारों की ओर बढ़ते रहें।",
        },
        "high": {
            "en": "High congestion detected. Please follow staff instructions and use alternate gates.",
            "hi": "भारी भीड़ देखी गई है। कृपया कर्मचारियों के निर्देशों का पालन करें और वैकल्पिक द्वारों का उपयोग करें।",
        },
        "critical": {
            "en": "EMERGENCY: Do not enter this area. Please move towards emergency exits immediately.",
            "hi": "आपातकाल: इस क्षेत्र में प्रवेश न करें। कृपया तुरंत आपातकालीन निकास की ओर बढ़ें।",
        },
    }
    msg = messages.get(risk_level, messages["low"])
    return Announcement(en=msg["en"], hi=msg["hi"])


# ---------------------------------------------------------------------------
# State simulation step
# ---------------------------------------------------------------------------


def _step_simulation() -> None:
    """Drift zone densities and flow speeds smoothly over time within standard ambient limits."""
    for zone in ZONES:
        zid = zone["zone_id"]
        state = _zone_state[zid]

        # Natural small random walk drift around safe baseline
        density_delta = random.gauss(0.0, 0.05)
        speed_delta = random.gauss(0.0, 0.02)

        new_density = max(0.8, min(2.5, state["density"] + density_delta))
        expected_speed = max(0.8, 1.4 - (new_density * 0.18))
        new_speed = max(0.6, min(1.5, expected_speed + speed_delta))

        state["density"] = round(new_density, 2)
        state["flow_speed"] = round(new_speed, 2)


# ---------------------------------------------------------------------------
# Public generator function
# ---------------------------------------------------------------------------


def generate_mock_event(zone_id: str, zone_name: str) -> RiskEvent:
    """Generate a single RiskEvent for the given zone using current simulation state."""
    state = _zone_state.get(zone_id, {"density": 1.2, "flow_speed": 1.0})
    density = state["density"]
    flow_speed = state["flow_speed"]

    risk_score, risk_level, eta = _compute_risk(density, flow_speed)
    recommendations = _get_recommendations(risk_level, zone_id)
    announcement = _get_announcement(risk_level)

    return RiskEvent(
        zone_id=zone_id,
        zone_name=zone_name,
        timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),
        density_per_sqm=density,
        flow_speed_mps=flow_speed,
        risk_score=risk_score,
        risk_level=risk_level,
        eta_minutes=eta,
        recommendations=recommendations,
        announcement=announcement,
    )


def generate_all_zones() -> list[RiskEvent]:
    """Step the simulation and return latest RiskEvents for all 4 zones."""
    _step_simulation()
    return [
        generate_mock_event(z["zone_id"], z["zone_name"])
        for z in ZONES
    ]

