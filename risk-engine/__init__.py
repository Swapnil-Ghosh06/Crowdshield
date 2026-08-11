"""
CrowdShield — Risk Prediction Engine Package
---------------------------------------------
Transparent crowd risk scoring, ETA prediction, and intervention recommendation engine.
"""

from .config import RiskEngineConfig
from .explainability import RiskBreakdown, generate_explanation
from .risk_engine import RiskEngine, RiskEvent
from .rules import Announcement, generate_announcements, generate_recommendations

__all__ = [
    "RiskEngine",
    "RiskEngineConfig",
    "RiskEvent",
    "RiskBreakdown",
    "Announcement",
    "generate_explanation",
    "generate_recommendations",
    "generate_announcements",
]
