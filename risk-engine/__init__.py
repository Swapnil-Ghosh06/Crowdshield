"""
CrowdShield — Risk Prediction Engine Package
---------------------------------------------
Transparent crowd risk scoring, ETA prediction, and intervention recommendation engine.
"""

from .config import RiskEngineConfig
from .explainability import RiskBreakdown, generate_explanation
from .recommendations import (
    RecommendationEngine,
    RecommendationResult,
    VENUE_MAP,
    ZoneMetadata,
    generate_llm_announcement,
    generate_rule_announcement,
    generate_rule_recommendations,
    get_optimal_alternate_zone,
    get_recommendations,
)
from .risk_engine import RiskEngine, RiskEvent
from .rules import Announcement, generate_announcements, generate_recommendations

__all__ = [
    "RiskEngine",
    "RiskEngineConfig",
    "RiskEvent",
    "RiskBreakdown",
    "Announcement",
    "RecommendationEngine",
    "RecommendationResult",
    "VENUE_MAP",
    "ZoneMetadata",
    "generate_explanation",
    "generate_recommendations",
    "generate_announcements",
    "generate_rule_recommendations",
    "generate_rule_announcement",
    "generate_llm_announcement",
    "get_optimal_alternate_zone",
    "get_recommendations",
]
