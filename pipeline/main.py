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

# Ensure sibling directories (risk-engine, vision-engine) are in sys.path
for sibling in ("risk-engine", "vision-engine"):
    p = os.path.join(_CROWDSHIELD_ROOT, sibling)
    if p not in sys.path:
        sys.path.insert(0, p)

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


from fastapi.responses import FileResponse, JSONResponse

_STATIC_INDEX = os.path.join(_THIS_DIR, "static", "index.html")


@app.get("/", summary="CrowdShield Live Web Console")
async def serve_index() -> FileResponse | JSONResponse:
    """Serves the interactive live dashboard console."""
    if os.path.exists(_STATIC_INDEX):
        return FileResponse(_STATIC_INDEX)
    return JSONResponse({"status": "running", "message": "CrowdShield Live Pipeline Active"})


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
    """Returns pipeline diagnostic and health telemetry matching the requested contract.

    Returns:
        JSON object with:
        - ``mode``: "mock" | "live"
        - ``pipeline_status``: "running" | "stopped" | "error"
        - ``last_event_time``: Dict mapping zone_id -> ISO 8601 timestamp string
        - ``active_connections``: Current count of connected WebSocket clients
        - ``llm_cascade_enabled``: Boolean indicating if LLM cascade is enabled
    """
    if MOCK_MODE:
        event_times = {
            zone_id: data.get("timestamp")
            for zone_id, data in latest_events.items()
        }
        # Populate defaults for 4 standard zones if not yet ticked
        for zid in ["gate_1", "gate_2", "gate_3", "gate_4"]:
            if zid not in event_times:
                event_times[zid] = last_event_times.get(zid)
    else:
        event_times = get_last_event_times()

    return JSONResponse({
        "mode": "mock" if MOCK_MODE else "live",
        "pipeline_status": _pipeline_status,
        "last_event_time": event_times,
        "active_connections": len(connected_clients),
        "llm_cascade_enabled": is_llm_enabled(),
    })


@app.get("/demo/scenario", summary="Trigger a scripted before/after incident replay (GET)")
@app.post("/demo/scenario", summary="Trigger a scripted before/after incident replay (POST)")
async def trigger_demo_scenario(
    type: Optional[str] = Query(None, description="Scenario variant: 'before' or 'after'"),
    scenario: Optional[str] = Query(None, description="Alias for 'type' ('before' or 'after')"),
) -> JSONResponse:
    """Triggers an accelerated 5-stage scripted incident replay over the `/ws/risk-events` WebSocket feed.

    Scenario Variants:
        - ``before``: Unmanaged crowd surge at Gate 3 climbing from normal to critical (density 8.0)
          with a simulated crush event marker at Minute 4.
        - ``after``: CrowdShield early warning intervention at Minute 1 (density 3.2), diverting crowd
          towards Gate 2 (West Entrance), stabilizing density (3.5), and achieving full recovery.

    Replay Acceleration:
        Each "minute" replays in 4 real seconds (5 ticks x 4s = 20s total duration).

    Args:
        type: 'before' | 'after'
        scenario: 'before' | 'after' (supported as alias)

    Returns:
        JSON confirmation with scenario metadata and duration.
    """
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
