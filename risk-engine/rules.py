"""
CrowdShield — Intervention Recommendations & Bilingual Announcements
---------------------------------------------------------------------
Generates actionable operator intervention recommendations and bilingual (English + Hindi)
public address announcements tailored to the current risk level and zone dynamics.

Why this exists:
    Gives event operators instant, unambiguous standard operating procedures (SOPs) during
    rapidly evolving crowd surges, and provides calm, clear bilingual PA broadcasts to safely
    guide attendees before stampede conditions can materialize.
"""

from __future__ import annotations

from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class Announcement(BaseModel):
    """Bilingual public-address announcement text."""

    en: str = Field(..., description="English public-address message.")
    hi: str = Field(..., description="Hindi public-address message.")


def generate_recommendations(
    zone_id: str,
    zone_name: str,
    risk_level: str,
    bottleneck_detected: bool = False,
    flow_direction: Optional[str] = None,
) -> List[str]:
    """Generates an ordered list of standard operating interventions based on zone risk.

    Args:
        zone_id: Unique identifier of the zone.
        zone_name: Human-readable name of the zone.
        risk_level: Categorical risk level ('low', 'medium', 'high', 'critical').
        bottleneck_detected: Boolean indicating if severe compression/stagnation was detected.
        flow_direction: Optional direction of crowd motion.

    Returns:
        List of recommended operator action strings.

    Why this exists:
        Surfaces immediate operational decisions so operators do not lose time under high stress.
    """
    normalized_level = risk_level.lower()

    if normalized_level == "low":
        return [
            f"Maintain standard visual monitoring at {zone_name}.",
            "All entry/exit gates operating under normal capacity.",
        ]

    elif normalized_level == "medium":
        recs = [
            f"Alert ground marshals near {zone_name} to monitor ingress rate.",
            "Prepare alternate egress gates for potential surge diversion.",
            "Verify clear pathway along main egress corridor.",
        ]
        if bottleneck_detected:
            recs.insert(0, f"Check for physical obstructions at {zone_name} bottleneck.")
        return recs

    elif normalized_level == "high":
        recs = [
            f"Deploy rapid response marshals to {zone_name} immediately.",
            f"Open alternate relief gates adjacent to {zone_name}.",
            "Initiate calm public address announcements to regulate crowd pacing.",
            "Temporarily restrict inward turnstiles/barriers.",
        ]
        if flow_direction == "away_from_exit":
            recs.insert(0, f"Counter-flow detected at {zone_name}: establish one-way pedestrian barriers.")
        return recs

    elif normalized_level == "critical":
        return [
            f"CRITICAL: HALT INWARD INGRESS AT {zone_name.upper()} IMMEDIATELY.",
            f"Execute emergency crowd diversion protocol for {zone_name}.",
            "Open all emergency egress doors and perimeter relief gates.",
            "Dispatch emergency medical & crowd safety teams to the zone.",
            "Broadcast emergency evacuation and movement directions over PA system.",
        ]

    return ["Monitor zone closely for changes in density."]


def generate_announcements(
    zone_id: str,
    zone_name: str,
    risk_level: str,
) -> Announcement:
    """Generates bilingual English and Hindi public address text matching current risk.

    Args:
        zone_id: Identifier of the zone.
        zone_name: Display name of the zone.
        risk_level: Current risk level ('low', 'medium', 'high', 'critical').

    Returns:
        `Announcement` model containing English (`en`) and Hindi (`hi`) text.

    Why this exists:
        Guarantees that public address systems and attendee mobile apps always have
        ready-to-broadcast, reassuring, and culturally accessible emergency communications.
    """
    normalized_level = risk_level.lower()

    if normalized_level == "low":
        return Announcement(
            en=f"Welcome. Crowd flow at {zone_name} is normal. Please proceed smoothly and enjoy the event.",
            hi=f"स्वागत है। {zone_name} पर भीड़ का प्रवाह सामान्य है। कृपया सुगमता से आगे बढ़ें और कार्यक्रम का आनंद लें।",
        )

    elif normalized_level == "medium":
        return Announcement(
            en=f"Attention visitors near {zone_name}: Movement is moderately heavy. Please keep moving forward steadily and avoid stopping in corridors.",
            hi=f"{zone_name} के पास उपस्थित दर्शक कृपया ध्यान दें: भीड़ का आवागमन धीमा है। कृपया लगातार आगे बढ़ते रहें और गलियारों में न रुकें।",
        )

    elif normalized_level == "high":
        return Announcement(
            en=f"Attention: High crowd density at {zone_name}. Please follow marshal instructions and use alternate exit pathways for faster egress.",
            hi=f"महत्वपूर्ण सूचना: {zone_name} पर अत्यधिक भीड़ है। कृपया सुरक्षा कर्मियों के निर्देशों का पालन करें और वैकल्पिक निकास मार्गों का उपयोग करें।",
        )

    elif normalized_level == "critical":
        return Announcement(
            en=f"EMERGENCY ADVISORY: {zone_name} is heavily congested. Do not push. Move calmly towards the nearest marked emergency exit immediately.",
            hi=f"आपातकालीन सूचना: {zone_name} पर भारी भीड़ का दबाव है। धक्का-मुक्की न करें। कृपया तुरंत और शांतिपूर्वक निकटतम आपातकालीन निकास की ओर बढ़ें।",
        )

    return Announcement(
        en=f"Please proceed with caution near {zone_name}.",
        hi=f"कृपया {zone_name} के पास सावधानीपूर्वक आगे बढ़ें।",
    )
