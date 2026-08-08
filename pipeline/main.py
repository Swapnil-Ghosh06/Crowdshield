"""
CrowdShield — Realtime Pipeline Server
---------------------------------------
FastAPI app exposing:
  - WS  /ws/risk-events   → broadcasts risk events every 3s to all connected clients
  - GET /events/latest     → returns the most recent event per zone (REST)
  - GET /health            → simple health check

Run with:
    uvicorn main:app --reload --port 8000

Connect a WebSocket client to:
    ws://localhost:8000/ws/risk-events
"""

import asyncio
import json
import os
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

# Feature flag: USE_MOCK=1 (default) uses mock generator;
# set USE_MOCK=0 when real vision engine is wired in.
USE_MOCK = os.getenv("USE_MOCK", "1") == "1"

if USE_MOCK:
    from mock_generator import generate_all_zones
else:
    # Swap in the real engine here later — contract stays identical
    from real_engine import generate_all_zones  # type: ignore

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("crowdshield.pipeline")

# ---------------------------------------------------------------------------
# State
# ---------------------------------------------------------------------------

# latest_events: zone_id → last emitted event dict
latest_events: dict[str, dict] = {}

# connected WebSocket clients
connected_clients: list[WebSocket] = []

BROADCAST_INTERVAL_SECONDS = 3


# ---------------------------------------------------------------------------
# Background broadcast task
# ---------------------------------------------------------------------------

async def broadcast_loop() -> None:
    """Continuously generate events and broadcast to all connected WebSocket clients.

    Runs every BROADCAST_INTERVAL_SECONDS seconds. Events are stored in
    latest_events so the REST endpoint always has fresh data.
    """
    while True:
        events = generate_all_zones()

        # Update latest state
        for event in events:
            latest_events[event["zone_id"]] = event

        # Broadcast to all connected clients
        if connected_clients:
            payload = json.dumps(events)
            dead: list[WebSocket] = []
            for ws in connected_clients:
                try:
                    await ws.send_text(payload)
                except Exception:
                    dead.append(ws)
            for ws in dead:
                connected_clients.remove(ws)
                logger.info("Removed disconnected client. Active: %d", len(connected_clients))

        await asyncio.sleep(BROADCAST_INTERVAL_SECONDS)


# ---------------------------------------------------------------------------
# App lifecycle
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start the broadcast loop on startup; cancel it on shutdown."""
    task = asyncio.create_task(broadcast_loop())
    logger.info("Broadcast loop started (USE_MOCK=%s)", USE_MOCK)
    yield
    task.cancel()
    logger.info("Broadcast loop stopped")


app = FastAPI(
    title="CrowdShield — Realtime Risk Pipeline",
    description="WebSocket server emitting crowd risk events per the shared contract.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten before production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# WebSocket endpoint
# ---------------------------------------------------------------------------

@app.websocket("/ws/risk-events")
async def risk_events_ws(websocket: WebSocket) -> None:
    """Accept a WebSocket connection and add it to the broadcast pool.

    The client will receive a JSON array of risk events every
    BROADCAST_INTERVAL_SECONDS seconds until it disconnects.
    """
    await websocket.accept()
    connected_clients.append(websocket)
    logger.info("Client connected. Active: %d", len(connected_clients))

    # Send current snapshot immediately on connect so client isn't left blank
    if latest_events:
        await websocket.send_text(json.dumps(list(latest_events.values())))

    try:
        while True:
            # Keep connection alive; actual data is pushed from broadcast_loop
            await websocket.receive_text()
    except WebSocketDisconnect:
        connected_clients.remove(websocket)
        logger.info("Client disconnected. Active: %d", len(connected_clients))


# ---------------------------------------------------------------------------
# REST endpoints
# ---------------------------------------------------------------------------

@app.get("/events/latest", summary="Latest risk event per zone")
async def get_latest_events() -> dict[str, dict]:
    """Return the most recent risk event for each zone.

    Returns:
        Dict keyed by zone_id, value is the latest event dict.
    """
    return latest_events


@app.get("/health", summary="Health check")
async def health() -> dict[str, str]:
    """Simple liveness check.

    Returns:
        Status dict.
    """
    return {"status": "ok", "mode": "mock" if USE_MOCK else "live"}
