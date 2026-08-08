"""
Mock Event Generator
--------------------
Emits fake but realistic crowd risk events matching the shared CrowdShield
data contract. Used by Zahid (dashboard) and Haripriya (mobile app) to build
their UIs before the real vision engine is ready.
"""

import random
import datetime
from typing import Optional


ZONES = [
    {"zone_id": "gate_1", "zone_name": "North Entrance"},
    {"zone_id": "gate_2", "zone_name": "South Entrance"},
    {"zone_id": "gate_3", "zone_name": "East Gate"},
    {"zone_id": "gate_4", "zone_name": "Main Stage Area"},
]

# Simulated zone state — persists between calls to create realistic trends
_zone_state: dict[str, dict] = {
    z["zone_id"]: {"density": round(random.uniform(0.5, 2.0), 2), "trend": "stable"}
    for z in ZONES
}


def _compute_risk(density: float, flow_speed: float) -> tuple[float, str, Optional[int]]:
    """Compute risk_score, risk_level, and eta_minutes from density and flow_speed.

    Args:
        density: People per square metre.
        flow_speed: Average crowd flow speed in metres per second.

    Returns:
        Tuple of (risk_score 0–1, risk_level string, eta_minutes or None).
    """
    # High density + low flow = high risk (people jammed, not moving)
    density_factor = min(density / 7.0, 1.0)       # normalise: 7 p/sqm = max danger
    flow_factor = max(0.0, 1.0 - (flow_speed / 1.5))  # low speed → high factor

    score = round(min((density_factor * 0.65) + (flow_factor * 0.35), 1.0), 3)

    if score < 0.35:
        level, eta = "low", None
    elif score < 0.60:
        level, eta = "medium", random.randint(15, 30)
    elif score < 0.80:
        level, eta = "high", random.randint(6, 14)
    else:
        level, eta = "critical", random.randint(1, 5)

    return score, level, eta


def _get_recommendations(risk_level: str, zone_id: str) -> list[str]:
    """Return a list of intervention recommendations based on risk level and zone.

    Args:
        risk_level: One of 'low', 'medium', 'high', 'critical'.
        zone_id: The zone identifier.

    Returns:
        List of recommendation strings.
    """
    base = {
        "low": [],
        "medium": ["increase_monitoring", "prepare_staff"],
        "high": ["open_alternate_gate", "redirect_flow_north", "deploy_staff"],
        "critical": ["close_gate", "emergency_broadcast", "deploy_all_staff", "call_security"],
    }
    recs = list(base.get(risk_level, []))
    if zone_id == "gate_4" and risk_level in ("high", "critical"):
        recs.append("open_stage_side_exits")
    return recs


def _get_announcement(risk_level: str) -> dict[str, str]:
    """Return multilingual public announcement text for the given risk level.

    Args:
        risk_level: One of 'low', 'medium', 'high', 'critical'.

    Returns:
        Dict with 'en' and 'hi' keys.
    """
    messages = {
        "low": {
            "en": "All areas are clear. Enjoy the event.",
            "hi": "सभी क्षेत्र सुरक्षित हैं। कार्यक्रम का आनंद लें।",
        },
        "medium": {
            "en": "Some areas are getting busy. Please follow staff directions.",
            "hi": "कुछ क्षेत्रों में भीड़ बढ़ रही है। कृपया कर्मचारियों के निर्देशों का पालन करें।",
        },
        "high": {
            "en": "Please move calmly towards Gate 5. Avoid pushing.",
            "hi": "कृपया शांति से गेट 5 की ओर बढ़ें। धक्का देने से बचें।",
        },
        "critical": {
            "en": "URGENT: Please evacuate this area immediately and follow security staff.",
            "hi": "तत्काल: कृपया इस क्षेत्र को तुरंत खाली करें और सुरक्षा कर्मियों का अनुसरण करें।",
        },
    }
    return messages.get(risk_level, messages["low"])


def generate_event(zone: dict) -> dict:
    """Generate a single mock risk event for a zone.

    Applies a random walk to density so events look like realistic trends
    rather than fully random noise. Occasionally spikes to high/critical
    to simulate an emerging incident.

    Args:
        zone: Dict with 'zone_id' and 'zone_name'.

    Returns:
        A dict conforming to the shared CrowdShield data contract.
    """
    zone_id = zone["zone_id"]
    state = _zone_state[zone_id]

    # Random walk on density (±0.3 per tick, clamped 0.1–8.0)
    delta = random.uniform(-0.3, 0.3)
    # 5% chance of a spike (simulates sudden crowd surge)
    if random.random() < 0.05:
        delta += random.uniform(1.5, 3.0)
    state["density"] = round(max(0.1, min(8.0, state["density"] + delta)), 2)

    density = state["density"]
    flow_speed = round(random.uniform(0.1, 1.4), 2)

    risk_score, risk_level, eta_minutes = _compute_risk(density, flow_speed)
    recommendations = _get_recommendations(risk_level, zone_id)
    announcement = _get_announcement(risk_level)

    return {
        "zone_id": zone_id,
        "zone_name": zone["zone_name"],
        "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
        "density_per_sqm": density,
        "flow_speed_mps": flow_speed,
        "risk_score": risk_score,
        "risk_level": risk_level,
        "eta_minutes": eta_minutes,
        "recommendations": recommendations,
        "announcement": announcement,
    }


def generate_all_zones() -> list[dict]:
    """Generate one mock event per zone.

    Returns:
        List of event dicts, one per zone.
    """
    return [generate_event(z) for z in ZONES]
