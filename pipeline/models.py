"""
CrowdShield — Shared Data Models
---------------------------------
Pydantic v2 models that define the exact shape of every risk event emitted by
the pipeline server.  Both the mock generator and the real-engine adapter must
produce objects that validate against ``RiskEvent``; the FastAPI endpoints use
these models to guarantee the wire format is always correct.

Keeping models in a separate module means any contributor can read the contract
at a glance without wading through generator or server logic.
"""

from __future__ import annotations

from typing import Literal, Optional
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Announcement payload
# ---------------------------------------------------------------------------


class Announcement(BaseModel):
    """Bilingual public-address text for a risk event.

    Both fields are required so every downstream consumer (dashboard, mobile
    app, PA system adapter) can always render the appropriate language without
    a null-check.
    """

    en: str = Field(..., description="English public-address message.")
    hi: str = Field(..., description="Hindi public-address message.")


# ---------------------------------------------------------------------------
# Core risk event
# ---------------------------------------------------------------------------

RiskLevel = Literal["low", "medium", "high", "critical"]


class RiskEvent(BaseModel):
    """One crowd-risk snapshot for a single zone at a single point in time.

    This is the canonical wire format shared across the pipeline server,
    the dashboard (Zahid), and the mobile app (Haripriya).  The real vision
    engine must produce objects that pass this model's validation; the mock
    generator produces structurally identical objects for pre-integration
    development.

    Field names and types are frozen — any breaking change here requires a
    coordinated bump across all three sub-projects.
    """

    zone_id: str = Field(
        ...,
        examples=["gate_1"],
        description="Stable machine-readable identifier for the zone.",
    )
    zone_name: str = Field(
        ...,
        examples=["South Entrance"],
        description="Human-readable display label for the zone.",
    )
    timestamp: str = Field(
        ...,
        examples=["2026-08-11T11:21:00Z"],
        description="ISO 8601 UTC timestamp at which this snapshot was captured.",
    )
    density_per_sqm: float = Field(
        ...,
        ge=0.0,
        description="Estimated crowd density in people per square metre.",
    )
    flow_speed_mps: float = Field(
        ...,
        ge=0.0,
        description="Estimated average crowd flow speed in metres per second.",
    )
    risk_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Normalised risk score in [0, 1]. Higher is more dangerous.",
    )
    risk_level: RiskLevel = Field(
        ...,
        description="Categorical risk level derived from risk_score.",
    )
    eta_minutes: Optional[int] = Field(
        None,
        description=(
            "Estimated minutes until the situation becomes critical. "
            "Null when risk_level is 'low'."
        ),
    )
    recommendations: list[str] = Field(
        default_factory=list,
        description="Ordered list of recommended operator actions.",
    )
    announcement: Announcement = Field(
        ...,
        description="Bilingual public-address text appropriate for the current risk level.",
    )
