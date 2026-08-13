"""
CrowdShield — Vision Engine Package
-----------------------------------
Automated crowd density, count, and optical flow estimation from video feeds.
"""

from .density_estimator import CrowdDensityEstimator
from .detectors import (
    BaseCrowdDetector,
    CSRNetCrowdDetector,
    HOGPedestrianDetector,
    YOLOCrowdDetector,
    get_detector,
)
from .flow_tracker import CrowdFlowTracker
from .models import DetectionBox, FlowDirection, ZoneDensityEstimate

__all__ = [
    "CrowdDensityEstimator",
    "ZoneDensityEstimate",
    "FlowDirection",
    "DetectionBox",
    "BaseCrowdDetector",
    "HOGPedestrianDetector",
    "YOLOCrowdDetector",
    "CSRNetCrowdDetector",
    "get_detector",
    "CrowdFlowTracker",
]
