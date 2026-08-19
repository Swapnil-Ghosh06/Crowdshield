"""
CrowdShield — Realtime Pipeline Server
----------------------------------------
FastAPI application that:
  - Broadcasts a JSON array of ``RiskEvent`` snapshots every 3 seconds to all
    connected WebSocket clients at ``/ws/risk-events``.
  - Exposes ``GET /events/latest`` so REST clients (or health dashboards) can
    poll the most recent snapshot per zone without opening a socket.
  - Exposes ``GET /health`` for liveness probes.

Environment variables
---------------------
MOCK_MODE : str  (default "true")
    Set to "true" (case-insensitive) to use the built-in mock generator.
    Set to "false" to import ``real_engine.generate_all_zones`` instead.
    No other code changes are needed to switch modes.

Run with:
    uvicorn main:app --reload --port 8000

Connect a WebSocket client to:
    ws://localhost:8000/ws/risk-events
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from models import RiskEvent

# ---------------------------------------------------------------------------
# Feature flag
# ---------------------------------------------------------------------------

# MOCK_MODE=true (default) → use built-in mock data generator.
# MOCK_MODE=false          → import the real vision-engine adapter.
# The flag is read once at startup; restart the server to change it.
MOCK_MODE: bool = os.getenv("MOCK_MODE", "true").strip().lower() not in ("false", "0", "no")

if MOCK_MODE:
    from mock_generator import generate_all_zones  # type: ignore[import-untyped]
else:
    # Swap in the real engine here — must expose the same signature:
    #   generate_all_zones() -> list[RiskEvent]
    from real_engine import generate_all_zones  # type: ignore[import-not-found]

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger("crowdshield.pipeline")

# ---------------------------------------------------------------------------
# Shared state
# ---------------------------------------------------------------------------

# latest_events: zone_id → serialisable dict of the most recent event.
# Using a plain dict (not RiskEvent) here so the REST endpoint can return it
# without re-serialising, which keeps the broadcast path and REST path in sync.
latest_events: dict[str, dict] = {}

# All currently connected WebSocket clients.
connected_clients: list[WebSocket] = []

BROADCAST_INTERVAL_SECONDS: int = 3


# ---------------------------------------------------------------------------
# Background broadcast task
# ---------------------------------------------------------------------------


async def broadcast_loop() -> None:
    """Continuously generate risk events and push them to every connected client.

    Runs in an asyncio task that starts with the app and is cancelled on
    shutdown.  The loop also writes each event into ``latest_events`` so the
    REST endpoint always returns fresh data even when no WebSocket clients are
    connected.

    Events are serialised once per tick and sent to all clients to avoid
    redundant work.  Clients that have silently disconnected are pruned from
    ``connected_clients`` after each broadcast round.
    """
    while True:
        events: list[RiskEvent] = generate_all_zones()

        # Store latest snapshot for REST polling
        for event in events:
            latest_events[event.zone_id] = event.model_dump()

        # Serialise once — the same payload goes to every client
        if connected_clients:
            payload = json.dumps([e.model_dump() for e in events])
            dead: list[WebSocket] = []
            for ws in connected_clients:
                try:
                    await ws.send_text(payload)
                except Exception:
                    dead.append(ws)
            for ws in dead:
                connected_clients.remove(ws)
                logger.info(
                    "Pruned disconnected client. Active connections: %d",
                    len(connected_clients),
                )

        await asyncio.sleep(BROADCAST_INTERVAL_SECONDS)


# ---------------------------------------------------------------------------
# App lifecycle
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage the broadcast background task alongside the FastAPI lifecycle.

    Creates the broadcast loop task on startup and cancels it cleanly on
    shutdown so no events are dropped mid-flight.
    """
    task = asyncio.create_task(broadcast_loop())
    logger.info(
        "CrowdShield pipeline started. MOCK_MODE=%s  broadcast_interval=%ds",
        MOCK_MODE,
        BROADCAST_INTERVAL_SECONDS,
    )
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
    logger.info("CrowdShield pipeline stopped.")


# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------

app = FastAPI(
    title="CrowdShield — Realtime Risk Pipeline",
    description=(
        "WebSocket server emitting crowd risk events per the shared contract. "
        "Connect to `/ws/risk-events` for the live stream or poll "
        "`/events/latest` for the most recent snapshot per zone."
    ),
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tighten to specific origins before production deployment
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# WebSocket endpoint
# ---------------------------------------------------------------------------


@app.websocket("/ws/risk-events")
async def risk_events_ws(websocket: WebSocket) -> None:
    """Accept a WebSocket connection and register it for event broadcasts.

    On connect, the client immediately receives the latest cached snapshot so
    the UI is never blank while waiting for the next broadcast tick.
    Afterwards, ``broadcast_loop`` pushes updates every ``BROADCAST_INTERVAL_SECONDS``.

    The handler keeps the connection alive by waiting for incoming messages
    (clients can send any text to keep-alive; the content is ignored).

    Args:
        websocket: The incoming WebSocket connection managed by FastAPI.
    """
    await websocket.accept()
    connected_clients.append(websocket)
    logger.info("Client connected. Active connections: %d", len(connected_clients))

    # Send current snapshot immediately so the client renders something at once
    if latest_events:
        snapshot = json.dumps(list(latest_events.values()))
        await websocket.send_text(snapshot)

    try:
        while True:
            # Block until the client sends data (keep-alive ping or any text).
            # Actual outbound data is pushed by broadcast_loop, not here.
            await websocket.receive_text()
    except WebSocketDisconnect:
        if websocket in connected_clients:
            connected_clients.remove(websocket)
        logger.info("Client disconnected. Active connections: %d", len(connected_clients))


# ---------------------------------------------------------------------------
# REST endpoints
# ---------------------------------------------------------------------------


@app.get(
    "/events/latest",
    summary="Latest risk event per zone",
    response_model=dict[str, RiskEvent],
)
async def get_latest_events() -> dict[str, dict]:
    """Return the most recent risk event snapshot for each zone.

    Useful for REST clients (status boards, admin dashboards) that do not want
    a persistent WebSocket connection.  The response is keyed by ``zone_id``
    so consumers can look up a specific zone by name without iterating a list.

    Returns:
        Dict mapping zone_id → latest ``RiskEvent`` dict.
        Empty dict if the server has not yet completed its first broadcast tick.
    """
    return latest_events


@app.get("/health", summary="Liveness check")
async def health() -> dict[str, str]:
    """Simple liveness probe for load-balancers and container health checks.

    Returns:
        Dict with 'status' (always 'ok' if the server is up) and 'mode'
        ('mock' or 'live') so operators can confirm which data source is active.
    """
    return {
        "status": "ok",
        "mode": "mock" if MOCK_MODE else "live",
        "active_connections": str(len(connected_clients)),
    }


@app.post("/demo/scenario", summary="Trigger demo presentation scenario")
async def trigger_demo_scenario(scenario: str) -> dict[str, str]:
    """Inject a specific pitch demo scenario (e.g. 'before' or 'after')."""
    if MOCK_MODE:
        from mock_generator import trigger_scenario
        res = trigger_scenario(scenario)
        events = generate_all_zones()
        for event in events:
            latest_events[event.zone_id] = event.model_dump()
        if connected_clients:
            payload = json.dumps([e.model_dump() for e in events])
            for ws in list(connected_clients):
                try:
                    await ws.send_text(payload)
                except Exception:
                    pass
        return res
    return {"status": "ok", "scenario": scenario, "message": "Live mode active"}

