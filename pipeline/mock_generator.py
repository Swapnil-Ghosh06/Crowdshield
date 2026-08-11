"""
CrowdShield — Mock Event Generator
------------------------------------
Generates realistic but synthetic crowd-risk events for all four zones.
Used during pre-integration development so the dashboard and mobile app can
be built against the real data contract before the vision engine is wired in.

Design goals:
  - Produce ``RiskEvent`` Pydantic objects (not raw dicts) so the compiler
    catches contract drift immediately.
  - Apply a random walk on density so events look like believable trends
    rather than white-noise.
  - Guarantee at least one zone spikes to "high" or "critical" every
    30–40 seconds to make demos convincing without needing to wait.

When MOCK_MODE is disabled, ``main.py`` imports ``generate_all_zones`` from
``real_engine`` instead; that module must return the same list[RiskEvent] type.
"""

from __future__ import annotations

import random
import time
import datetime
from typing import Optional

from models import Announcement, RiskEvent, RiskLevel

# ---------------------------------------------------------------------------
# Zone registry
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
        "density": round(random.uniform(0.5, 2.0), 2),
    }
    for z in ZONES
}

# Tracks the wall-clock time of the last forced spike so we can schedule the
# next one within the 30–40 second window.
_last_spike_time: float = time.monotonic()
_next_spike_interval: float = random.uniform(30.0, 40.0)


# ---------------------------------------------------------------------------
# Risk computation
# ---------------------------------------------------------------------------


def _compute_risk(
    density: float, flow_speed: float
) -> tuple[float, RiskLevel, Optional[int]]:
    """Compute a normalised risk score, categorical level, and ETA from sensor readings.

    The formula weighs density more heavily than flow speed because empirical
    crowd-crush studies show density is the primary predictor of danger.

    Args:
        density: People per square metre (expected range 0–8).
        flow_speed: Average crowd movement speed in m/s (expected range 0–1.5).

    Returns:
        Tuple of (risk_score in [0,1], risk_level string, eta_minutes or None).
    """
    # Normalise: 7 p/sqm is considered maximum dangerous density
    density_factor = min(density / 7.0, 1.0)
    # Low flow speed → crowd is jammed → higher risk contribution
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
    """Return an ordered list of operator interventions for a given risk level.

    Recommendations escalate with severity.  Zone-specific overrides are applied
    on top of the base list so operators see context-relevant actions first.

    Args:
        risk_level: Categorical risk level for the zone.
        zone_id: Zone identifier used to apply zone-specific additions.

    Returns:
        List of recommendation strings in priority order.
    """
    base: dict[str, list[str]] = {
        "low": [],
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
    # East Entrance (gate_4) backs on to a narrow corridor — always add evacuation
    if zone_id == "gate_4" and risk_level in ("high", "critical"):
        recs.append("open_side_corridor_exits")
    return recs


# ---------------------------------------------------------------------------
# Announcement copy
# ---------------------------------------------------------------------------


def _get_announcement(risk_level: RiskLevel) -> Announcement:
    """Return bilingual PA text appropriate for the current risk level.

    Messages are deliberately zone-agnostic so a single announcement can be
    broadcast system-wide without ambiguity about which entrance is affected.

    Args:
        risk_level: Categorical risk level.

    Returns:
        ``Announcement`` model with 'en' and 'hi' text.
    """
    messages: dict[str, dict[str, str]] = {
        "low": {
            "en": "All areas are clear. Enjoy the event.",
            "hi": "सभी क्षेत्र सुरक्षित हैं। कार्यक्रम का आनंद लें।",
        },
        "medium": {
            "en": "Some areas are getting busy. Please follow staff directions.",
            "hi": "कुछ क्षेत्रों में भीड़ बढ़ रही है। कृपया कर्मचारियों के निर्देशों का पालन करें।",
        },
        "high": {
            "en": "Crowd density is high in this area. Please move calmly to the nearest exit.",
            "hi": "इस क्षेत्र में भीड़ घनत्व अधिक है। कृपया शांति से निकटतम निकास की ओर जाएं।",
        },
        "critical": {
            "en": "URGENT: Please evacuate this area immediately and follow security staff.",
            "hi": "तत्काल: कृपया इस क्षेत्र को तुरंत खाली करें और सुरक्षा कर्मियों का अनुसरण करें।",
        },
    }
    raw = messages.get(risk_level, messages["low"])
    return Announcement(**raw)


# ---------------------------------------------------------------------------
# Spike scheduler
# ---------------------------------------------------------------------------


def _maybe_apply_spike(zone_id: str) -> float:
    """Return a large positive density delta if this zone is the chosen spike target.

    A single zone is forced into "high" or "critical" every 30–40 seconds to
    ensure demos always show the full alert lifecycle without operators having
    to wait for a random lucky draw.  The chosen zone rotates randomly each
    spike cycle.

    Args:
        zone_id: The zone currently being evaluated.

    Returns:
        Extra density to add (0.0 if this zone is not the spike target this cycle).
    """
    global _last_spike_time, _next_spike_interval

    now = time.monotonic()
    elapsed = now - _last_spike_time

    if elapsed >= _next_spike_interval:
        # Pick a random zone to spike; only apply the boost to that zone
        target = random.choice(ZONES)["zone_id"]
        if zone_id == target:
            # Reset the spike clock only once, from any zone's perspective.
            # The first zone to detect expiry resets the clock; others see
            # elapsed < interval on the same tick because _last_spike_time
            # is already updated. We set it here unconditionally.
            _last_spike_time = now
            _next_spike_interval = random.uniform(30.0, 40.0)
            # Add enough density to reliably push into high/critical territory
            return random.uniform(3.5, 5.0)
        else:
            # Non-target zones: reset clock once per cycle so we don't re-spike
            # every tick until one zone "wins" the randomisation.  The target
            # zone may not have been evaluated first, so we only reset if elapsed
            # is well past the threshold to avoid starving the target.
            if elapsed >= _next_spike_interval + 3.0:
                _last_spike_time = now
                _next_spike_interval = random.uniform(30.0, 40.0)

    return 0.0


# ---------------------------------------------------------------------------
# Single-zone event generation
# ---------------------------------------------------------------------------


def generate_event(zone: dict[str, str]) -> RiskEvent:
    """Generate one realistic mock ``RiskEvent`` for the given zone.

    Applies a random walk to crowd density so successive events form plausible
    trends.  Periodically injects a forced spike so demos always show the
    critical-alert path.

    Args:
        zone: Dict containing 'zone_id' and 'zone_name'.

    Returns:
        A validated ``RiskEvent`` Pydantic model ready for serialisation.
    """
    zone_id = zone["zone_id"]
    state = _zone_state[zone_id]

    # --- Density update ---
    # Normal random walk: ±0.3 per 3-second tick
    walk = random.uniform(-0.3, 0.3)
    # Occasional organic micro-surge (distinct from the forced demo spike)
    if random.random() < 0.04:
        walk += random.uniform(0.5, 1.2)
    spike = _maybe_apply_spike(zone_id)

    state["density"] = round(max(0.1, min(8.0, state["density"] + walk + spike)), 2)

    density = state["density"]
    flow_speed = round(random.uniform(0.1, 1.4), 2)

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
    """Generate one mock ``RiskEvent`` per registered zone.

    This is the single function imported by ``main.py``.  The real engine
    adapter must expose a function with this exact signature so switching
    MOCK_MODE off requires zero changes elsewhere.

    Returns:
        List of ``RiskEvent`` models, one per zone, in ZONES order.
    """
    return [generate_event(z) for z in ZONES]
