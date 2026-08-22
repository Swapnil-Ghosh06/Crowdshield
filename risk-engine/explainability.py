"""
CrowdShield — Risk Explainability & Diagnostic Breakdown
---------------------------------------------------------
Provides detailed numerical term decompositions and human-readable diagnostic rationales
for every computed risk score.

Why this exists:
    In life-critical crowd safety operations and technical evaluations, black-box ML
    models cannot explain why a particular gate was flagged as dangerous. This module
    ensures safety officers, venue directors, and hackathon judges can inspect the exact
    mathematical contributions (density proximity, rate of escalation, flow stagnation,
    and bottleneck compression penalty) that produced the risk score.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Any


@dataclass(frozen=True)
class RiskBreakdown:
    """Detailed mathematical breakdown and natural language rationale for a risk event.

    Attributes:
        zone_id: Identifier of the analyzed physical zone.
        composite_risk_score: Normalized final risk score in [0.0, 1.0].
        risk_level: Categorical risk level ('low', 'medium', 'high', 'critical').
        density_score: Normalized score representing current crowd density relative to critical threshold ($S_d$).
        trend_score: Score representing rate of density increase over the rolling window ($S_t$).
        flow_score: Score representing movement speed impairment ($S_f$).
        bottleneck_score: Non-linear compression penalty triggered by high density + stagnant flow ($P_b$).
        current_density: Measured crowd density in people per square metre.
        current_flow_speed: Measured movement velocity in metres per second.
        density_slope_per_sec: Measured rate of density change per second ($\\Delta D / \\Delta t$).
        explanation: Natural language explanation summarizing why this score was produced.
    """

    zone_id: str
    composite_risk_score: float
    risk_level: str
    density_score: float
    trend_score: float
    flow_score: float
    bottleneck_score: float
    current_density: float
    current_flow_speed: float
    density_slope_per_sec: float
    explanation: str

    def to_dict(self) -> Dict[str, Any]:
        """Converts the breakdown into a dictionary payload for UI or API inspection.

        Returns:
            Dictionary with all individual component values and human explanation.

        Why this exists:
            Allows dashboard inspector panels or audit loggers to consume explainability metrics.
        """
        return {
            "zone_id": self.zone_id,
            "composite_risk_score": self.composite_risk_score,
            "risk_level": self.risk_level,
            "components": {
                "density_score": self.density_score,
                "trend_score": self.trend_score,
                "flow_score": self.flow_score,
                "bottleneck_score": self.bottleneck_score,
            },
            "metrics": {
                "current_density_sqm": self.current_density,
                "current_flow_speed_mps": self.current_flow_speed,
                "density_slope_per_sec": self.density_slope_per_sec,
            },
            "explanation": self.explanation,
        }


def generate_explanation(
    zone_id: str,
    zone_name: str,
    density_sqm: float,
    flow_speed_mps: float,
    density_slope_per_sec: float,
    density_score: float,
    trend_score: float,
    flow_score: float,
    bottleneck_score: float,
    composite_risk_score: float,
    risk_level: str,
    critical_density: float,
    stagnant_speed: float,
) -> str:
    """Constructs a clear, transparent, human-readable rationale for the assigned risk level.

    Args:
        zone_id: Machine identifier for the zone.
        zone_name: Display label for the zone.
        density_sqm: Current measured density in people/m².
        flow_speed_mps: Current measured flow speed in m/s.
        density_slope_per_sec: Rate of density change per second.
        density_score: Normalized density component score.
        trend_score: Normalized trend component score.
        flow_score: Normalized flow component score.
        bottleneck_score: Non-linear bottleneck penalty score.
        composite_risk_score: Final calculated risk score.
        risk_level: Assigned categorical risk level.
        critical_density: Critical density threshold setting.
        stagnant_speed: Stagnant flow threshold setting.

    Returns:
        String explaining the physical causes driving the score.

    Why this exists:
        Answers the question: "Why is zone X at risk level Y?" in plain, defensible terms.
    """
    reasons = []

    # Density statement
    density_pct = min(100, int((density_sqm / critical_density) * 100))
    reasons.append(f"Density is {density_sqm:.2f} p/m² ({density_pct}% of critical {critical_density:.1f} p/m² threshold)")

    # Trend statement
    if density_slope_per_sec > 0.05:
        reasons.append(f"density is surging rapidly (+{density_slope_per_sec * 60:.2f} p/m²/min)")
    elif density_slope_per_sec > 0.01:
        reasons.append(f"density is steadily rising (+{density_slope_per_sec * 60:.2f} p/m²/min)")
    elif density_slope_per_sec < -0.02:
        reasons.append(f"density is actively clearing ({density_slope_per_sec * 60:.2f} p/m²/min)")
    else:
        reasons.append("density is relatively stable")

    # Flow & Bottleneck statement
    if flow_speed_mps <= stagnant_speed:
        if bottleneck_score > 0.4:
            reasons.append(
                f"flow has severely stagnated to {flow_speed_mps:.2f} m/s causing dangerous crowd compression (bottleneck penalty active: {bottleneck_score:.2f})"
            )
        else:
            reasons.append(f"flow speed is low ({flow_speed_mps:.2f} m/s)")
    else:
        reasons.append(f"crowd is moving at a steady {flow_speed_mps:.2f} m/s")

    joined_reasons = ", ".join(reasons)
    return (
        f"Zone '{zone_name}' ({zone_id}) classified as '{risk_level.upper()}' (Score: {composite_risk_score:.2f}) "
        f"because {joined_reasons}."
    )
