"""
CrowdShield — Vision Engine Data Models
---------------------------------------
Pydantic v2 data models and enumeration definitions for crowd density and optical
flow estimation.

These models define the exact data contract produced by the vision processing engine
for each sampled video frame.  Downstream modules (such as `risk-engine/` and
`pipeline/`) consume these estimates to compute risk scores, time-to-critical (ETA),
and generate intervention recommendations.

Privacy Guarantee:
    These models only encapsulate numerical metrics and metadata.  No raw pixel
    arrays, facial embeddings, or identifiable biometric payloads are ever included
    in these schemas or transmitted downstream.
"""

from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class FlowDirection(str, Enum):
    """Categorical classification of aggregate crowd movement direction.

    Why this exists:
        Crowd dynamics exhibit characteristic directional patterns before stampedes
        and crushes (e.g. counter-flows, turbulent mixed motion, or sudden stagnation
        near bottlenecks).  Categorizing motion into discrete directions allows rule-based
        and heuristic risk engines to quickly flag dangerous flow reversals or blockages.
    """

    TOWARDS_EXIT = "towards_exit"
    AWAY_FROM_EXIT = "away_from_exit"
    STATIONARY = "stationary"
    MIXED = "mixed"


class DetectionBox(BaseModel):
    """In-memory bounding box representation for a detected individual or crowd cluster.

    Attributes:
        x: Horizontal coordinate of top-left corner (pixels).
        y: Vertical coordinate of top-left corner (pixels).
        width: Box width (pixels).
        height: Box height (pixels).
        confidence: Detector confidence score between 0.0 and 1.0.

    Why this exists:
        Provides a detector-agnostic representation of localized detections during
        in-frame processing.  Bounding boxes are processed transiently in memory to
        compute count and centroids, then discarded to preserve privacy.
    """

    model_config = ConfigDict(frozen=True)

    x: int = Field(..., ge=0, description="Top-left X coordinate in pixels.")
    y: int = Field(..., ge=0, description="Top-left Y coordinate in pixels.")
    width: int = Field(..., gt=0, description="Bounding box width in pixels.")
    height: int = Field(..., gt=0, description="Bounding box height in pixels.")
    confidence: float = Field(
        1.0,
        ge=0.0,
        le=1.0,
        description="Detection confidence score in [0.0, 1.0].",
    )

    @property
    def center(self) -> tuple[float, float]:
        """Calculates the geometric centroid of the bounding box.

        Returns:
            Tuple of (center_x, center_y) in pixel coordinates.

        Why this exists:
            Centroids are used for optical tracking and flow vector displacement calculation.
        """
        return (self.x + self.width / 2.0, self.y + self.height / 2.0)


class ZoneDensityEstimate(BaseModel):
    """Crowd density and optical flow estimation snapshot for a single zone at a sampled frame.

    This is the core output model emitted by `CrowdDensityEstimator` for each sampled time interval.

    Attributes:
        zone_id: Stable identifier for the monitored physical zone (e.g. "gate_3").
        zone_name: Descriptive human-readable label for the zone (e.g. "South Concourse Gate 3").
        timestamp: ISO 8601 UTC timestamp string at which this snapshot was generated.
        frame_index: Sequential integer index of the sampled video frame.
        video_time_sec: Elapsed playback time in seconds within the source video stream.
        person_count: Raw estimated head/person count detected in the zone area.
        zone_area_sqm: Calibrated physical area of the monitored zone in square metres.
        density_per_sqm: Estimated crowd density (people / m²).
        flow_speed_mps: Estimated average crowd movement velocity in metres per second.
        flow_direction: Categorical direction of crowd movement, or None if indeterminate.
        raw_motion_vector: Optional average motion vector [dx_px_per_sec, dy_px_per_sec].

    Why this exists:
        Acts as the strongly-typed data bridge between raw computer vision video processing
        and downstream safety analytics (risk scoring, bottleneck detection, PA announcements).
    """

    model_config = ConfigDict(
        populate_by_name=True,
        validate_assignment=True,
        json_schema_extra={
            "example": {
                "zone_id": "gate_3",
                "zone_name": "Gate 3 Entrance",
                "timestamp": "2026-08-11T12:00:00Z",
                "frame_index": 60,
                "video_time_sec": 2.0,
                "person_count": 85,
                "zone_area_sqm": 50.0,
                "density_per_sqm": 1.7,
                "flow_speed_mps": 0.85,
                "flow_direction": "towards_exit",
            }
        },
    )

    zone_id: str = Field(
        ...,
        examples=["gate_3"],
        description="Machine-readable zone identifier.",
    )
    zone_name: str = Field(
        ...,
        examples=["Gate 3 Entrance"],
        description="Human-readable display name for the zone.",
    )
    timestamp: str = Field(
        ...,
        description="ISO 8601 UTC timestamp when this estimation was sampled.",
    )
    frame_index: int = Field(
        ...,
        ge=0,
        description="Zero-indexed frame sequence number from the video stream.",
    )
    video_time_sec: float = Field(
        ...,
        ge=0.0,
        description="Timestamp in seconds relative to the start of the video.",
    )
    person_count: int = Field(
        ...,
        ge=0,
        description="Count of detected persons in the zone.",
    )
    zone_area_sqm: float = Field(
        ...,
        gt=0.0,
        description="Monitored physical surface area in square metres.",
    )
    density_per_sqm: float = Field(
        ...,
        ge=0.0,
        description="Calculated crowd density in people per square metre.",
    )
    flow_speed_mps: float = Field(
        ...,
        ge=0.0,
        description="Average crowd flow velocity in metres per second.",
    )
    flow_direction: Optional[FlowDirection] = Field(
        None,
        description="Direction of crowd movement relative to exit/flow axis.",
    )
    raw_motion_vector: Optional[List[float]] = Field(
        default=None,
        description="Average motion vector [vx_px_per_sec, vy_px_per_sec] in pixel space.",
    )

    def to_risk_input(self) -> Dict[str, Any]:
        """Formats the estimate into a dictionary payload ready for the risk scoring engine.

        Returns:
            Dictionary containing `zone_id`, `zone_name`, `timestamp`, `density_per_sqm`,
            `flow_speed_mps`, and `flow_direction`.

        Why this exists:
            Enables seamless, zero-boilerplate ingestion by `risk-engine/` analyzers.
        """
        return {
            "zone_id": self.zone_id,
            "zone_name": self.zone_name,
            "timestamp": self.timestamp,
            "density_per_sqm": self.density_per_sqm,
            "flow_speed_mps": self.flow_speed_mps,
            "flow_direction": self.flow_direction.value if self.flow_direction else None,
            "person_count": self.person_count,
            "zone_area_sqm": self.zone_area_sqm,
            "video_time_sec": self.video_time_sec,
        }
