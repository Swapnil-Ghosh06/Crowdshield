"""
CrowdShield — Real Engine Adapter
-----------------------------------
Bridges the live vision-engine → risk-engine → recommendation-engine stack into the
one-function interface that ``main.py`` expects:

    generate_all_zones() -> list[RiskEvent]

Architecture (MOCK_MODE=false):
    One ``CrowdDensityEstimator`` per zone processes a looping video file (or RTSP stream).
    Estimates are consumed by a shared ``RiskEngine`` instance, then augmented by
    ``RecommendationEngine`` to produce the final ``RiskEvent`` payload.

    Because ``CrowdDensityEstimator.process_video()`` is a blocking generator, each zone's
    estimator is run in a separate thread managed by a ``ThreadPoolExecutor``. The main broadcast
    loop calls ``generate_all_zones()`` synchronously and expects the function to return
    promptly (within the 3-second broadcast window).

    Video Looping Strategy:
        The vision engine processes a finite video file. When the file ends, the estimator
        is automatically restarted from the beginning, simulating a continuous live feed.
        This allows a single sample.mp4 to power an indefinitely-running live demo.

Graceful Degradation:
    If ANY real engine import fails (missing weights, missing API key, OpenCV not installed),
    generate_all_zones() automatically falls back to mock_generator.generate_all_zones().
    The server NEVER crashes due to a missing model or library.

Per-Engine Health Tracking:
    ENGINE_STATUS dict tracks "ok" | "degraded" per engine, consumed by /health endpoint.

Environment Variables:
    VIDEO_PATH : str  (default: "sample.mp4")
        Path to the video file processed by the vision engine.
    ZONE_AREA_SQM : float  (default: 50.0)
        Calibrated area for all zones in square metres.
    VISION_SAMPLE_INTERVAL : float  (default: 3.0)
        Sampling interval passed to each CrowdDensityEstimator in seconds.
    DETECTOR_BACKEND : str  (default: "hog")
        Crowd detection backend name: 'hog' (default), 'yolo', or 'csrnet'.
"""

from __future__ import annotations

import logging
import os
import sys
import threading
import time
from datetime import datetime, timezone
from typing import Dict, List, Literal, Optional

from models import Announcement, RiskEvent

# ---------------------------------------------------------------------------
# Path resolution — allow importing from sibling directories
# ---------------------------------------------------------------------------

_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
_CROWDSHIELD_ROOT = os.path.dirname(_THIS_DIR)
_VISION_ENGINE_DIR = os.path.join(_CROWDSHIELD_ROOT, "vision-engine")
_RISK_ENGINE_DIR = os.path.join(_CROWDSHIELD_ROOT, "risk-engine")

for _path in (_VISION_ENGINE_DIR, _RISK_ENGINE_DIR):
    if _path not in sys.path:
        sys.path.insert(0, _path)

logger = logging.getLogger("crowdshield.real_engine")

# ---------------------------------------------------------------------------
# Environment configuration
# ---------------------------------------------------------------------------

VIDEO_PATH: str = os.getenv("VIDEO_PATH", "sample.mp4")
ZONE_AREA_SQM: float = float(os.getenv("ZONE_AREA_SQM", "50.0"))
VISION_SAMPLE_INTERVAL: float = float(os.getenv("VISION_SAMPLE_INTERVAL", "3.0"))
DETECTOR_BACKEND: str = os.getenv("DETECTOR_BACKEND", "hog")

# ---------------------------------------------------------------------------
# Zone configuration — mirrors mock_generator.ZONES for contract parity
# ---------------------------------------------------------------------------

ZONES: List[Dict[str, str]] = [
    {"zone_id": "gate_1", "zone_name": "South Entrance"},
    {"zone_id": "gate_2", "zone_name": "West Entrance"},
    {"zone_id": "gate_3", "zone_name": "North Entrance"},
    {"zone_id": "gate_4", "zone_name": "East Entrance"},
]

# ---------------------------------------------------------------------------
# Per-engine health status — exposed to /health endpoint
# ---------------------------------------------------------------------------

EngineHealth = Literal["ok", "degraded"]

ENGINE_STATUS: Dict[str, EngineHealth] = {
    "vision": "ok",
    "risk": "ok",
    "recommendation": "ok",
}

# ---------------------------------------------------------------------------
# Module-level pipeline state
# ---------------------------------------------------------------------------

# Status string visible via /health
pipeline_status: str = "initializing"

# Latest estimate dict per zone_id — updated by zone threads
_latest_estimates: Dict[str, Dict] = {}
_estimates_lock = threading.Lock()

# Shared RiskEngine and RecommendationEngine instances
_risk_engine = None
_rec_engine = None

# Per-zone estimator thread references
_zone_threads: Dict[str, threading.Thread] = {}

# Initialised flag to avoid double-init
_initialized: bool = False
_init_lock = threading.Lock()

# Whether we fell back to mock mode due to import failure
_using_mock_fallback: bool = False


# ---------------------------------------------------------------------------
# Lazy engine imports (wrapped so failures are caught cleanly)
# ---------------------------------------------------------------------------


def _import_vision():
    """Imports and returns the CrowdDensityEstimator class from vision-engine.

    Returns:
        CrowdDensityEstimator class.

    Raises:
        ImportError: If vision-engine packages are not available.
    """
    try:
        from density_estimator import CrowdDensityEstimator  # type: ignore[import-untyped]
        ENGINE_STATUS["vision"] = "ok"
        return CrowdDensityEstimator
    except ImportError as exc:
        ENGINE_STATUS["vision"] = "degraded"
        logger.warning(
            "Failed to import CrowdDensityEstimator from vision-engine/. "
            "Ensure sys.path includes '%s' and OpenCV is installed. Error: %s",
            _VISION_ENGINE_DIR,
            exc,
        )
        raise


def _import_risk_engine():
    """Imports and returns the RiskEngine class from risk-engine.

    Returns:
        RiskEngine class.

    Raises:
        ImportError: If risk-engine is not available.
    """
    try:
        from risk_engine import RiskEngine  # type: ignore[import-untyped]
        ENGINE_STATUS["risk"] = "ok"
        return RiskEngine
    except ImportError as exc:
        ENGINE_STATUS["risk"] = "degraded"
        logger.warning(
            "Failed to import RiskEngine from risk-engine/. Error: %s", exc
        )
        raise


def _import_recommendation_engine():
    """Imports and returns the RecommendationEngine class from risk-engine.

    Returns:
        RecommendationEngine class.

    Raises:
        ImportError: If recommendation engine is not available.
    """
    try:
        from recommendations import RecommendationEngine  # type: ignore[import-untyped]
        ENGINE_STATUS["recommendation"] = "ok"
        return RecommendationEngine
    except ImportError as exc:
        ENGINE_STATUS["recommendation"] = "degraded"
        logger.warning(
            "Failed to import RecommendationEngine from risk-engine/. Error: %s", exc
        )
        raise


# ---------------------------------------------------------------------------
# Per-zone video-processing thread
# ---------------------------------------------------------------------------


def _zone_processing_loop(
    zone: Dict[str, str],
    video_path: str,
    risk_engine,
    rec_engine,
) -> None:
    """Background thread that continuously processes video frames for one zone.

    Runs as an infinite loop: when the video file ends, it restarts from the beginning
    to simulate a live CCTV feed from a finite sample clip.

    Args:
        zone: Dict with 'zone_id' and 'zone_name'.
        video_path: Path to the input video file or RTSP stream URI.
        risk_engine: Shared ``RiskEngine`` instance.
        rec_engine: Shared ``RecommendationEngine`` instance.
    """
    global pipeline_status

    CrowdDensityEstimator = _import_vision()
    zone_id = zone["zone_id"]
    zone_name = zone["zone_name"]

    logger.info("Zone thread starting: %s (%s)", zone_id, zone_name)

    while True:
        try:
            estimator = CrowdDensityEstimator(
                video_source=video_path,
                zone_id=zone_id,
                zone_name=zone_name,
                zone_area_sqm=ZONE_AREA_SQM,
                sample_interval_sec=VISION_SAMPLE_INTERVAL,
                detector=DETECTOR_BACKEND,
            )

            for estimate in estimator.process_video():
                # Feed into risk engine
                risk_event = risk_engine.process_estimate(estimate)

                # Augment with recommendation engine
                rec_result = rec_engine.generate(risk_event)
                final_event = risk_event.model_copy(
                    update={
                        "recommendations": rec_result.recommendations,
                        "announcement": rec_result.announcement,
                    }
                )

                # Store latest snapshot under lock
                with _estimates_lock:
                    _latest_estimates[zone_id] = final_event.model_dump()

            logger.info("Zone '%s' video ended; restarting from beginning.", zone_id)

        except FileNotFoundError:
            pipeline_status = "video_not_found"
            logger.warning(
                "Video file not found: '%s'. Zone '%s' thread sleeping 10s before retry.",
                video_path,
                zone_id,
            )
            time.sleep(10)

        except Exception as exc:
            logger.error(
                "Zone '%s' processing loop error: %s. Restarting in 5s.",
                zone_id,
                exc,
                exc_info=True,
            )
            time.sleep(5)


# ---------------------------------------------------------------------------
# Initialisation
# ---------------------------------------------------------------------------


def _initialize() -> None:
    """Initialises the real engine stack (once, on first call).

    Creates shared RiskEngine and RecommendationEngine instances, then spawns
    one daemon background thread per zone to continuously process video frames.

    On any import failure, sets _using_mock_fallback=True so generate_all_zones()
    transparently delegates to mock_generator — the server never crashes.
    """
    global _risk_engine, _rec_engine, _initialized, pipeline_status, _using_mock_fallback

    with _init_lock:
        if _initialized:
            return

        logger.info(
            "Initialising real engine stack. VIDEO_PATH='%s' DETECTOR='%s'",
            VIDEO_PATH,
            DETECTOR_BACKEND,
        )

        try:
            RiskEngine = _import_risk_engine()
            _risk_engine = RiskEngine()
        except Exception as exc:
            logger.warning(
                "Risk engine unavailable (%s). Falling back to mock generator.", exc
            )
            ENGINE_STATUS["risk"] = "degraded"
            ENGINE_STATUS["recommendation"] = "degraded"
            pipeline_status = "degraded"
            _using_mock_fallback = True
            _initialized = True
            return

        try:
            RecommendationEngine = _import_recommendation_engine()
            # The live per-frame broadcast path needs fast deterministic rule-based
            # recommendations, not per-frame LLM calls; the separate /ai/summary REST
            # endpoint has its own independent LLM cascade and is unaffected by this change.
            _rec_engine = RecommendationEngine(use_llm=False)
        except Exception as exc:
            logger.warning(
                "Recommendation engine unavailable (%s). Falling back to mock generator.", exc
            )
            ENGINE_STATUS["recommendation"] = "degraded"
            pipeline_status = "degraded"
            _using_mock_fallback = True
            _initialized = True
            return

        # Validate video path upfront
        if not os.path.exists(VIDEO_PATH) and not VIDEO_PATH.startswith(("rtsp://", "http://", "https://")):
            logger.warning(
                "VIDEO_PATH='%s' not found. Zone threads will retry every 10s until file appears.",
                VIDEO_PATH,
            )
            pipeline_status = "video_not_found"
        else:
            pipeline_status = "running"

        # Spawn per-zone daemon threads — wrap in try so vision import failure also falls back
        try:
            for zone in ZONES:
                t = threading.Thread(
                    target=_zone_processing_loop,
                    args=(zone, VIDEO_PATH, _risk_engine, _rec_engine),
                    name=f"crowdshield-zone-{zone['zone_id']}",
                    daemon=True,
                )
                t.start()
                _zone_threads[zone["zone_id"]] = t
                logger.info("Started zone thread: %s", t.name)
        except Exception as exc:
            logger.warning(
                "Vision engine thread startup failed (%s). Falling back to mock generator.", exc
            )
            ENGINE_STATUS["vision"] = "degraded"
            _using_mock_fallback = True
            _initialized = True
            return

        _initialized = True
        logger.info("Real engine stack initialised. %d zone threads active.", len(_zone_threads))


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------


def generate_all_zones() -> List[RiskEvent]:
    """Returns the latest RiskEvent snapshot for every zone from the real engine stack.

    This is the drop-in replacement for ``mock_generator.generate_all_zones()``.
    Same signature, same return type.

    On first call, lazy-initialises the engine stack and zone processing threads.
    Subsequent calls return cached latest estimates updated by background threads.

    If any real engine import fails (missing model weights, missing API key),
    catches the exception, logs a WARNING, and automatically falls back to
    mock_generator.generate_all_zones(). The server NEVER crashes.

    Returns:
        List of ``RiskEvent`` objects (one per zone) in ZONES order.
    """
    if not _initialized:
        _initialize()

    # Graceful degradation: if any engine failed to initialise, use mock
    if _using_mock_fallback:
        try:
            from mock_generator import generate_all_zones as mock_generate  # type: ignore[import-untyped]
            return mock_generate()
        except Exception as exc:
            logger.error("Mock fallback also failed: %s", exc)
            return []

    events: List[RiskEvent] = []
    with _estimates_lock:
        for zone in ZONES:
            zone_id = zone["zone_id"]
            if zone_id in _latest_estimates:
                try:
                    events.append(RiskEvent(**_latest_estimates[zone_id]))
                except Exception as exc:
                    logger.warning("Failed to deserialise cached event for %s: %s", zone_id, exc)

    return events


def get_pipeline_status() -> str:
    """Returns the current pipeline health status string.

    Returns:
        One of: 'initializing', 'running', 'video_not_found', 'degraded'.
    """
    return pipeline_status


def get_last_event_times() -> Dict[str, Optional[str]]:
    """Returns the ISO 8601 timestamp of the most recent event received per zone.

    Returns:
        Dict mapping zone_id to timestamp string or None if no event received yet.
    """
    with _estimates_lock:
        return {
            zone["zone_id"]: _latest_estimates.get(zone["zone_id"], {}).get("timestamp")
            for zone in ZONES
        }
