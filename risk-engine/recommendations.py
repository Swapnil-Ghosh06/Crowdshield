"""
CrowdShield — Recommendation Engine (Rule Layer + 4-Layer LLM Cascade)
----------------------------------------------------------------------
Computes actionable operator interventions and calm, clear bilingual public announcements
for crowd safety management across venue zones.

Architecture:
    1. Deterministic Rule Layer:
       - Uses a hardcoded 4-zone topological adjacency map (gate_1 South, gate_2 West, gate_3 North, gate_4 East).
       - Evaluates zone risk level, directional geometry, and neighbouring zone capacities to produce
         deterministic operator action tokens (e.g. "open_gate_2", "redirect_flow_west", "deploy_staff_gate_1").
       - Provides guaranteed deterministic fallback bilingual announcements (English + Hindi).

    2. 4-Layer Cascading Multilingual LLM Layer:
       - Layer 1 — Google Gemini (Primary): `gemini-1.5-flash` via `google-generativeai` SDK (`GEMINI_API_KEY`).
       - Layer 2 — Groq (Secondary Fallback): `llama-3.1-8b-instant` via `groq` SDK (`GROQ_API_KEY`).
       - Layer 3 — Cohere (Tertiary Fallback): `command-r` via `cohere` SDK (`COHERE_API_KEY`).
       - Layer 4 — Rule-based Templates (Quaternary Fallback): Deterministic zero-network fallback that never fails.

    Cascade Logic:
       - Toggled via `LLM_CASCADE_ENABLED=true/false` (or `RECOMMENDATIONS_USE_LLM`).
       - Automatically and silently cascades from Layer 1 → Layer 2 → Layer 3 → Layer 4 on any failure,
         missing API key, rate limit, timeout, or exception.
       - Logs the selected announcement layer at INFO level for real-time operational observability.

Output Contract:
    Returns recommendations (List[str]) and announcement ({"en": str, "hi": str}) conforming to the
    CrowdShield shared data contract defined in `pipeline/models.py`.
"""

from __future__ import annotations

from dataclasses import dataclass
import json
import logging
import os
from typing import Any, Dict, List, Literal, Optional, Tuple, Union
from pydantic import BaseModel, Field

logger = logging.getLogger("risk_engine.recommendations")

RiskLevel = Literal["low", "medium", "high", "critical"]


try:
    from rules import Announcement
except ImportError:
    try:
        from .rules import Announcement
    except ImportError:
        class Announcement(BaseModel):
            """Bilingual public-address announcement text."""

            en: str = Field(..., description="English public-address message.")
            hi: str = Field(..., description="Hindi public-address message.")


class RecommendationResult(BaseModel):
    """Container holding operator recommendations and bilingual PA announcement.

    Supports attribute access, dict serialization, and tuple unpacking:
        `recommendations, announcement = result`
    """

    recommendations: List[str] = Field(
        default_factory=list,
        description="Ordered list of recommended operator actions.",
    )
    announcement: Announcement = Field(
        ...,
        description="Bilingual public-address announcement (en/hi).",
    )
    used_llm: Union[bool, str] = Field(
        default=False,
        description="Indicates whether and which LLM layer generated the announcement ('gemini', 'groq', 'cohere', or False).",
    )

    def __iter__(self):  # type: ignore[override]
        """Allows unpacking as `recs, announcement = result`."""
        yield self.recommendations
        yield self.announcement.model_dump()

    def to_dict(self) -> Dict[str, Any]:
        """Serializes result into standard dictionary format."""
        return {
            "recommendations": list(self.recommendations),
            "announcement": self.announcement.model_dump(),
            "used_llm": self.used_llm,
        }


# ---------------------------------------------------------------------------
# Venue Topology & Adjacency Map
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ZoneMetadata:
    """Static geographical and topological metadata for a single venue zone."""

    zone_id: str
    zone_name: str
    cardinal_direction: str
    adjacent_zones: List[str]
    adjacent_directions: Dict[str, str]  # zone_id -> cardinal direction from this zone
    notes: str


# Hardcoded 4-zone venue map covering all compass quadrants
VENUE_MAP: Dict[str, ZoneMetadata] = {
    "gate_1": ZoneMetadata(
        zone_id="gate_1",
        zone_name="South Entrance",
        cardinal_direction="South",
        adjacent_zones=["gate_2", "gate_4"],
        adjacent_directions={"gate_2": "West", "gate_4": "East"},
        notes="Primary public entrance with highest baseline traffic capacity.",
    ),
    "gate_2": ZoneMetadata(
        zone_id="gate_2",
        zone_name="West Entrance",
        cardinal_direction="West",
        adjacent_zones=["gate_1", "gate_3"],
        adjacent_directions={"gate_1": "South", "gate_3": "North"},
        notes="Secondary entrance dedicated to staff, VIPs, and rapid relief diversion.",
    ),
    "gate_3": ZoneMetadata(
        zone_id="gate_3",
        zone_name="North Entrance",
        cardinal_direction="North",
        adjacent_zones=["gate_2", "gate_4"],
        adjacent_directions={"gate_2": "West", "gate_4": "East"},
        notes="Emergency overflow concourse with wide egress pathways.",
    ),
    "gate_4": ZoneMetadata(
        zone_id="gate_4",
        zone_name="East Entrance",
        cardinal_direction="East",
        adjacent_zones=["gate_3", "gate_1"],
        adjacent_directions={"gate_3": "North", "gate_1": "South"},
        notes="Narrow corridor with dedicated auxiliary side corridor exits.",
    ),
}


# ---------------------------------------------------------------------------
# Adjacency Capacity Helper
# ---------------------------------------------------------------------------


def get_optimal_alternate_zone(
    zone_id: str,
    adjacent_capacities: Optional[Dict[str, float]] = None,
) -> Tuple[str, str]:
    """Determines the best adjacent relief zone and its direction based on available capacity.

    Args:
        zone_id: The congested zone requiring relief (e.g. 'gate_1').
        adjacent_capacities: Optional dictionary mapping adjacent zone IDs to current density/load.
            Lower load values indicate higher spare capacity.

    Returns:
        Tuple of (target_zone_id, direction_name_lowercase), e.g. ('gate_2', 'west').

    Why this exists:
        Ensures crowd diversion recommendations route visitors toward zones with the greatest
        available capacity rather than blind static assignment.
    """
    metadata = VENUE_MAP.get(zone_id)
    if not metadata or not metadata.adjacent_zones:
        # Safe fallback
        return "gate_2", "west"

    adjacent_zones = metadata.adjacent_zones

    if adjacent_capacities:
        # Find adjacent zone with minimum load
        best_zone = min(
            adjacent_zones,
            key=lambda z: adjacent_capacities.get(z, 0.0),
        )
    else:
        # Default to first configured adjacent zone
        best_zone = adjacent_zones[0]

    direction = metadata.adjacent_directions.get(best_zone, "alternate").lower()
    return best_zone, direction


# ---------------------------------------------------------------------------
# Deterministic Rule Layer
# ---------------------------------------------------------------------------


def generate_rule_recommendations(
    zone_id: str,
    risk_level: str,
    adjacent_capacities: Optional[Dict[str, float]] = None,
    flow_direction: Optional[str] = None,
) -> List[str]:
    """Computes deterministic operator intervention action tokens based on venue topology and risk.

    Args:
        zone_id: Zone identifier ('gate_1', 'gate_2', 'gate_3', 'gate_4').
        risk_level: Current calculated risk level ('low', 'medium', 'high', 'critical').
        adjacent_capacities: Optional map of adjacent zone loads to pick optimal relief gate.
        flow_direction: Primary crowd movement vector (e.g. 'North', 'South').

    Returns:
        List of specific, actionable string tokens for field operators and control room consoles.

    Why this exists:
        Guarantees safety-critical response instructions even during total external network or API failure.
    """
    normalized_level = risk_level.strip().lower()
    meta = VENUE_MAP.get(zone_id)
    target_zone, target_dir = get_optimal_alternate_zone(zone_id, adjacent_capacities)

    recommendations: List[str] = []

    if normalized_level == "low":
        recommendations.extend([
            "maintain_standard_monitoring",
            f"monitor_{zone_id}",
        ])

    elif normalized_level == "medium":
        recommendations.extend([
            f"increase_monitoring_{zone_id}",
            f"prepare_staff_{zone_id}",
            "increase_monitoring",
        ])

    elif normalized_level == "high":
        recommendations.extend([
            f"deploy_staff_{zone_id}",
            f"open_{target_zone}",
            "open_alternate_gate",
            f"redirect_flow_{target_dir}",
            "redirect_crowd_flow",
        ])
        if flow_direction:
            recommendations.append(f"counter_flow_surge_{flow_direction.lower()}")

    elif normalized_level == "critical":
        recommendations.extend([
            f"close_{zone_id}",
            "emergency_broadcast",
            f"deploy_all_staff_{zone_id}",
            f"open_{target_zone}",
            f"evacuate_towards_{target_zone}",
            "call_security",
        ])
        # Corridor-specific safety mitigation for narrow exits (gate_4)
        if zone_id == "gate_4":
            recommendations.append("open_side_corridor_exits")

    else:
        # Fallback for unrecognized risk level
        recommendations.append(f"inspect_{zone_id}")

    return recommendations


def generate_rule_announcement(
    zone_id: str,
    risk_level: str,
    zone_name: Optional[str] = None,
    target_zone_name: Optional[str] = None,
) -> Announcement:
    """Produces guaranteed bilingual (English + Hindi) announcement text from deterministic templates.

    Args:
        zone_id: Zone identifier.
        risk_level: Current calculated risk level ('low', 'medium', 'high', 'critical').
        zone_name: Display name of the zone (e.g. "South Entrance").
        target_zone_name: Display name of the alternate relief zone (e.g. "West Entrance").

    Returns:
        `Announcement` model containing English and Hindi public address strings.

    Why this exists:
        Provides clear, calming, pre-vetted crowd messages in regional languages with zero API latency.
    """
    normalized_level = risk_level.strip().lower()
    meta = VENUE_MAP.get(zone_id)
    display_name = zone_name or (meta.zone_name if meta else zone_id.replace("_", " ").title())
    alt_name = target_zone_name or "adjacent gates"

    if normalized_level == "low":
        return Announcement(
            en=f"Welcome to {display_name}. Crowd flow is normal. Please proceed at a steady pace and follow signage.",
            hi=f"{display_name} में आपका स्वागत है। भीड़ का आवागमन सामान्य है। कृपया शांतिपूर्वक आगे बढ़ें।",
        )

    elif normalized_level == "medium":
        return Announcement(
            en=f"Attention visitors near {display_name}: Movement is moderately heavy. Please keep moving forward steadily and avoid stopping in corridors.",
            hi=f"{display_name} के पास उपस्थित दर्शक कृपया ध्यान दें: भीड़ का आवागमन धीमा है। कृपया लगातार आगे बढ़ते रहें और गलियारों में न रुकें।",
        )

    elif normalized_level == "high":
        return Announcement(
            en=f"Attention: High crowd density at {display_name}. Please follow marshal instructions and use alternate pathways toward {alt_name} for faster movement.",
            hi=f"महत्वपूर्ण सूचना: {display_name} पर अत्यधिक भीड़ है। कृपया सुरक्षा कर्मियों के निर्देशों का पालन करें और {alt_name} की ओर वैकल्पिक मार्ग का उपयोग करें।",
        )

    elif normalized_level == "critical":
        return Announcement(
            en=f"EMERGENCY ADVISORY: {display_name} is heavily congested. Do not push. Move calmly towards {alt_name} immediately.",
            hi=f"आपातकालीन सूचना: {display_name} पर भारी भीड़ का दबाव है। धक्का-मुक्की न करें। कृपया तुरंत और शांतिपूर्वक {alt_name} की ओर बढ़ें।",
        )

    return Announcement(
        en=f"Please proceed with caution near {display_name}.",
        hi=f"कृपया {display_name} के पास सावधानीपूर्वक आगे बढ़ें।",
    )


# ---------------------------------------------------------------------------
# 4-Layer LLM Cascade (Gemini -> Groq -> Cohere -> Rule Template)
# ---------------------------------------------------------------------------


def is_llm_enabled() -> bool:
    """Checks if the LLM recommendation cascade is enabled via environment variables.

    Inspects `LLM_CASCADE_ENABLED` first.
    Falls back to `RECOMMENDATIONS_USE_LLM` for backward compatibility.

    Returns:
        True if the cascade is enabled (default: True); False otherwise.

    Why this exists:
        Enables runtime toggling of the entire LLM cascade without code modifications.
    """
    cascade_flag = os.environ.get("LLM_CASCADE_ENABLED")
    if cascade_flag is not None:
        return cascade_flag.strip().lower() in ("true", "1", "yes", "on")

    rec_flag = os.environ.get("RECOMMENDATIONS_USE_LLM")
    if rec_flag is not None:
        return rec_flag.strip().lower() in ("true", "1", "yes", "on")

    return True


def _parse_announcement_json(content_text: str) -> Optional[Announcement]:
    """Extracts and validates bilingual {"en": "...", "hi": "..."} JSON from raw model output text.

    Args:
        content_text: Raw string returned by an LLM provider.

    Returns:
        `Announcement` instance if parsing succeeds; None otherwise.
    """
    if not content_text:
        return None

    clean_text = content_text.strip()
    if clean_text.startswith("```json"):
        clean_text = clean_text[7:]
    if clean_text.startswith("```"):
        clean_text = clean_text[3:]
    if clean_text.endswith("```"):
        clean_text = clean_text[:-3]
    clean_text = clean_text.strip()

    try:
        data = json.loads(clean_text)
        if isinstance(data, dict) and "en" in data and "hi" in data:
            en_val = str(data["en"]).strip()
            hi_val = str(data["hi"]).strip()
            if en_val and hi_val:
                return Announcement(en=en_val, hi=hi_val)
    except Exception as exc:
        logger.debug("Failed to parse JSON announcement: %s (Raw: %s)", exc, content_text)

    return None


def _call_gemini(
    prompt: str,
    system_prompt: str,
    api_key: Optional[str] = None,
    model_name: str = "gemini-1.5-flash",
) -> Optional[Announcement]:
    """Layer 1: Calls Google Gemini API via google-generativeai SDK.

    Args:
        prompt: User context prompt.
        system_prompt: System prompt with instructions and format constraints.
        api_key: Optional API key override. If None, reads GEMINI_API_KEY.
        model_name: Gemini model identifier (default: "gemini-1.5-flash").

    Returns:
        `Announcement` if successful, None on any failure.
    """
    resolved_key = api_key or os.environ.get("GEMINI_API_KEY")
    if not resolved_key or not resolved_key.strip():
        logger.debug("Gemini API key missing; skipping Layer 1.")
        return None

    try:
        import google.generativeai as genai

        genai.configure(api_key=resolved_key.strip())
        model = genai.GenerativeModel(
            model_name=model_name,
            system_instruction=system_prompt,
        )
        response = model.generate_content(prompt)
        text = response.text if hasattr(response, "text") else ""
        return _parse_announcement_json(text)
    except Exception as exc:
        logger.warning("Gemini API call failed (%s); moving to next cascade layer.", exc)
        return None


def _call_groq(
    prompt: str,
    system_prompt: str,
    api_key: Optional[str] = None,
    model_name: str = "llama-3.1-8b-instant",
) -> Optional[Announcement]:
    """Layer 2: Calls Groq Cloud API via groq SDK.

    Args:
        prompt: User context prompt.
        system_prompt: System prompt with instructions and format constraints.
        api_key: Optional API key override. If None, reads GROQ_API_KEY.
        model_name: Groq model identifier (default: "llama-3.1-8b-instant").

    Returns:
        `Announcement` if successful, None on any failure.
    """
    resolved_key = api_key or os.environ.get("GROQ_API_KEY")
    if not resolved_key or not resolved_key.strip():
        logger.debug("Groq API key missing; skipping Layer 2.")
        return None

    try:
        from groq import Groq

        client = Groq(api_key=resolved_key.strip())
        chat_completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt},
            ],
            model=model_name,
            temperature=0.2,
            max_tokens=300,
            response_format={"type": "json_object"},
        )
        text = chat_completion.choices[0].message.content or ""
        return _parse_announcement_json(text)
    except Exception as exc:
        logger.warning("Groq API call failed (%s); moving to next cascade layer.", exc)
        return None


def _call_cohere(
    prompt: str,
    system_prompt: str,
    api_key: Optional[str] = None,
    model_name: str = "command-r",
) -> Optional[Announcement]:
    """Layer 3: Calls Cohere API via cohere SDK.

    Args:
        prompt: User context prompt.
        system_prompt: System prompt with instructions and format constraints.
        api_key: Optional API key override. If None, reads COHERE_API_KEY.
        model_name: Cohere model identifier (default: "command-r").

    Returns:
        `Announcement` if successful, None on any failure.
    """
    resolved_key = api_key or os.environ.get("COHERE_API_KEY")
    if not resolved_key or not resolved_key.strip():
        logger.debug("Cohere API key missing; skipping Layer 3.")
        return None

    try:
        import cohere

        co = cohere.Client(api_key=resolved_key.strip())
        try:
            response = co.chat(
                message=prompt,
                preamble=system_prompt,
                model=model_name,
                temperature=0.2,
            )
            text = getattr(response, "text", "")
            if not text and hasattr(response, "message") and hasattr(response.message, "content"):
                blocks = response.message.content
                if blocks and hasattr(blocks[0], "text"):
                    text = blocks[0].text
        except Exception:
            # Alternate chat format compatibility
            response = co.chat(
                model=model_name,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt},
                ],
            )
            text = getattr(response, "text", "")
            if not text and hasattr(response, "message") and hasattr(response.message, "content"):
                blocks = response.message.content
                if blocks and hasattr(blocks[0], "text"):
                    text = blocks[0].text
            else:
                text = str(response)

        return _parse_announcement_json(text)
    except Exception as exc:
        logger.warning("Cohere API call failed (%s); moving to next cascade layer.", exc)
        return None


def generate_llm_cascade_announcement(
    zone_id: str,
    zone_name: str,
    risk_level: str,
    density_per_sqm: float,
    flow_speed_mps: float,
    eta_minutes: Optional[int] = None,
    recommendations: Optional[List[str]] = None,
    gemini_api_key: Optional[str] = None,
    groq_api_key: Optional[str] = None,
    cohere_api_key: Optional[str] = None,
) -> Tuple[Optional[Announcement], Optional[str]]:
    """Executes the multi-layer LLM cascade for generating a bilingual public address announcement.

    Cascade Layers:
        1. Layer 1 — Google Gemini (`gemini-1.5-flash`) via `google-generativeai`
        2. Layer 2 — Groq (`llama-3.1-8b-instant`) via `groq`
        3. Layer 3 — Cohere (`command-r`) via `cohere`
        (Layer 4 rule template fallback is handled by the caller when this returns None)

    Args:
        zone_id: Zone identifier.
        zone_name: Display name of the zone.
        risk_level: Current risk level ('low', 'medium', 'high', 'critical').
        density_per_sqm: Measured crowd density in people/m².
        flow_speed_mps: Measured crowd flow velocity in m/s.
        eta_minutes: Estimated time in minutes to critical surge.
        recommendations: Action recommendations generated for operators.
        gemini_api_key: Optional Gemini API key override.
        groq_api_key: Optional Groq API key override.
        cohere_api_key: Optional Cohere API key override.

    Returns:
        Tuple of (Announcement, layer_name) if any API layer succeeds; (None, None) if all fail.
    """
    if not is_llm_enabled():
        return None, None

    recs_text = ", ".join(recommendations) if recommendations else "None"
    eta_text = f"{eta_minutes} minutes" if eta_minutes is not None else "N/A"

    system_prompt = (
        "You are CrowdShield's emergency public address communications AI for mass gathering events.\n"
        "Your task is to generate calm, clear, authoritative, and reassuring public address announcements "
        "in both English and Hindi based on the provided live sensor context.\n\n"
        "Rules:\n"
        "1. Announcements MUST NOT cause panic, stampede, or alarmist screaming.\n"
        "2. Keep the message concise, clear, and strictly UNDER 30 WORDS per language.\n"
        "3. Provide calm, actionable crowd directions (e.g. keep moving forward, use alternate exits).\n"
        "4. Respond ONLY with a valid JSON object with exactly two keys: 'en' and 'hi'.\n"
        "Do NOT include markdown formatting, backticks, or any preamble or explanation."
    )

    user_prompt = (
        f"Zone: {zone_name} ({zone_id})\n"
        f"Risk Level: {risk_level.upper()}\n"
        f"Crowd Density: {density_per_sqm:.2f} people/m²\n"
        f"Flow Speed: {flow_speed_mps:.2f} m/s\n"
        f"ETA to Critical Surge: {eta_text}\n"
        f"Active Operator Recommendations: {recs_text}\n\n"
        "Generate the calming bilingual public address announcement JSON (under 30 words per language):"
    )

    # Layer 1: Gemini (Primary)
    ann = _call_gemini(
        prompt=user_prompt,
        system_prompt=system_prompt,
        api_key=gemini_api_key,
    )
    if ann is not None:
        logger.info("Using Layer 1 (Gemini: gemini-1.5-flash) for bilingual announcement.")
        return ann, "gemini"

    # Layer 2: Groq (Secondary Fallback)
    ann = _call_groq(
        prompt=user_prompt,
        system_prompt=system_prompt,
        api_key=groq_api_key,
    )
    if ann is not None:
        logger.info("Using Layer 2 (Groq: llama-3.1-8b-instant) for bilingual announcement.")
        return ann, "groq"

    # Layer 3: Cohere (Tertiary Fallback)
    ann = _call_cohere(
        prompt=user_prompt,
        system_prompt=system_prompt,
        api_key=cohere_api_key,
    )
    if ann is not None:
        logger.info("Using Layer 3 (Cohere: command-r) for bilingual announcement.")
        return ann, "cohere"

    # All API layers failed
    return None, None


def generate_llm_announcement(
    zone_id: str,
    zone_name: str,
    risk_level: str,
    density_per_sqm: float,
    flow_speed_mps: float,
    eta_minutes: Optional[int] = None,
    recommendations: Optional[List[str]] = None,
    api_key: Optional[str] = None,
    model: Optional[str] = None,
) -> Optional[Announcement]:
    """Generates a situationally aware bilingual announcement using the 4-layer LLM cascade.

    Args:
        zone_id: Zone identifier.
        zone_name: Display name of the zone.
        risk_level: Current risk level ('low', 'medium', 'high', 'critical').
        density_per_sqm: Measured crowd density.
        flow_speed_mps: Measured flow velocity.
        eta_minutes: Estimated time in minutes to critical surge.
        recommendations: Action recommendations generated for operators.
        api_key: Optional API key override for primary layer (Gemini).
        model: Optional model identifier override.

    Returns:
        `Announcement` object if any cascade API call succeeds; None if all fail.

    Why this exists:
        Produces dynamic, calming, context-specific crowd announcements that adjust tone,
        urgency, and directional advice to the exact real-time scenario.
    """
    ann, _ = generate_llm_cascade_announcement(
        zone_id=zone_id,
        zone_name=zone_name,
        risk_level=risk_level,
        density_per_sqm=density_per_sqm,
        flow_speed_mps=flow_speed_mps,
        eta_minutes=eta_minutes,
        recommendations=recommendations,
        gemini_api_key=api_key,
    )
    return ann


# ---------------------------------------------------------------------------
# Recommendation Engine Class & Top-Level Interface
# ---------------------------------------------------------------------------


class RecommendationEngine:
    """Four-layer recommendation and announcement engine with deterministic and LLM tiers.

    Cascade Architecture:
        - Layer 1: Google Gemini (gemini-1.5-flash, Primary)
        - Layer 2: Groq (llama-3.1-8b-instant, Secondary Fallback)
        - Layer 3: Cohere (command-r, Tertiary Fallback)
        - Layer 4: Deterministic Rule Templates (Quaternary Guaranteed Fallback)

    Attributes:
        use_llm: Optional boolean override for LLM cascade. If None, checks environment.
        api_key: Optional API key override for primary layer (Gemini).
    """

    def __init__(
        self,
        use_llm: Optional[bool] = None,
        api_key: Optional[str] = None,
    ) -> None:
        """Initializes the RecommendationEngine.

        Args:
            use_llm: Optional explicit boolean flag to toggle LLM cascade. If None, respects environment.
            api_key: Optional API key override for primary layer (Gemini).

        Why this exists:
            Configures the engine instance for testing or production deployment.
        """
        self.use_llm = use_llm
        self.api_key = api_key

    def generate(
        self,
        event: Union[Any, Dict[str, Any]],
        adjacent_capacities: Optional[Dict[str, float]] = None,
    ) -> RecommendationResult:
        """Processes a RiskEvent and returns operator recommendations and a bilingual announcement.

        Args:
            event: A `RiskEvent` instance (from `pipeline.models` or `risk_engine.RiskEvent`) or
                a dictionary matching the shared event contract schema.
            adjacent_capacities: Optional dictionary mapping zone IDs to current density/load metrics.

        Returns:
            `RecommendationResult` containing `recommendations: List[str]`, `announcement: Announcement`,
            and `used_llm: Union[bool, str]`.

        Why this exists:
            Main interface for generating intelligent crowd interventions from risk telemetry.
        """
        # Extract fields safely from Pydantic model or dict
        if hasattr(event, "model_dump"):
            data = event.model_dump()
        elif isinstance(event, dict):
            data = event
        else:
            data = {
                "zone_id": getattr(event, "zone_id", "gate_1"),
                "zone_name": getattr(event, "zone_name", None),
                "risk_level": getattr(event, "risk_level", "low"),
                "density_per_sqm": getattr(event, "density_per_sqm", 0.0),
                "flow_speed_mps": getattr(event, "flow_speed_mps", 1.2),
                "eta_minutes": getattr(event, "eta_minutes", None),
                "flow_direction": getattr(event, "flow_direction", None),
            }

        zone_id = str(data.get("zone_id", "gate_1"))
        meta = VENUE_MAP.get(zone_id)
        zone_name = data.get("zone_name") or (meta.zone_name if meta else zone_id.replace("_", " ").title())
        risk_level = str(data.get("risk_level", "low"))
        density_sqm = float(data.get("density_per_sqm", 0.0))
        flow_speed_mps = float(data.get("flow_speed_mps", 1.2))
        eta_minutes = data.get("eta_minutes")
        flow_direction = data.get("flow_direction")
        if hasattr(flow_direction, "value"):
            flow_direction = flow_direction.value

        # 1. Deterministic Rule Layer Recommendations
        recommendations = generate_rule_recommendations(
            zone_id=zone_id,
            risk_level=risk_level,
            adjacent_capacities=adjacent_capacities,
            flow_direction=str(flow_direction) if flow_direction else None,
        )

        # 2. Identify Target Relief Gate Name for Announcement
        target_zone_id, _ = get_optimal_alternate_zone(zone_id, adjacent_capacities)
        target_meta = VENUE_MAP.get(target_zone_id)
        target_name = target_meta.zone_name if target_meta else target_zone_id.replace("_", " ").title()

        # 3. Deterministic Rule Layer Announcement (Default Fallback)
        rule_announcement = generate_rule_announcement(
            zone_id=zone_id,
            risk_level=risk_level,
            zone_name=zone_name,
            target_zone_name=target_name,
        )

        # 4. Optional 4-Layer LLM Cascade Announcement
        llm_announcement: Optional[Announcement] = None
        used_layer: Optional[str] = None
        should_attempt_llm = is_llm_enabled() if self.use_llm is None else self.use_llm

        if should_attempt_llm:
            llm_announcement, used_layer = generate_llm_cascade_announcement(
                zone_id=zone_id,
                zone_name=zone_name,
                risk_level=risk_level,
                density_per_sqm=density_sqm,
                flow_speed_mps=flow_speed_mps,
                eta_minutes=int(eta_minutes) if eta_minutes is not None else None,
                recommendations=recommendations,
                gemini_api_key=self.api_key,
            )

        if llm_announcement is not None and used_layer:
            final_announcement = llm_announcement
            used_llm: Union[bool, str] = used_layer
        else:
            logger.info("Using Layer 4 (Deterministic rule-based templates) for announcement.")
            final_announcement = rule_announcement
            used_llm = False

        return RecommendationResult(
            recommendations=recommendations,
            announcement=final_announcement,
            used_llm=used_llm,
        )


def get_recommendations(
    event: Union[Any, Dict[str, Any]],
    adjacent_capacities: Optional[Dict[str, float]] = None,
    use_llm: Optional[bool] = None,
    api_key: Optional[str] = None,
) -> RecommendationResult:
    """Convenience function to generate recommendations and announcements for a RiskEvent.

    Args:
        event: `RiskEvent` instance or event dictionary.
        adjacent_capacities: Optional dictionary mapping zone IDs to density/load metrics.
        use_llm: Optional explicit boolean flag to toggle LLM cascade.
        api_key: Optional API key override for primary layer (Gemini).

    Returns:
        `RecommendationResult` containing recommendations list and bilingual announcement.

    Why this exists:
        Provides a functional one-liner interface without needing explicit engine instantiation.
    """
    engine = RecommendationEngine(use_llm=use_llm, api_key=api_key)
    return engine.generate(event=event, adjacent_capacities=adjacent_capacities)
