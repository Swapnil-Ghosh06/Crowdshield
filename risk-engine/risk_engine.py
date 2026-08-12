"""
CrowdShield — Transparent Risk Prediction Engine
-------------------------------------------------
Core predictive risk analysis module that ingests rolling-window crowd density and flow
readings from the vision engine and computes explainable risk scores, categorical danger
levels, time-to-critical (ETA) estimates, and actionable intervention SOPs.

Scoring Formula (Explainable / No Black-Box ML):
    $$\\text{risk\\_score} = \\min(1.0, \\max(0.0, w_d S_d + w_t S_t + w_f S_f + w_b P_b))$$
    Where:
        - $S_d$: Density score normalized against critical threshold $D_{\\text{critical}}$.
        - $S_t$: Density rate of change (gradient $\\Delta D / \\Delta t$ over rolling window).
        - $S_f$: Flow speed impairment relative to free-flow velocity $V_{\\text{free}}$.
        - $P_b$: Non-linear bottleneck compression penalty ($S_d \\times S_f$).

Contract Compliance:
    Emits `RiskEvent` payloads matching the shared wire format defined in `pipeline/models.py`.
"""

from __future__ import annotations

from collections import deque
from datetime import datetime, timezone
import logging
from typing import Any, Deque, Dict, List, Literal, Optional, Tuple, Union
import numpy as np
from pydantic import BaseModel, Field

try:
    from config import RiskEngineConfig
    from explainability import RiskBreakdown, generate_explanation
    from rules import Announcement, generate_announcements, generate_recommendations
except ImportError:
    from .config import RiskEngineConfig
    from .explainability import RiskBreakdown, generate_explanation
    from .rules import Announcement, generate_announcements, generate_recommendations

logger = logging.getLogger("risk_engine")

RiskLevel = Literal["low", "medium", "high", "critical"]


class RiskEvent(BaseModel):
    """Canonical crowd risk snapshot for a single zone at a point in time.

    Matches the shared wire contract required by the pipeline, dashboard, and mobile app.
    """

    zone_id: str = Field(..., description="Stable machine-readable identifier for the zone.")
    zone_name: str = Field(..., description="Human-readable display label for the zone.")
    timestamp: str = Field(..., description="ISO 8601 UTC timestamp of snapshot.")
    density_per_sqm: float = Field(..., ge=0.0, description="Crowd density (people / m²).")
    flow_speed_mps: float = Field(..., ge=0.0, description="Average flow velocity in m/s.")
    risk_score: float = Field(..., ge=0.0, le=1.0, description="Normalised risk score in [0.0, 1.0].")
    risk_level: RiskLevel = Field(..., description="Categorical risk level.")
    eta_minutes: Optional[int] = Field(None, description="Estimated minutes until critical state. Null when low.")
    recommendations: List[str] = Field(default_factory=list, description="Ordered operator action list.")
    announcement: Announcement = Field(..., description="Bilingual English/Hindi PA announcement.")


class ZoneReading:
    """Internal lightweight container for a single historical zone measurement.

    Why this exists:
        Stores timestamp and physical metrics in the rolling memory window for gradient calculation.
    """

    __slots__ = ("timestamp_sec", "density_per_sqm", "flow_speed_mps", "flow_direction")

    def __init__(
        self,
        timestamp_sec: float,
        density_per_sqm: float,
        flow_speed_mps: float,
        flow_direction: Optional[str] = None,
    ) -> None:
        self.timestamp_sec = timestamp_sec
        self.density_per_sqm = density_per_sqm
        self.flow_speed_mps = flow_speed_mps
        self.flow_direction = flow_direction


class RiskEngine:
    """Predictive, rule-based risk evaluation engine with per-zone rolling window memory.

    Attributes:
        config: `RiskEngineConfig` instance containing thresholds, weights, and parameters.
    """

    def __init__(self, config: Optional[RiskEngineConfig] = None) -> None:
        """Initializes the Risk Engine.

        Args:
            config: Optional configuration instance. If None, default `RiskEngineConfig` is used.

        Why this exists:
            Sets up the scoring parameters and initializes per-zone rolling history queues.
        """
        self.config = config or RiskEngineConfig()
        self._zone_windows: Dict[str, Deque[ZoneReading]] = {}
        self._latest_events: Dict[str, RiskEvent] = {}
        self._latest_breakdowns: Dict[str, RiskBreakdown] = {}

    def reset_zone(self, zone_id: str) -> None:
        """Clears rolling history for a specific zone.

        Args:
            zone_id: Identifier of the zone to reset.

        Why this exists:
            Allows clean cache resets when restarting streams or running independent tests.
        """
        if zone_id in self._zone_windows:
            self._zone_windows[zone_id].clear()
        self._latest_events.pop(zone_id, None)
        self._latest_breakdowns.pop(zone_id, None)

    def reset_all(self) -> None:
        """Clears rolling history across all tracked zones.

        Why this exists:
            Resets engine state between test runs or system reboots.
        """
        self._zone_windows.clear()
        self._latest_events.clear()
        self._latest_breakdowns.clear()

    def process_estimate(
        self,
        estimate: Union[Any, Dict[str, Any]],
    ) -> RiskEvent:
        """Processes a single density estimate reading and returns a fully populated `RiskEvent`.

        Args:
            estimate: Either a `ZoneDensityEstimate` object from vision engine or a dictionary
                containing `zone_id`, `density_per_sqm`, `flow_speed_mps`, and optional metadata.

        Returns:
            Validated `RiskEvent` instance matching the pipeline wire contract.

        Why this exists:
            Primary public interface for feeding vision engine readings into risk analysis.
        """
        # Extract fields flexibly from Pydantic model or dict
        if hasattr(estimate, "model_dump"):
            data = estimate.model_dump()
        elif isinstance(estimate, dict):
            data = estimate
        else:
            data = {
                "zone_id": getattr(estimate, "zone_id", "zone_1"),
                "zone_name": getattr(estimate, "zone_name", None),
                "density_per_sqm": getattr(estimate, "density_per_sqm", 0.0),
                "flow_speed_mps": getattr(estimate, "flow_speed_mps", 0.0),
                "flow_direction": getattr(estimate, "flow_direction", None),
                "timestamp": getattr(estimate, "timestamp", None),
                "video_time_sec": getattr(estimate, "video_time_sec", None),
            }

        zone_id = str(data.get("zone_id", "gate_1"))
        zone_name = data.get("zone_name") or zone_id.replace("_", " ").title()
        density_sqm = max(0.0, float(data.get("density_per_sqm", 0.0)))
        flow_speed_mps = max(0.0, float(data.get("flow_speed_mps", 0.0)))
        flow_direction = data.get("flow_direction")
        if hasattr(flow_direction, "value"):
            flow_direction = flow_direction.value

        # Resolve timestamp and continuous seconds offset
        iso_timestamp = data.get("timestamp") or datetime.now(timezone.utc).isoformat()
        video_time_sec = data.get("video_time_sec")
        if video_time_sec is not None:
            time_sec = float(video_time_sec)
        else:
            time_sec = datetime.now(timezone.utc).timestamp()

        # Update rolling window
        if zone_id not in self._zone_windows:
            self._zone_windows[zone_id] = deque(maxlen=self.config.window_size)

        reading = ZoneReading(
            timestamp_sec=time_sec,
            density_per_sqm=density_sqm,
            flow_speed_mps=flow_speed_mps,
            flow_direction=str(flow_direction) if flow_direction else None,
        )
        self._zone_windows[zone_id].append(reading)

        # 1. Calculate Density Proximity Score (S_d)
        density_score = self._compute_density_score(density_sqm)

        # 2. Calculate Density Gradient Trend (S_t) and Slope (dD/dt)
        trend_score, density_slope_per_sec = self._compute_trend_score(zone_id)

        # 3. Calculate Flow Impairment Score (S_f)
        flow_score = self._compute_flow_score(flow_speed_mps)

        # 4. Calculate Non-linear Bottleneck Penalty (P_b)
        bottleneck_score = self._compute_bottleneck_penalty(density_score, flow_score)

        # 5. Compute Composite Risk Score
        raw_score = (
            self.config.weight_density * density_score
            + self.config.weight_trend * trend_score
            + self.config.weight_flow * flow_score
            + self.config.weight_bottleneck * bottleneck_score
        )
        risk_score = round(float(np.clip(raw_score, 0.0, 1.0)), 2)

        # 6. Determine Categorical Risk Level
        risk_level = self._classify_risk_level(risk_score)

        # 7. Compute Predictive ETA to Critical (eta_minutes)
        eta_minutes = self._compute_eta_minutes(
            current_density=density_sqm,
            density_slope_per_sec=density_slope_per_sec,
            risk_level=risk_level,
            risk_score=risk_score,
        )

        # 8. Generate Actionable Recommendations & Bilingual Announcements
        bottleneck_active = bottleneck_score > 0.35 or (
            density_sqm >= self.config.warning_density_sqm
            and flow_speed_mps <= self.config.stagnant_speed_mps
        )
        recommendations = generate_recommendations(
            zone_id=zone_id,
            zone_name=zone_name,
            risk_level=risk_level,
            bottleneck_detected=bottleneck_active,
            flow_direction=str(flow_direction) if flow_direction else None,
        )
        announcement = generate_announcements(
            zone_id=zone_id,
            zone_name=zone_name,
            risk_level=risk_level,
        )

        # 9. Store Explainability Diagnostics
        explanation_str = generate_explanation(
            zone_id=zone_id,
            zone_name=zone_name,
            density_sqm=density_sqm,
            flow_speed_mps=flow_speed_mps,
            density_slope_per_sec=density_slope_per_sec,
            density_score=density_score,
            trend_score=trend_score,
            flow_score=flow_score,
            bottleneck_score=bottleneck_score,
            composite_risk_score=risk_score,
            risk_level=risk_level,
            critical_density=self.config.critical_density_sqm,
            stagnant_speed=self.config.stagnant_speed_mps,
        )
        breakdown = RiskBreakdown(
            zone_id=zone_id,
            composite_risk_score=risk_score,
            risk_level=risk_level,
            density_score=round(density_score, 3),
            trend_score=round(trend_score, 3),
            flow_score=round(flow_score, 3),
            bottleneck_score=round(bottleneck_score, 3),
            current_density=density_sqm,
            current_flow_speed=flow_speed_mps,
            density_slope_per_sec=round(density_slope_per_sec, 4),
            explanation=explanation_str,
        )
        self._latest_breakdowns[zone_id] = breakdown

        # 10. Construct Final RiskEvent
        event = RiskEvent(
            zone_id=zone_id,
            zone_name=zone_name,
            timestamp=iso_timestamp,
            density_per_sqm=density_sqm,
            flow_speed_mps=flow_speed_mps,
            risk_score=risk_score,
            risk_level=risk_level,
            eta_minutes=eta_minutes,
            recommendations=recommendations,
            announcement=announcement,
        )
        self._latest_events[zone_id] = event

        return event

    def _compute_density_score(self, density_sqm: float) -> float:
        """Calculates normalized density proximity score ($S_d$).

        Args:
            density_sqm: Current measured density (people / m²).

        Returns:
            Float in [0.0, 1.0].

        Why this exists:
            Linear scaling against critical crush density benchmark.
        """
        if density_sqm <= 0.0:
            return 0.0
        return min(1.0, density_sqm / self.config.critical_density_sqm)

    def _compute_trend_score(self, zone_id: str) -> Tuple[float, float]:
        """Calculates rate of density change over the rolling window ($S_t$) and slope (dD/dt).

        Args:
            zone_id: Identifier of the zone.

        Returns:
            Tuple of (trend_score in [0.0, 1.0], density_slope_per_sec).

        Why this exists:
            Captures momentum: a rapidly escalating crowd is much more dangerous than a stable one.
        """
        window = self._zone_windows.get(zone_id)
        if not window or len(window) < self.config.min_samples_for_trend:
            return 0.0, 0.0

        times = np.array([r.timestamp_sec for r in window], dtype=np.float64)
        densities = np.array([r.density_per_sqm for r in window], dtype=np.float64)

        dt = times[-1] - times[0]
        if dt <= 0.01:
            return 0.0, 0.0

        # Perform linear regression to find slope (dD/dt in people/m²/sec)
        # Using centered covariance formulation for speed and precision
        times_centered = times - np.mean(times)
        densities_centered = densities - np.mean(densities)
        denom = np.sum(times_centered ** 2)
        if denom > 1e-6:
            slope = float(np.sum(times_centered * densities_centered) / denom)
        else:
            slope = float((densities[-1] - densities[0]) / dt)

        # Map slope (people/m²/sec) to [0.0, 1.0] trend score:
        # A slope of +0.10 p/m²/sec (+6 p/m²/min) represents an extreme surge -> 1.0
        # A negative slope (clearing crowd) -> 0.0
        if slope <= 0.0:
            trend_score = 0.0
        else:
            # Scale: +0.05 p/m²/sec gives 1.0
            trend_score = min(1.0, slope / 0.05)

        return trend_score, slope

    def _compute_flow_score(self, flow_speed_mps: float) -> float:
        """Calculates movement impairment score ($S_f$).

        Args:
            flow_speed_mps: Measured average movement velocity in m/s.

        Returns:
            Float in [0.0, 1.0]. (0 = free flow at or above 1.2 m/s, 1 = total gridlock at 0.0 m/s).

        Why this exists:
            Penalizes reduced evacuation velocity along egress paths.
        """
        if flow_speed_mps >= self.config.free_flow_speed_mps:
            return 0.0
        return max(0.0, 1.0 - (flow_speed_mps / self.config.free_flow_speed_mps))

    def _compute_bottleneck_penalty(
        self,
        density_score: float,
        flow_score: float,
    ) -> float:
        """Calculates non-linear bottleneck compression penalty ($P_b$).

        Args:
            density_score: Normalized density score in [0.0, 1.0].
            flow_score: Normalized flow impairment score in [0.0, 1.0].

        Returns:
            Float penalty in [0.0, 1.0].

        Why this exists:
            Captures the physics of crowd crushes: high density is fatal specifically when
            movement stalls into compression shockwaves ($P_b = S_d \\times S_f$).
        """
        return density_score * flow_score

    def _classify_risk_level(self, risk_score: float) -> RiskLevel:
        """Maps continuous numerical risk score to categorical alert level.

        Args:
            risk_score: Float in [0.0, 1.0].

        Returns:
            One of 'low', 'medium', 'high', 'critical'.

        Why this exists:
            Standardizes alert tiers across UI dashboards and PA broadcast triggers.
        """
        if risk_score >= self.config.threshold_critical:
            return "critical"
        elif risk_score >= self.config.threshold_high:
            return "high"
        elif risk_score >= self.config.threshold_medium:
            return "medium"
        else:
            return "low"

    def _compute_eta_minutes(
        self,
        current_density: float,
        density_slope_per_sec: float,
        risk_level: str,
        risk_score: float,
    ) -> Optional[int]:
        """Calculates estimated time in minutes until critical threshold is breached.

        Args:
            current_density: Current measured density in people/m².
            density_slope_per_sec: Rate of density change per second.
            risk_level: Current categorical risk level.
            risk_score: Current composite risk score.

        Returns:
            Integer minutes, 0 if already critical, or None if risk is low or trend is not escalating.

        Why this exists:
            Provides safety officers the crucial 6–15 minute early warning lead time to intervene.
        """
        # Low risk events return None per contract
        if risk_level == "low":
            return None

        # If already at or above critical density or critical risk score
        if current_density >= self.config.critical_density_sqm or risk_level == "critical":
            return 0

        # If density is climbing towards critical threshold
        if density_slope_per_sec > 1e-4:
            density_gap = self.config.critical_density_sqm - current_density
            time_to_crit_sec = density_gap / density_slope_per_sec
            eta_mins = int(round(time_to_crit_sec / 60.0))

            if eta_mins < 1:
                return 1
            if eta_mins > self.config.max_eta_minutes:
                return self.config.max_eta_minutes
            return eta_mins

        # If trend is stable or negative but risk is medium or high (e.g. sustained high congestion)
        if risk_level in ("medium", "high"):
            # Estimate indicative time based on current score proximity to critical
            score_gap = self.config.threshold_critical - risk_score
            if score_gap <= 0.10:
                return 5
            elif score_gap <= 0.25:
                return 10
            else:
                return 15

        return None

    def get_latest_event(self, zone_id: str) -> Optional[RiskEvent]:
        """Retrieves the most recent RiskEvent generated for a specific zone.

        Args:
            zone_id: Identifier of the zone.

        Returns:
            `RiskEvent` if available, None otherwise.

        Why this exists:
            Provides quick state retrieval for REST polling endpoints (`GET /events/latest`).
        """
        return self._latest_events.get(zone_id)

    def get_all_latest_events(self) -> Dict[str, RiskEvent]:
        """Retrieves latest RiskEvent for all active zones.

        Returns:
            Dictionary mapping `zone_id` to its latest `RiskEvent`.

        Why this exists:
            Supplies batch snapshots for multi-zone WebSocket broadcast cycles.
        """
        return dict(self._latest_events)

    def get_explanation(self, zone_id: str) -> Optional[RiskBreakdown]:
        """Retrieves explainability breakdown and diagnostic rationale for a zone's latest score.

        Args:
            zone_id: Zone identifier.

        Returns:
            `RiskBreakdown` object if available, None otherwise.

        Why this exists:
            Enables operator audit panels and live hackathon pitch explanations.
        """
        return self._latest_breakdowns.get(zone_id)
