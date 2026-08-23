"""
CrowdShield — Demo Scenario Engine
------------------------------------
Scripted before/after incident replay engine for hackathon demo presentations.

This module provides a self-contained synthetic event sequence that reproduces
a realistic crowd surge incident across all four venue zones, comparing two distinct scenarios:

  "before" — Uncontrolled Crowd Surge (WITHOUT CrowdShield):
             - Minute 0: All zones normal, gate_3 density starts at 2.0 p/m²
             - Minute 1: gate_3 density rises to 3.2 p/m², risk_level=medium
             - Minute 2: gate_3 density rises to 4.8 p/m², risk_level=high, flow slowing
             - Minute 3: gate_3 density hits 6.5 p/m², risk_level=critical, flow_speed=0.1 m/s
             - Minute 4: gate_3 density hits 8.0 p/m² — simulated crush event marker
             Broadcasts as an accelerated replay (each "minute" = 4 real seconds).

  "after"  — Managed Early Intervention (WITH CrowdShield):
             - Minute 0: Same start, gate_3 density at 2.0 p/m²
             - Minute 1: gate_3 hits medium (3.2 p/m²) — risk engine fires early,
                         recommendations sent, announcement broadcast, gate_2 opens as alternate
             - Minute 2: gate_3 density stabilizes at 3.5 p/m² (intervention working)
             - Minute 3: gate_3 density drops to 2.8 p/m², risk_level=low
             - Minute 4: All clear, system returns to normal monitoring
             Same accelerated replay speed (4s per minute).

Usage:
    generator = get_demo_generator("before")  # or "after"
    for risk_events in generator:
        # risk_events is a list[RiskEvent] matching the broadcast contract
        ...
"""

from __future__ import annotations

import math
import random
from datetime import datetime, timezone
from typing import Dict, Generator, List, Optional

from models import Announcement, RiskEvent

# ---------------------------------------------------------------------------
# Zone & Incident Configuration
# ---------------------------------------------------------------------------

DEMO_ZONES: List[Dict[str, str]] = [
    {"zone_id": "gate_1", "zone_name": "South Entrance"},
    {"zone_id": "gate_2", "zone_name": "West Entrance"},
    {"zone_id": "gate_3", "zone_name": "North Entrance"},
    {"zone_id": "gate_4", "zone_name": "East Entrance"},
]

# gate_3 (North Entrance) is the primary incident zone
INCIDENT_ZONE = "gate_3"
RELIEF_ZONE = "gate_2"

# 5 distinct minute stages (Minute 0 through Minute 4)
DEMO_DURATION_TICKS = 5

# Replay speed: 1 demo minute = 4 real seconds (total duration: 20 seconds)
TICK_INTERVAL_SEC = 4


# ---------------------------------------------------------------------------
# Scripted Scenario Data Profiles (Minute 0 to Minute 4)
# ---------------------------------------------------------------------------

# Stage definition format per minute for gate_3 (North Entrance)
BEFORE_STAGES = [
    # Minute 0: All zones normal, gate_3 starts at 2.0
    {
        "minute": 0,
        "density": 2.0,
        "flow": 1.2,
        "risk_score": 0.25,
        "risk_level": "low",
        "eta": None,
        "recommendations": ["maintain_standard_monitoring", "monitor_gate_3"],
        "announcement": Announcement(
            en="Welcome to North Entrance. Crowd flow is normal. Please proceed at a steady pace.",
            hi="नॉर्थ एंट्रेंस में आपका स्वागत है। भीड़ का आवागमन सामान्य है। कृपया शांतिपूर्वक आगे बढ़ें।",
        ),
    },
    # Minute 1: gate_3 density rises to 3.2, risk_level=medium
    {
        "minute": 1,
        "density": 3.2,
        "flow": 0.8,
        "risk_score": 0.48,
        "risk_level": "medium",
        "eta": 15,
        "recommendations": ["increase_monitoring_gate_3", "prepare_staff_gate_3", "increase_monitoring"],
        "announcement": Announcement(
            en="Attention visitors near North Entrance: Movement is moderately heavy. Please keep moving steadily.",
            hi="नॉर्थ एंट्रेंस के पास दर्शक कृपया ध्यान दें: भीड़ का आवागमन धीमा है। कृपया लगातार आगे बढ़ते रहें।",
        ),
    },
    # Minute 2: gate_3 density rises to 4.8, risk_level=high, flow slowing
    {
        "minute": 2,
        "density": 4.8,
        "flow": 0.4,
        "risk_score": 0.74,
        "risk_level": "high",
        "eta": 6,
        "recommendations": ["deploy_staff_gate_3", "open_gate_2", "redirect_flow_west", "redirect_crowd_flow"],
        "announcement": Announcement(
            en="Attention: High crowd density at North Entrance. Please follow marshal instructions and use alternate pathways.",
            hi="महत्वपूर्ण सूचना: नॉर्थ एंट्रेंस पर अत्यधिक भीड़ है। कृपया सुरक्षा कर्मियों के निर्देशों का पालन करें।",
        ),
    },
    # Minute 3: gate_3 density hits 6.5, risk_level=critical, flow_speed=0.1
    {
        "minute": 3,
        "density": 6.5,
        "flow": 0.1,
        "risk_score": 0.92,
        "risk_level": "critical",
        "eta": 1,
        "recommendations": ["close_gate_3", "emergency_broadcast", "deploy_all_staff_gate_3", "call_security"],
        "announcement": Announcement(
            en="EMERGENCY ADVISORY: North Entrance is heavily congested. Do not push. Move calmly towards nearest exit.",
            hi="आपातकालीन सूचना: नॉर्थ एंट्रेंस पर भारी भीड़ का दबाव है। धक्का-मुक्की न करें। तुरंत निकटतम निकास की ओर बढ़ें।",
        ),
    },
    # Minute 4: gate_3 density hits 8.0 — simulated crush event marker
    {
        "minute": 4,
        "density": 8.0,
        "flow": 0.0,
        "risk_score": 1.0,
        "risk_level": "critical",
        "eta": 0,
        "recommendations": [
            "SIMULATED_CRUSH_EVENT",
            "close_gate_3",
            "emergency_evacuation_all_zones",
            "deploy_all_emergency_staff",
            "call_security",
        ],
        "announcement": Announcement(
            en="SIMULATED CRUSH EVENT: Critical crowd density threshold exceeded at North Entrance. Emergency evacuation initiated.",
            hi="आपातकालीन दुर्घटना चेतावनी: नॉर्थ एंट्रेंस पर भीड़ का दबाव खतरनाक सीमा पार कर चुका है। तत्काल आपातकालीन निकासी शुरू।",
        ),
    },
]


AFTER_STAGES = [
    # Minute 0: Same start, gate_3 density at 2.0
    {
        "minute": 0,
        "density": 2.0,
        "flow": 1.2,
        "risk_score": 0.25,
        "risk_level": "low",
        "eta": None,
        "recommendations": ["maintain_standard_monitoring", "monitor_gate_3"],
        "announcement": Announcement(
            en="Welcome to North Entrance. Crowd flow is normal. Please proceed at a steady pace.",
            hi="नॉर्थ एंट्रेंस में आपका स्वागत है। भीड़ का आवागमन सामान्य है। कृपया शांतिपूर्वक आगे बढ़ें।",
        ),
    },
    # Minute 1: gate_3 hits medium (3.2) — risk engine fires early recommendations, gate_2 opens
    {
        "minute": 1,
        "density": 3.2,
        "flow": 0.8,
        "risk_score": 0.48,
        "risk_level": "medium",
        "eta": 15,
        "recommendations": [
            "open_gate_2",
            "redirect_flow_west",
            "deploy_staff_gate_3",
            "prepare_staff_gate_2",
            "increase_monitoring",
        ],
        "announcement": Announcement(
            en="Attention visitors at North Entrance: Density rising. Please follow marshals and use West Entrance (Gate 2) for faster entry.",
            hi="नॉर्थ एंट्रेंस पर उपस्थित दर्शक कृपया ध्यान दें: भीड़ बढ़ रही है। सुगम प्रवेश के लिए वेस्ट एंट्रेंस (गेट 2) की ओर बढ़ें।",
        ),
    },
    # Minute 2: gate_3 density stabilizes at 3.5 (intervention working, diversion absorbed by gate_2)
    {
        "minute": 2,
        "density": 3.5,
        "flow": 0.7,
        "risk_score": 0.50,
        "risk_level": "medium",
        "eta": 12,
        "recommendations": ["redirect_flow_west", "monitor_gate_3", "monitor_gate_2"],
        "announcement": Announcement(
            en="Crowd flow at North Entrance is stabilizing. Thank you for utilizing alternate West Entrance pathways.",
            hi="नॉर्थ एंट्रेंस पर भीड़ का दबाव नियंत्रित हो रहा है। वैकल्पिक वेस्ट एंट्रेंस मार्ग का उपयोग करने के लिए धन्यवाद।",
        ),
    },
    # Minute 3: gate_3 density drops to 2.8, risk_level=low
    {
        "minute": 3,
        "density": 2.8,
        "flow": 1.0,
        "risk_score": 0.34,
        "risk_level": "low",
        "eta": None,
        "recommendations": ["maintain_standard_monitoring", "monitor_gate_3"],
        "announcement": Announcement(
            en="North Entrance crowd density normalized. Please continue moving forward smoothly.",
            hi="नॉर्थ एंट्रेंस पर भीड़ का दबाव सामान्य हो गया है। कृपया शांतिपूर्वक आगे बढ़ें।",
        ),
    },
    # Minute 4: All clear, system returns to normal monitoring
    {
        "minute": 4,
        "density": 1.6,
        "flow": 1.3,
        "risk_score": 0.18,
        "risk_level": "low",
        "eta": None,
        "recommendations": ["maintain_standard_monitoring", "monitor_gate_3"],
        "announcement": Announcement(
            en="All zones clear. Crowd movement is normal across all venue entrances.",
            hi="सभी द्वार सुरक्षित हैं। सभी प्रवेश द्वारों पर भीड़ का आवागमन सामान्य है।",
        ),
    },
]


# ---------------------------------------------------------------------------
# Ambient Zone Generators
# ---------------------------------------------------------------------------


def _get_ambient_zone_event(
    zone_id: str,
    zone_name: str,
    minute_tick: int,
    scenario: str,
    timestamp_str: str,
) -> RiskEvent:
    """Generates realistic ambient background metrics for non-incident zones.

    In the 'after' scenario, gate_2 (West Entrance) safely absorbs diverted relief flow
    during minutes 1-2, demonstrating multi-zone crowd diversion coordination.

    Args:
        zone_id: Zone identifier (e.g. 'gate_1', 'gate_2', 'gate_4').
        zone_name: Display name of the zone.
        minute_tick: Current minute stage (0 to 4).
        scenario: 'before' or 'after'.
        timestamp_str: ISO 8601 UTC timestamp string.

    Returns:
        `RiskEvent` for the ambient zone.
    """
    if scenario == "after" and zone_id == RELIEF_ZONE:
        # Relief gate (gate_2) absorbs traffic during minutes 1-2, then normalizes
        relief_profiles = {
            0: (1.2, 1.3, 0.16, "low", None, ["maintain_standard_monitoring"]),
            1: (2.1, 1.1, 0.28, "low", None, ["prepare_staff_gate_2", "monitor_gate_2"]),
            2: (2.4, 0.9, 0.33, "low", None, ["maintain_flow_west", "monitor_gate_2"]),
            3: (1.8, 1.2, 0.23, "low", None, ["maintain_standard_monitoring"]),
            4: (1.3, 1.3, 0.17, "low", None, ["maintain_standard_monitoring"]),
        }
        density, flow, score, level, eta, recs = relief_profiles.get(minute_tick, relief_profiles[0])
    elif zone_id == "gate_1":
        # South Entrance baseline
        density, flow, score, level, eta, recs = (
            1.2 + (minute_tick * 0.05),
            1.3,
            0.15 + (minute_tick * 0.02),
            "low",
            None,
            ["maintain_standard_monitoring", "monitor_gate_1"],
        )
    elif zone_id == "gate_4":
        # East Entrance baseline
        density, flow, score, level, eta, recs = (
            1.0 + (minute_tick * 0.03),
            1.2,
            0.14 + (minute_tick * 0.01),
            "low",
            None,
            ["maintain_standard_monitoring", "monitor_gate_4"],
        )
    else:
        # Generic fallback
        density, flow, score, level, eta, recs = (
            1.1,
            1.2,
            0.15,
            "low",
            None,
            ["maintain_standard_monitoring"],
        )

    announcement = Announcement(
        en=f"Crowd flow at {zone_name} is normal and steady.",
        hi=f"{zone_name} पर भीड़ का आवागमन सामान्य और स्थिर है।",
    )

    return RiskEvent(
        zone_id=zone_id,
        zone_name=zone_name,
        timestamp=timestamp_str,
        density_per_sqm=round(density, 2),
        flow_speed_mps=round(flow, 2),
        risk_score=round(score, 3),
        risk_level=level,
        eta_minutes=eta,
        recommendations=recs,
        announcement=announcement,
    )


# ---------------------------------------------------------------------------
# Single-Tick Multi-Zone Event Builder
# ---------------------------------------------------------------------------


def _build_tick_events(tick: int, scenario: str) -> List[RiskEvent]:
    """Builds a list of RiskEvent snapshots for all 4 venue zones at a given tick.

    For ticks 0..4 (the first 20 seconds), yields the scripted progression sequence.
    For ticks >= 5, generates dynamic continuous crowd wave patterns holding the target mode's outcome state.

    Args:
        tick: Integer tick index (0, 1, 2, ...).
        scenario: 'before' or 'after'.

    Returns:
        List of 4 `RiskEvent` instances in canonical zone order (gate_1, gate_2, gate_3, gate_4).
    """
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    events: List[RiskEvent] = []

    if tick < DEMO_DURATION_TICKS:
        stages = BEFORE_STAGES if scenario == "before" else AFTER_STAGES
        stage_data = stages[tick]

        for zone in DEMO_ZONES:
            zone_id = zone["zone_id"]
            zone_name = zone["zone_name"]

            if zone_id == INCIDENT_ZONE:
                events.append(
                    RiskEvent(
                        zone_id=zone_id,
                        zone_name=zone_name,
                        timestamp=now,
                        density_per_sqm=float(stage_data["density"]),
                        flow_speed_mps=float(stage_data["flow"]),
                        risk_score=float(stage_data["risk_score"]),
                        risk_level=str(stage_data["risk_level"]),
                        eta_minutes=stage_data["eta"],
                        recommendations=list(stage_data["recommendations"]),
                        announcement=stage_data["announcement"],
                    )
                )
            else:
                events.append(
                    _get_ambient_zone_event(
                        zone_id=zone_id,
                        zone_name=zone_name,
                        minute_tick=tick,
                        scenario=scenario,
                        timestamp_str=now,
                    )
                )
        return events

    # For tick >= DEMO_DURATION_TICKS (holding phase): Dynamic continuous crowd wave movement
    hold_tick = tick - DEMO_DURATION_TICKS

    if scenario == "before":
        # WITHOUT CROWDSHIELD: Continuous severe bottleneck surge & overflow
        # gate_3 (North Entrance): Critical bottleneck wave (density 6.6 - 8.6, risk score 0.85 - 0.98)
        g3_wave = math.sin(hold_tick * 0.45) * 0.7 + random.uniform(-0.15, 0.15)
        g3_density = round(max(6.5, min(8.6, 7.6 + g3_wave)), 2)
        g3_flow = round(max(0.02, min(0.18, 0.10 - g3_wave * 0.04)), 2)
        g3_score = round(min(1.0, max(0.85, 0.91 + math.sin(hold_tick * 0.45) * 0.07)), 3)

        # gate_1 (South Entrance): High secondary overflow wave (density 4.2 - 6.2, risk score 0.62 - 0.82)
        g1_wave = math.cos(hold_tick * 0.38) * 0.6 + random.uniform(-0.12, 0.12)
        g1_density = round(max(4.0, min(6.2, 5.0 + g1_wave)), 2)
        g1_flow = round(max(0.2, min(0.5, 0.35 + g1_wave * 0.05)), 2)
        g1_score = round(min(0.82, max(0.60, 0.71 + math.cos(hold_tick * 0.38) * 0.07)), 3)

        # gate_2 (West Entrance) & gate_4 (East Entrance): Baseline low/moderate wave
        g2_wave = math.sin(hold_tick * 0.3 + 1.0) * 0.35
        g2_density = round(max(1.2, min(2.5, 1.8 + g2_wave)), 2)
        g2_score = round(max(0.18, min(0.35, 0.25 + g2_wave * 0.07)), 3)

        g4_wave = math.cos(hold_tick * 0.3 + 2.0) * 0.3
        g4_density = round(max(1.1, min(2.3, 1.6 + g4_wave)), 2)
        g4_score = round(max(0.16, min(0.32, 0.22 + g4_wave * 0.06)), 3)

        zone_configs = {
            "gate_3": (
                g3_density, g3_flow, g3_score, "critical", 0,
                ["SIMULATED_CRUSH_EVENT", "close_gate_3", "emergency_evacuation_all_zones", "call_security"],
                Announcement(en="EMERGENCY ADVISORY: North Entrance is heavily congested. Emergency evacuation initiated.", hi="आपातकालीन सूचना: नॉर्थ एंट्रेंस पर भारी भीड़ का दबाव है। आपातकालीन निकासी शुरू।")
            ),
            "gate_1": (
                g1_density, g1_flow, g1_score, "high" if g1_score >= 0.60 else "medium", 5,
                ["deploy_staff_gate_1", "redirect_crowd_flow"],
                Announcement(en="High congestion at South Entrance. Please follow security personnel instructions.", hi="साउथ एंट्रेंस पर भीड़ अधिक है। कृपया सुरक्षा कर्मियों के निर्देशों का पालन करें।")
            ),
            "gate_2": (
                g2_density, 1.1, g2_score, "low", None,
                ["maintain_standard_monitoring"],
                Announcement(en="West Entrance crowd flow is normal.", hi="वेस्ट एंट्रेंस पर भीड़ का आवागमन सामान्य है।")
            ),
            "gate_4": (
                g4_density, 1.2, g4_score, "low", None,
                ["maintain_standard_monitoring"],
                Announcement(en="East Entrance crowd flow is normal.", hi="ईस्ट एंट्रेंस पर भीड़ का आवागमन सामान्य है।")
            ),
        }
    else:
        # WITH CROWDSHIELD: Continuous managed safe active flow & traffic balancing
        # gate_3 (North Entrance): Mitigated low risk wave (density 1.4 - 2.4, risk score 0.15 - 0.31)
        g3_wave = math.sin(hold_tick * 0.4) * 0.4 + random.uniform(-0.08, 0.08)
        g3_density = round(max(1.3, min(2.5, 1.8 + g3_wave)), 2)
        g3_flow = round(max(1.0, min(1.4, 1.2 + g3_wave * 0.05)), 2)
        g3_score = round(max(0.15, min(0.31, 0.22 + g3_wave * 0.06)), 3)

        # gate_2 (West Entrance): Absorbs relief diversion flow smoothly (density 1.6 - 2.7, risk score 0.18 - 0.35)
        g2_wave = math.cos(hold_tick * 0.35) * 0.45 + random.uniform(-0.08, 0.08)
        g2_density = round(max(1.5, min(2.8, 2.1 + g2_wave)), 2)
        g2_flow = round(max(0.9, min(1.3, 1.1 + g2_wave * 0.04)), 2)
        g2_score = round(max(0.18, min(0.35, 0.26 + g2_wave * 0.07)), 3)

        # gate_1 (South Entrance) & gate_4 (East Entrance): Smooth safe waves
        g1_wave = math.sin(hold_tick * 0.3 + 1.5) * 0.3
        g1_density = round(max(1.2, min(2.2, 1.6 + g1_wave)), 2)
        g1_score = round(max(0.14, min(0.28, 0.19 + g1_wave * 0.05)), 3)

        g4_wave = math.cos(hold_tick * 0.3 + 2.5) * 0.25
        g4_density = round(max(1.0, min(2.0, 1.4 + g4_wave)), 2)
        g4_score = round(max(0.12, min(0.25, 0.17 + g4_wave * 0.04)), 3)

        zone_configs = {
            "gate_3": (
                g3_density, g3_flow, g3_score, "low", None,
                ["maintain_standard_monitoring", "monitor_gate_3"],
                Announcement(en="North Entrance crowd density normalized. Please continue moving forward smoothly.", hi="नॉर्थ एंट्रेंस पर भीड़ का दबाव सामान्य हो गया है। कृपया शांतिपूर्वक आगे बढ़ें।")
            ),
            "gate_2": (
                g2_density, g2_flow, g2_score, "low", None,
                ["maintain_flow_west", "monitor_gate_2"],
                Announcement(en="West Entrance operating as active alternate relief route.", hi="वेस्ट एंट्रेंस वैकल्पिक राहत मार्ग के रूप में सुचारू रूप से कार्य कर रहा है।")
            ),
            "gate_1": (
                g1_density, 1.3, g1_score, "low", None,
                ["maintain_standard_monitoring"],
                Announcement(en="South Entrance clear.", hi="साउथ एंट्रेंस पर भीड़ का आवागमन सामान्य है।")
            ),
            "gate_4": (
                g4_density, 1.2, g4_score, "low", None,
                ["maintain_standard_monitoring"],
                Announcement(en="East Entrance clear.", hi="ईस्ट एंट्रेंस पर भीड़ का आवागमन सामान्य है।")
            ),
        }

    for zone in DEMO_ZONES:
        zid = zone["zone_id"]
        zname = zone["zone_name"]
        density, flow, score, level, eta, recs, ann = zone_configs[zid]
        events.append(
            RiskEvent(
                zone_id=zid,
                zone_name=zname,
                timestamp=now,
                density_per_sqm=density,
                flow_speed_mps=flow,
                risk_score=score,
                risk_level=level,
                eta_minutes=eta,
                recommendations=recs,
                announcement=ann,
            )
        )

    return events


# ---------------------------------------------------------------------------
# Generator Entrypoint
# ---------------------------------------------------------------------------


def get_demo_generator(scenario: str) -> Generator[List[RiskEvent], None, None]:
    """Returns an async-compatible generator of scripted RiskEvent lists for the demo scenario.

    Yields sequential snapshots (Minute 0 through Minute 4) representing the incident progression,
    and then continuously generates dynamic wave movement holding the scenario's target risk state.

    Args:
        scenario: 'before' — uncontrolled surge ending in simulated crush event.
                  'after'  — early CrowdShield intervention, diversion, and complete recovery.

    Yields:
        List[RiskEvent] — snapshot containing all 4 zones for each 4-second demo tick.

    Raises:
        ValueError: If scenario is not 'before' or 'after'.
    """
    normalized_scenario = scenario.strip().lower()
    if normalized_scenario not in ("before", "after"):
        raise ValueError(f"Demo scenario must be 'before' or 'after'; got: {scenario!r}")

    tick = 0
    while True:
        yield _build_tick_events(tick, normalized_scenario)
        tick += 1

