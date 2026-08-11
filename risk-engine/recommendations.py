"""
CrowdShield — Recommendation Engine (Rule Layer + Multilingual LLM Layer)
-------------------------------------------------------------------------
Computes actionable operator interventions and calm, clear bilingual public announcements
for crowd safety management across venue zones.

Architecture:
    1. Deterministic Rule Layer:
       - Uses a hardcoded 4-zone topological adjacency map (gate_1 South, gate_2 West, gate_3 North, gate_4 East).
       - Evaluates zone risk level, directional geometry, and neighbouring zone capacities to produce
         deterministic operator action tokens (e.g. "open_gate_2", "redirect_flow_west", "deploy_staff_gate_1").
       - Provides guaranteed deterministic fallback bilingual announcements (English + Hindi).

    2. Optional LLM Layer (Anthropic Claude):
       - When enabled via `RECOMMENDATIONS_USE_LLM=true` and `ANTHROPIC_API_KEY` is present, calls the
         Anthropic Messages API to synthesize context-aware, calming public address announcements.
       - Wrapped in a fail-safe try/except block to ensure zero disruption: any API error, rate limit,
         timeout, or missing key seamlessly falls back to the deterministic rule announcement.

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
    used_llm: bool = Field(
        default=False,
        description="Flag indicating whether the announcement was generated via LLM.",
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
        zone_id: Identifier of the congested zone.
        adjacent_capacities: Optional dictionary mapping `zone_id` to its current congestion
            or density metric (lower value indicates greater available capacity / headroom).

    Returns:
        Tuple of `(target_zone_id, target_cardinal_direction_lowercase)` (e.g. `("gate_2", "west")`).

    Why this exists:
        Prevents blind crowd redirection by choosing the neighbouring gate with the highest
        available capacity to avoid creating cascading stampede points.
    """
    metadata = VENUE_MAP.get(zone_id)
    if not metadata or not metadata.adjacent_zones:
        return "gate_2", "west"

    adjacent_list = metadata.adjacent_zones

    if adjacent_capacities:
        # Pick the adjacent zone with the lowest congestion/density score
        best_zone = min(
            adjacent_list,
            key=lambda z: adjacent_capacities.get(z, 0.0),
        )
    else:
        # Default to first adjacent zone in topology
        best_zone = adjacent_list[0]

    direction = metadata.adjacent_directions.get(best_zone, "north").lower()
    return best_zone, direction


# ---------------------------------------------------------------------------
# Deterministic Rule Layer
# ---------------------------------------------------------------------------


def generate_rule_recommendations(
    zone_id: str,
    risk_level: str,
    adjacent_capacities: Optional[Dict[str, float]] = None,
    bottleneck_detected: bool = False,
    flow_direction: Optional[str] = None,
) -> List[str]:
    """Generates an ordered list of deterministic operator intervention actions based on zone physics.

    Args:
        zone_id: Machine-readable identifier for the zone (e.g. 'gate_1').
        risk_level: Risk classification ('low', 'medium', 'high', 'critical').
        adjacent_capacities: Optional dictionary mapping zone IDs to current density/load.
        bottleneck_detected: Boolean flag if severe flow stagnation was detected.
        flow_direction: Optional detected crowd movement direction.

    Returns:
        Ordered list of actionable operator strings.

    Why this exists:
        Ensures guaranteed, sub-millisecond operator SOP guidance with zero external dependencies.
    """
    normalized_level = (risk_level or "low").lower().strip()
    target_zone, target_dir = get_optimal_alternate_zone(zone_id, adjacent_capacities)

    if normalized_level == "low":
        return [
            "maintain_standard_monitoring",
            f"monitor_{zone_id}",
            "normal_flow",
        ]

    elif normalized_level == "medium":
        recs = [
            f"increase_monitoring_{zone_id}",
            f"prepare_staff_{zone_id}",
            f"standby_alternate_{target_zone}",
            "increase_monitoring",
            "prepare_staff",
        ]
        if bottleneck_detected:
            recs.insert(0, f"check_obstruction_{zone_id}")
        return recs

    elif normalized_level == "high":
        recs = [
            f"open_{target_zone}",
            f"redirect_flow_{target_dir}",
            f"deploy_staff_{zone_id}",
            "open_alternate_gate",
            "redirect_crowd_flow",
            "deploy_staff",
        ]
        if zone_id == "gate_4":
            recs.append("open_side_corridor_exits")
        if flow_direction == "away_from_exit":
            recs.insert(0, f"counter_flow_barrier_{zone_id}")
        return recs

    elif normalized_level == "critical":
        recs = [
            f"close_{zone_id}",
            "emergency_broadcast",
            f"deploy_all_staff_{zone_id}",
            f"redirect_flow_{target_dir}",
            f"open_{target_zone}",
            "call_security",
            "deploy_all_staff",
            "close_gate",
        ]
        if zone_id == "gate_4":
            recs.append("open_side_corridor_exits")
        return recs

    # Fallback default
    return ["maintain_standard_monitoring", f"monitor_{zone_id}"]


def generate_rule_announcement(
    zone_id: str,
    risk_level: str,
    zone_name: Optional[str] = None,
    target_zone_name: Optional[str] = None,
) -> Announcement:
    """Generates deterministic bilingual English and Hindi public address announcements.

    Args:
        zone_id: Machine-readable identifier for the zone.
        risk_level: Risk classification ('low', 'medium', 'high', 'critical').
        zone_name: Optional display name for the current zone.
        target_zone_name: Optional display name of the designated relief zone.

    Returns:
        `Announcement` object containing 'en' and 'hi' announcements.

    Why this exists:
        Provides clear, calming, and culturally accessible public address announcements
        that are guaranteed to work even during complete network partitions.
    """
    normalized_level = (risk_level or "low").lower().strip()
    meta = VENUE_MAP.get(zone_id)
    display_name = zone_name or (meta.zone_name if meta else zone_id.replace("_", " ").title())
    alt_name = target_zone_name or "the nearest marked exit"

    if normalized_level == "low":
        return Announcement(
            en=f"Welcome. Crowd flow at {display_name} is normal. Please proceed smoothly and enjoy the event.",
            hi=f"स्वागत है। {display_name} पर भीड़ का प्रवाह सामान्य है। कृपया सुगमता से आगे बढ़ें और कार्यक्रम का आनंद लें।",
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
# LLM Layer (Anthropic Claude API)
# ---------------------------------------------------------------------------


def is_llm_enabled() -> bool:
    """Checks if the LLM recommendation layer is enabled via environment variable.

    Returns:
        True if `RECOMMENDATIONS_USE_LLM` is set to 'true', '1', or 'yes'; False otherwise.

    Why this exists:
        Enables runtime toggling of LLM capabilities without code modification.
    """
    flag = os.environ.get("RECOMMENDATIONS_USE_LLM", "false").strip().lower()
    return flag in ("true", "1", "yes", "on")


def generate_llm_announcement(
    zone_id: str,
    zone_name: str,
    risk_level: str,
    density_per_sqm: float,
    flow_speed_mps: float,
    eta_minutes: Optional[int] = None,
    recommendations: Optional[List[str]] = None,
    api_key: Optional[str] = None,
    model: str = "claude-3-5-haiku-20241022",
) -> Optional[Announcement]:
    """Generates a situationally aware bilingual announcement using the Anthropic Claude API.

    Args:
        zone_id: Zone identifier.
        zone_name: Display name of the zone.
        risk_level: Current risk level ('low', 'medium', 'high', 'critical').
        density_per_sqm: Measured crowd density.
        flow_speed_mps: Measured flow velocity.
        eta_minutes: Estimated time in minutes to critical surge.
        recommendations: Action recommendations generated for operators.
        api_key: Optional Anthropic API key. If None, reads from `ANTHROPIC_API_KEY` env var.
        model: Anthropic model identifier.

    Returns:
        `Announcement` object if API call succeeds and returns valid JSON; None on any failure.

    Why this exists:
        Produces dynamic, calming, context-specific crowd announcements that adjust tone,
        urgency, and directional advice to the exact real-time scenario.
    """
    # 1. Environment & API Key validation
    if not is_llm_enabled():
        return None

    resolved_api_key = api_key or os.environ.get("ANTHROPIC_API_KEY")
    if not resolved_api_key or not resolved_api_key.strip():
        logger.debug("Anthropic API key is missing or empty; skipping LLM layer.")
        return None

    try:
        import anthropic
    except ImportError:
        logger.warning("The 'anthropic' package is not installed; falling back to rule layer.")
        return None

    # 2. Construct LLM Prompt
    recs_text = ", ".join(recommendations) if recommendations else "None"
    eta_text = f"{eta_minutes} minutes" if eta_minutes is not None else "N/A"

    system_prompt = (
        "You are CrowdShield's emergency public address communications AI for mass gathering events.\n"
        "Your task is to generate calm, clear, authoritative, and reassuring public address announcements "
        "in both English and Hindi based on the provided live sensor context.\n\n"
        "Rules:\n"
        "1. Announcements MUST NOT cause panic, stampede, or alarmist screaming.\n"
        "2. Keep the message concise (1-2 sentences in English, 1-2 sentences in Hindi).\n"
        "3. Provide explicit, actionable crowd directions (e.g. keep moving, use alternate gates).\n"
        "4. Respond ONLY with a valid JSON object having exactly two keys: 'en' and 'hi'.\n"
        "Do NOT include markdown formatting, backticks, or preamble."
    )

    user_content = (
        f"Zone: {zone_name} ({zone_id})\n"
        f"Risk Level: {risk_level.upper()}\n"
        f"Crowd Density: {density_per_sqm:.2f} people/m²\n"
        f"Flow Speed: {flow_speed_mps:.2f} m/s\n"
        f"ETA to Critical: {eta_text}\n"
        f"Active Operator Interventions: {recs_text}\n\n"
        "Generate the bilingual public announcement JSON."
    )

    # 3. Call Anthropic Messages API inside fail-safe try/except
    try:
        client = anthropic.Anthropic(api_key=resolved_api_key)
        message = client.messages.create(
            model=model,
            max_tokens=300,
            temperature=0.2,
            system=system_prompt,
            messages=[{"role": "user", "content": user_content}],
        )

        content_text = ""
        for block in message.content:
            if getattr(block, "type", None) == "text":
                content_text += block.text

        # Strip markdown fences if present
        clean_text = content_text.strip()
        if clean_text.startswith("```json"):
            clean_text = clean_text[7:]
        if clean_text.startswith("```"):
            clean_text = clean_text[3:]
        if clean_text.endswith("```"):
            clean_text = clean_text[:-3]
        clean_text = clean_text.strip()

        data = json.loads(clean_text)
        if isinstance(data, dict) and "en" in data and "hi" in data:
            if isinstance(data["en"], str) and isinstance(data["hi"], str):
                if data["en"].strip() and data["hi"].strip():
                    return Announcement(en=data["en"].strip(), hi=data["hi"].strip())

        logger.warning("LLM response did not conform to expected JSON shape: %s", content_text)
        return None

    except Exception as exc:
        logger.warning("Anthropic Claude API call failed (%s); falling back to rule layer announcement.", exc)
        return None


# ---------------------------------------------------------------------------
# Recommendation Engine Class & Top-Level Interface
# ---------------------------------------------------------------------------


class RecommendationEngine:
    """Two-layer recommendation and announcement engine with deterministic and LLM tiers.

    Attributes:
        use_llm: Optional boolean override for LLM usage. If None, checks `RECOMMENDATIONS_USE_LLM`.
        api_key: Optional Anthropic API key override.
    """

    def __init__(
        self,
        use_llm: Optional[bool] = None,
        api_key: Optional[str] = None,
    ) -> None:
        """Initializes the RecommendationEngine.

        Args:
            use_llm: Optional explicit boolean flag to toggle LLM. If None, respects environment.
            api_key: Optional Anthropic API key override.

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
            and `used_llm: bool`.

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

        # 4. Optional LLM Layer Announcement
        llm_announcement: Optional[Announcement] = None
        should_attempt_llm = is_llm_enabled() if self.use_llm is None else self.use_llm

        if should_attempt_llm:
            llm_announcement = generate_llm_announcement(
                zone_id=zone_id,
                zone_name=zone_name,
                risk_level=risk_level,
                density_per_sqm=density_sqm,
                flow_speed_mps=flow_speed_mps,
                eta_minutes=int(eta_minutes) if eta_minutes is not None else None,
                recommendations=recommendations,
                api_key=self.api_key,
            )

        if llm_announcement is not None:
            final_announcement = llm_announcement
            used_llm = True
        else:
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
        use_llm: Optional explicit boolean flag to toggle LLM.
        api_key: Optional Anthropic API key override.

    Returns:
        `RecommendationResult` containing recommendations list and bilingual announcement.

    Why this exists:
        Provides a functional one-liner interface without needing explicit engine instantiation.
    """
    engine = RecommendationEngine(use_llm=use_llm, api_key=api_key)
    return engine.generate(event=event, adjacent_capacities=adjacent_capacities)
