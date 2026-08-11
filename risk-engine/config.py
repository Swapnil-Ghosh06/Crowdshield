"""
CrowdShield — Risk Engine Configuration
----------------------------------------
Configurable parameters, scoring weights, and threshold definitions for predictive
crowd risk scoring and time-to-critical (ETA) estimation.

Why this exists:
    Decouples all physical calibration constants, weighting hyper-parameters, and
    risk level boundary thresholds from the core calculation logic. This allows
    safety operators to calibrate the engine for specific venue geometries (e.g. narrow
    stairways vs. wide plazas) without altering the algorithmic code.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, Any


@dataclass(frozen=True)
class RiskEngineConfig:
    """Tunable configuration parameters for the transparent crowd risk prediction engine.

    Attributes:
        window_size: Number of consecutive readings kept in memory per zone for trend analysis.
        min_samples_for_trend: Minimum historical samples required to compute a valid linear slope.
        critical_density_sqm: Critical crowd density threshold (people/m²) representing imminent crush risk.
        warning_density_sqm: Warning crowd density threshold (people/m²) where movement becomes restricted.
        safe_density_sqm: Baseline density threshold (people/m²) for completely unimpeded free movement.
        free_flow_speed_mps: Normal, unimpeded walking speed in metres per second.
        stagnant_speed_mps: Speed in m/s below which movement is considered jammed/stagnant.
        weight_density: Relative weight ($w_d$) of current density proximity to critical threshold.
        weight_trend: Relative weight ($w_t$) of the rate of density change (gradient over time).
        weight_flow: Relative weight ($w_f$) of flow speed reduction below free-flow speed.
        weight_bottleneck: Relative weight ($w_b$) of the non-linear density-flow stagnation penalty.
        threshold_medium: Minimum composite risk score to classify risk level as 'medium'.
        threshold_high: Minimum composite risk score to classify risk level as 'high'.
        threshold_critical: Minimum composite risk score to classify risk level as 'critical'.
        max_eta_minutes: Maximum prediction horizon in minutes for time-to-critical warnings.
    """

    window_size: int = 10
    min_samples_for_trend: int = 3

    # Physical crowd density benchmarks (people / m²)
    critical_density_sqm: float = 4.0
    warning_density_sqm: float = 2.5
    safe_density_sqm: float = 1.2

    # Physical velocity benchmarks (m / s)
    free_flow_speed_mps: float = 1.2
    stagnant_speed_mps: float = 0.3

    # Linear combination component weights (sum to 1.0)
    weight_density: float = 0.40
    weight_trend: float = 0.20
    weight_flow: float = 0.15
    weight_bottleneck: float = 0.25

    # Categorical classification thresholds
    threshold_medium: float = 0.30
    threshold_high: float = 0.60
    threshold_critical: float = 0.80

    # Predictive limits
    max_eta_minutes: int = 30

    def __post_init__(self) -> None:
        """Validates configuration parameters upon instantiation.

        Raises:
            ValueError: If thresholds are out of logical order or weights do not sum to positive value.

        Why this exists:
            Guarantees mathematical integrity of scoring calculations before processing real data.
        """
        if not (0.0 < self.safe_density_sqm < self.warning_density_sqm < self.critical_density_sqm):
            raise ValueError("Density thresholds must satisfy: 0 < safe < warning < critical")

        if not (0.0 <= self.threshold_medium < self.threshold_high < self.threshold_critical <= 1.0):
            raise ValueError("Risk score thresholds must satisfy: 0 <= medium < high < critical <= 1.0")

        total_weight = (
            self.weight_density
            + self.weight_trend
            + self.weight_flow
            + self.weight_bottleneck
        )
        if abs(total_weight - 1.0) > 1e-4:
            raise ValueError(f"Component weights must sum to 1.0 (currently sums to {total_weight:.4f})")

    def to_dict(self) -> Dict[str, Any]:
        """Serializes configuration settings to a dictionary.

        Returns:
            Dictionary representation of all configuration fields.

        Why this exists:
            Facilitates parameter logging, auditing, and config inspection.
        """
        return {
            "window_size": self.window_size,
            "min_samples_for_trend": self.min_samples_for_trend,
            "critical_density_sqm": self.critical_density_sqm,
            "warning_density_sqm": self.warning_density_sqm,
            "safe_density_sqm": self.safe_density_sqm,
            "free_flow_speed_mps": self.free_flow_speed_mps,
            "stagnant_speed_mps": self.stagnant_speed_mps,
            "weight_density": self.weight_density,
            "weight_trend": self.weight_trend,
            "weight_flow": self.weight_flow,
            "weight_bottleneck": self.weight_bottleneck,
            "threshold_medium": self.threshold_medium,
            "threshold_high": self.threshold_high,
            "threshold_critical": self.threshold_critical,
            "max_eta_minutes": self.max_eta_minutes,
        }
