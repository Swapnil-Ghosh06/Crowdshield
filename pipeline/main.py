"""
CrowdShield — Realtime Pipeline Server
----------------------------------------
FastAPI application that powers the live event stream, dashboard, mobile app, and demo presentations:

  - Broadcasts a JSON array of ``RiskEvent`` snapshots to all connected WebSocket clients
    at ``/ws/risk-events``.

  - Real Pipeline (MOCK_MODE=false):
    Processes video streams via ``vision-engine/density_estimator.py``, scores risk via
    ``risk-engine/risk_engine.py``, generates bilingual announcements via ``risk-engine/recommendations.py``,
    and broadcasts live telemetry.

  - Mock Pipeline (MOCK_MODE=true):
    Emits synthetic realistic multi-zone crowd telemetry — serving as our zero-fail demo safety net.

  - Graceful Degradation:
    If MOCK_MODE=false is specified but VIDEO_PATH does not exist, logs an error and automatically
    falls back to MOCK_MODE=true rather than crashing.

  - Demo Scenario Endpoint (``/demo/scenario``):
    Supports ``GET /demo/scenario?type=before`` and ``GET /demo/scenario?type=after`` to stream
    scripted 5-minute incident sequences at an accelerated replay speed (4s per minute) over WebSocket.

  - Health & Telemetry Endpoint (``/health``):
    Returns mode ('mock' | 'live'), pipeline_status ('running' | 'stopped' | 'error'),
    last_event_time per zone, active_connections count, and llm_cascade_enabled flag.

Environment Variables:
---------------------
MOCK_MODE : str (default "true")
    Set to "true" for mock generator, "false" for live vision+risk+recommendation stack.
VIDEO_PATH : str (default "sample.mp4")
    Path to input video file for vision engine (MOCK_MODE=false only).
BROADCAST_INTERVAL : int (default 3)
    WebSocket broadcast cadence in seconds during normal operation.
LLM_CASCADE_ENABLED : str (default "true")
    Toggles the 4-layer LLM recommendation cascade.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Dict, List, Optional

from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Load environment variables automatically from .env
# ---------------------------------------------------------------------------

_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
_CROWDSHIELD_ROOT = os.path.abspath(os.path.join(_THIS_DIR, ".."))
_WORKSPACE_ROOT = os.path.abspath(os.path.join(_CROWDSHIELD_ROOT, ".."))

# Attempt loading from pipeline/, crowdshield/, and project root
for env_path in [
    os.path.join(_THIS_DIR, ".env"),
    os.path.join(_CROWDSHIELD_ROOT, ".env"),
    os.path.join(_WORKSPACE_ROOT, ".env"),
]:
    if os.path.exists(env_path):
        load_dotenv(env_path)

load_dotenv()  # Default environment fallback

# Ensure pipeline directory is first in sys.path so local models.py takes precedence
if _THIS_DIR not in sys.path:
    sys.path.insert(0, _THIS_DIR)

# Ensure sibling directories (risk-engine, vision-engine) are in sys.path
for sibling in ("risk-engine", "vision-engine"):
    p = os.path.join(_CROWDSHIELD_ROOT, sibling)
    if p not in sys.path:
        sys.path.append(p)

from fastapi import FastAPI, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from models import RiskEvent

# ---------------------------------------------------------------------------
# Logging Configuration
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger("crowdshield.pipeline")

# ---------------------------------------------------------------------------
# Feature Flags & Graceful Degradation
# ---------------------------------------------------------------------------

MOCK_MODE: bool = os.getenv("MOCK_MODE", "true").strip().lower() not in ("false", "0", "no")
VIDEO_PATH: str = os.getenv("VIDEO_PATH", "sample.mp4")
BROADCAST_INTERVAL_SECONDS: int = int(os.getenv("BROADCAST_INTERVAL", "3"))


def _resolve_video_path(path_str: str) -> Optional[str]:
    """Resolves relative or absolute video path against pipeline and crowdshield roots.

    Args:
        path_str: Video path from environment or default.

    Returns:
        Absolute existing path string or stream URI if found; None otherwise.
    """
    if path_str.startswith(("rtsp://", "http://", "https://")):
        return path_str
    for base in [os.getcwd(), _THIS_DIR, _CROWDSHIELD_ROOT, _WORKSPACE_ROOT]:
        candidate = os.path.abspath(os.path.join(base, path_str))
        if os.path.exists(candidate):
            return candidate
    return None


# Graceful degradation check
if not MOCK_MODE:
    resolved_video = _resolve_video_path(VIDEO_PATH)
    if not resolved_video:
        logger.error(
            "MOCK_MODE=false was requested but VIDEO_PATH='%s' was not found on disk. "
            "Automatically and gracefully degrading to MOCK_MODE=true (mock safety net active).",
            VIDEO_PATH,
        )
        MOCK_MODE = True
    else:
        logger.info("Resolved VIDEO_PATH: '%s'", resolved_video)

if MOCK_MODE:
    from mock_generator import generate_all_zones  # type: ignore[import-untyped]
    logger.info("MOCK_MODE=true — using built-in mock event generator.")
else:
    from real_engine import (  # type: ignore[import-not-found]
        generate_all_zones,
        get_last_event_times,
        get_pipeline_status,
    )
    logger.info("MOCK_MODE=false — using real vision + risk + recommendation engine stack.")

# Demo scenario engine
from demo_scenarios import DEMO_DURATION_TICKS, TICK_INTERVAL_SEC, get_demo_generator

# LLM toggle check helper
try:
    from recommendations import is_llm_enabled
except ImportError:
    def is_llm_enabled() -> bool:
        flag = os.getenv("LLM_CASCADE_ENABLED", os.getenv("RECOMMENDATIONS_USE_LLM", "true"))
        return flag.strip().lower() in ("true", "1", "yes", "on")

# Per-engine health helper — real_engine exposes ENGINE_STATUS; mock mode always ok
def _get_engine_status() -> dict:
    """Returns per-engine health dict for /health endpoint."""
    if MOCK_MODE:
        return {"vision": "ok", "risk": "ok", "recommendation": "ok"}
    try:
        from real_engine import ENGINE_STATUS  # type: ignore[import-not-found]
        return dict(ENGINE_STATUS)
    except ImportError:
        return {"vision": "degraded", "risk": "degraded", "recommendation": "degraded"}


# ---------------------------------------------------------------------------
# Shared State
# ---------------------------------------------------------------------------

latest_events: Dict[str, dict] = {}
last_event_times: Dict[str, Optional[str]] = {}
connected_clients: List[WebSocket] = []

_active_demo_scenario: Optional[str] = None
_demo_generator = None
_demo_lock = asyncio.Lock()
_pipeline_status: str = "running"


# ---------------------------------------------------------------------------
# Broadcast & Event Distribution Helpers
# ---------------------------------------------------------------------------


async def _send_to_all_clients(payload: str) -> None:
    """Sends pre-serialized JSON string payload to all active WebSocket clients.

    Args:
        payload: JSON array string of RiskEvents.
    """
    if not connected_clients:
        return

    dead_clients: List[WebSocket] = []
    for ws in list(connected_clients):
        try:
            await ws.send_text(payload)
        except Exception:
            dead_clients.append(ws)

    for ws in dead_clients:
        if ws in connected_clients:
            connected_clients.remove(ws)
    if dead_clients:
        logger.info("Pruned %d disconnected client(s). Active: %d", len(dead_clients), len(connected_clients))


def _update_latest(events: List[RiskEvent]) -> None:
    """Updates in-memory latest_events cache for REST polling and health probes.

    Args:
        events: List of RiskEvent objects from current tick.
    """
    for event in events:
        latest_events[event.zone_id] = event.model_dump()
        last_event_times[event.zone_id] = event.timestamp


# ---------------------------------------------------------------------------
# Background Broadcast Loop
# ---------------------------------------------------------------------------


async def broadcast_loop() -> None:
    """Continuously generates risk events and pushes them to connected WebSocket clients.

    When a demo scenario is active (triggered via ``/demo/scenario``), broadcasts the 5-stage
    scripted replay at an accelerated 4-second interval per minute, then seamlessly returns
    to standard mock or live generation.
    """
    global _active_demo_scenario, _demo_generator, _pipeline_status

    while True:
        try:
            async with _demo_lock:
                scenario = _active_demo_scenario
                gen = _demo_generator

            if scenario is not None and gen is not None:
                # Demo scenario active — stream next scripted stage
                try:
                    events = next(gen)
                    _update_latest(events)
                    payload = json.dumps([e.model_dump() for e in events])
                    await _send_to_all_clients(payload)
                    sleep_duration = TICK_INTERVAL_SEC  # 4 seconds per demo stage
                except StopIteration:
                    # Replay complete
                    async with _demo_lock:
                        _active_demo_scenario = None
                        _demo_generator = None
                    logger.info("Demo scenario '%s' finished. Resuming normal broadcast.", scenario)
                    sleep_duration = BROADCAST_INTERVAL_SECONDS
            else:
                # Normal operation — mock generator or real live engine
                events = generate_all_zones()
                if events:
                    _update_latest(events)
                    payload = json.dumps([e.model_dump() for e in events])
                    await _send_to_all_clients(payload)
                sleep_duration = BROADCAST_INTERVAL_SECONDS

            await asyncio.sleep(sleep_duration)

        except asyncio.CancelledError:
            _pipeline_status = "stopped"
            break
        except Exception as exc:
            logger.error("Error in pipeline broadcast loop: %s", exc, exc_info=True)
            _pipeline_status = "error"
            await asyncio.sleep(BROADCAST_INTERVAL_SECONDS)


# ---------------------------------------------------------------------------
# Application Lifecycle & Instantiation
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manages application startup and cleanly cancels background broadcast tasks on shutdown."""
    global _pipeline_status
    _pipeline_status = "running"
    task = asyncio.create_task(broadcast_loop())
    logger.info(
        "CrowdShield pipeline started. mode=%s broadcast_interval=%ds",
        "mock" if MOCK_MODE else "live",
        BROADCAST_INTERVAL_SECONDS,
    )
    yield
    _pipeline_status = "stopped"
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
    logger.info("CrowdShield pipeline stopped.")


app = FastAPI(
    title="CrowdShield — Realtime Risk Pipeline",
    description=(
        "FastAPI pipeline server broadcasting live crowd risk events to dashboards and mobile apps. "
        "Connect to `/ws/risk-events` for real-time WebSocket feeds, query `/events/latest` for REST snapshots, "
        "check `/health` for diagnostics, and use `/demo/scenario?type=before` or `?type=after` for accelerated demo replays."
    ),
    version="0.4.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# WebSocket Endpoint
# ---------------------------------------------------------------------------


@app.websocket("/ws/risk-events")
async def risk_events_ws(websocket: WebSocket) -> None:
    """Accepts WebSocket connections and streams live RiskEvent telemetry.

    On connection, immediately sends the current snapshot so client dashboards render instantly.
    Subsequent updates are pushed by ``broadcast_loop`` every tick.

    Args:
        websocket: Incoming WebSocket connection instance.
    """
    await websocket.accept()
    connected_clients.append(websocket)
    logger.info("WebSocket client connected. Active connections: %d", len(connected_clients))

    # Send current snapshot immediately on connect
    if latest_events:
        snapshot = json.dumps(list(latest_events.values()))
        await websocket.send_text(snapshot)

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        if websocket in connected_clients:
            connected_clients.remove(websocket)
        logger.info("WebSocket client disconnected. Active connections: %d", len(connected_clients))


# ---------------------------------------------------------------------------
# REST Endpoints
# ---------------------------------------------------------------------------


@app.get(
    "/events/latest",
    summary="Latest risk event per zone",
    response_model=dict,
)
async def get_latest_events() -> dict:
    """Returns the most recent risk event snapshot for every zone in dictionary format."""
    return latest_events


@app.get("/health", summary="Pipeline health and diagnostic status")
async def health() -> JSONResponse:
    """Returns pipeline diagnostic and health telemetry.

    Returns:
        JSON object with:
        - ``status``: "ok"
        - ``mode``: "mock" | "live"
        - ``active_connections``: str count of connected WebSocket clients
        - ``engines``: Dict with per-engine health ("ok" | "degraded") for
          vision, risk, and recommendation engines.
    """
    return JSONResponse({
        "status": "ok",
        "mode": "mock" if MOCK_MODE else "live",
        "active_connections": str(len(connected_clients)),
        "engines": _get_engine_status(),
    })


@app.get("/demo/scenario", summary="Scripted demo scenario endpoint")
@app.post("/demo/scenario", summary="Scripted demo scenario endpoint (POST)")
async def trigger_demo_scenario(
    mode: Optional[str] = Query(None, description="'without_intervention' or 'with_intervention'"),
    type: Optional[str] = Query(None, description="Legacy WebSocket variant: 'before' or 'after'"),
    scenario: Optional[str] = Query(None, description="Alias for 'type' ('before' or 'after')"),
) -> JSONResponse:
    """Dual-mode demo scenario endpoint.

    **Mode A — JSON array (new):**
    ``GET /demo/scenario?mode=without_intervention`` or ``?mode=with_intervention``

    Returns a scripted sequence of 10 ``RiskEvent`` snapshots for gate_1 (South Entrance)
    as a JSON array.  Timestamps are spaced 3 seconds apart from now.

    - ``without_intervention``: density rises 2.0 → 7.5 over 10 steps, flow drops 1.2 → 0.1,
      risk_level escalates low → medium → high → critical.
    - ``with_intervention``: density rises to 4.5 then drops back to 1.8 after step 5,
      risk_level peaks high then drops back to medium → low. Step 5 includes
      ``open_alternate_gate`` recommendation.

    **Mode B — WebSocket trigger (legacy):**
    ``GET /demo/scenario?type=before`` or ``?type=after``

    Triggers an accelerated 5-stage scripted replay over the ``/ws/risk-events`` WebSocket.

    Args:
        mode: 'without_intervention' | 'with_intervention'  — returns JSON array directly.
        type: 'before' | 'after'  — triggers WebSocket broadcast scenario.
        scenario: Alias for ``type``.

    Returns:
        JSON array of 10 RiskEvent dicts (mode= path) or JSON confirmation (type= path).
    """
    import datetime as _dt

    # ------------------------------------------------------------------
    # Mode A: mode=without_intervention | with_intervention → JSON array
    # ------------------------------------------------------------------
    if mode is not None:
        target_mode = mode.strip().lower()
        if target_mode not in ("without_intervention", "with_intervention"):
            return JSONResponse(
                status_code=422,
                content={
                    "error": f"Invalid mode: {target_mode!r}. Must be 'without_intervention' or 'with_intervention'.",
                    "valid_values": ["without_intervention", "with_intervention"],
                },
            )

        now = _dt.datetime.now(_dt.timezone.utc)
        snapshots: List[dict] = []

        if target_mode == "without_intervention":
            # 10 steps: density 2.0 → 7.5, flow 1.2 → 0.1, risk escalates
            steps = [
                (2.0, 1.20), (2.5, 1.00), (3.2, 0.80), (3.9, 0.60), (4.8, 0.45),
                (5.5, 0.30), (6.2, 0.20), (6.8, 0.15), (7.2, 0.10), (7.5, 0.05),
            ]
        else:
            # 10 steps: rises to 4.5 (high), then drops after step 5 (intervention)
            steps = [
                (2.0, 1.20), (2.8, 1.00), (3.5, 0.80), (4.0, 0.60), (4.5, 0.40),
                (3.8, 0.70), (3.0, 0.90), (2.4, 1.10), (2.0, 1.20), (1.8, 1.30),
            ]

        for i, (density, flow) in enumerate(steps):
            ts = (now + _dt.timedelta(seconds=i * 3)).strftime("%Y-%m-%dT%H:%M:%SZ")

            # Compute risk per contract formula
            density_factor = min(density / 7.0, 1.0)
            flow_factor = max(0.0, 1.0 - flow / 1.5)
            score = round(min((density_factor * 0.65) + (flow_factor * 0.35), 1.0), 3)

            if score < 0.35:
                level, eta = "low", None
                recs = []
                ann_en = "All areas are clear. Enjoy the event."
                ann_hi = "सभी क्षेत्र सुरक्षित हैं। कार्यक्रम का आनंद लें।"
            elif score < 0.60:
                level, eta = "medium", 20
                recs = ["increase_monitoring", "prepare_staff"]
                ann_en = "Some areas are getting busy. Please follow staff directions."
                ann_hi = "कुछ क्षेत्रों में भीड़ बढ़ रही है। कृपया कर्मचारियों के निर्देशों का पालन करें।"
            elif score < 0.80:
                level, eta = "high", 10
                recs = ["open_alternate_gate", "redirect_crowd_flow", "deploy_staff"]
                if target_mode == "with_intervention" and i == 4:
                    # Step 5: intervention point
                    recs = ["open_alternate_gate", "redirect_crowd_flow", "deploy_staff", "activate_diversion_plan"]
                ann_en = "Crowd density is high. Please move calmly to the nearest exit."
                ann_hi = "इस क्षेत्र में भीड़ घनत्व अधिक है। कृपया शांति से निकटतम निकास की ओर जाएं।"
            else:
                level, eta = "critical", 3
                recs = ["close_gate", "emergency_broadcast", "deploy_all_staff", "call_security"]
                ann_en = "URGENT: Please evacuate this area immediately and follow security staff."
                ann_hi = "तत्काल: कृपया इस क्षेत्र को तुरंत खाली करें और सुरक्षा कर्मियों का अनुसरण करें।"

            snapshots.append({
                "zone_id": "gate_1",
                "zone_name": "South Entrance",
                "timestamp": ts,
                "density_per_sqm": round(density, 2),
                "flow_speed_mps": round(flow, 2),
                "risk_score": score,
                "risk_level": level,
                "eta_minutes": eta,
                "recommendations": recs,
                "announcement": {"en": ann_en, "hi": ann_hi},
            })

        logger.info("Served /demo/scenario?mode=%s — %d snapshots.", target_mode, len(snapshots))
        return JSONResponse(snapshots)

    # ------------------------------------------------------------------
    # Mode B: type=/scenario= → WebSocket broadcast trigger (legacy)
    # ------------------------------------------------------------------
    global _active_demo_scenario, _demo_generator

    target_scenario = (type or scenario or "").strip().lower()

    if target_scenario not in ("before", "after"):
        return JSONResponse(
            status_code=422,
            content={
                "error": f"Invalid scenario type: {target_scenario!r}. Must be 'before' or 'after'.",
                "valid_values": ["before", "after"],
            },
        )

    duration_sec = DEMO_DURATION_TICKS * TICK_INTERVAL_SEC  # 20 seconds

    async with _demo_lock:
        _active_demo_scenario = target_scenario
        _demo_generator = get_demo_generator(target_scenario)

    logger.info(
        "Demo scenario '%s' started. Duration: %ds (%d stages at %ds/stage).",
        target_scenario,
        duration_sec,
        DEMO_DURATION_TICKS,
        TICK_INTERVAL_SEC,
    )

    return JSONResponse({
        "status": "started",
        "scenario": target_scenario,
        "duration_sec": duration_sec,
        "ticks": DEMO_DURATION_TICKS,
        "tick_interval_sec": TICK_INTERVAL_SEC,
        "incident_zone": "gate_3 (North Entrance)",
        "message": (
            f"Scenario '{target_scenario}' is now streaming over /ws/risk-events. "
            f"Accelerated replay duration: {duration_sec}s ({DEMO_DURATION_TICKS} ticks at {TICK_INTERVAL_SEC}s/tick)."
        ),
    })
