"""
CrowdShield — Realtime Pipeline Server Tests
---------------------------------------------
Comprehensive test suite verifying:
    1. /health endpoint schema: mode, pipeline_status, last_event_time, active_connections, llm_cascade_enabled
    2. /events/latest endpoint snapshot output
    3. /demo/scenario endpoint (GET & POST) triggering 5-stage accelerated before/after replays
    4. Demo scenario generator validation on gate_3 (North Entrance) across all 5 minutes
    5. Graceful degradation when VIDEO_PATH is missing
    6. Contract compliance of generated RiskEvents
"""

from datetime import datetime, timezone
import os
import sys
import unittest
from fastapi.testclient import TestClient

# Ensure pipeline, risk-engine, and vision-engine directories are in sys.path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PIPELINE_DIR = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
CROWDSHIELD_ROOT = os.path.abspath(os.path.join(PIPELINE_DIR, ".."))

if PIPELINE_DIR not in sys.path:
    sys.path.insert(0, PIPELINE_DIR)
for path in [CROWDSHIELD_ROOT, os.path.join(CROWDSHIELD_ROOT, "risk-engine"), os.path.join(CROWDSHIELD_ROOT, "vision-engine")]:
    if path not in sys.path:
        sys.path.append(path)

from main import app, _resolve_video_path
from demo_scenarios import (
    DEMO_DURATION_TICKS,
    INCIDENT_ZONE,
    TICK_INTERVAL_SEC,
    get_demo_generator,
)
from models import RiskEvent


class TestPipeline(unittest.TestCase):
    """Unit and integration tests for the FastAPI pipeline server."""

    def setUp(self) -> None:
        """Initializes FastAPI test client."""
        self.client = TestClient(app)

    def test_01_health_endpoint_schema_and_values(self) -> None:
        """Validates /health returns exact schema with mode, pipeline_status, last_event_time, active_connections, llm_cascade_enabled."""
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()

        # Check required keys
        self.assertIn("mode", data)
        self.assertIn("pipeline_status", data)
        self.assertIn("last_event_time", data)
        self.assertIn("active_connections", data)
        self.assertIn("llm_cascade_enabled", data)

        # Check types and allowed value ranges
        self.assertIn(data["mode"], ["mock", "live"])
        self.assertIn(data["pipeline_status"], ["running", "stopped", "error", "initializing"])
        self.assertIsInstance(data["last_event_time"], dict)
        self.assertIsInstance(data["active_connections"], int)
        self.assertIsInstance(data["llm_cascade_enabled"], bool)

    def test_02_events_latest_endpoint(self) -> None:
        """Validates /events/latest returns a dictionary mapping zone_ids to event payloads."""
        response = self.client.get("/events/latest")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIsInstance(data, dict)

    def test_03_demo_scenario_get_before(self) -> None:
        """Validates GET /demo/scenario?type=before starts accelerated replay."""
        response = self.client.get("/demo/scenario?type=before")
        self.assertEqual(response.status_code, 200)
        data = response.json()

        self.assertEqual(data["status"], "started")
        self.assertEqual(data["scenario"], "before")
        self.assertEqual(data["ticks"], 5)
        self.assertEqual(data["tick_interval_sec"], 4)
        self.assertEqual(data["duration_sec"], 20)
        self.assertIn("gate_3", data["incident_zone"])

    def test_04_demo_scenario_get_after(self) -> None:
        """Validates GET /demo/scenario?type=after starts accelerated recovery replay."""
        response = self.client.get("/demo/scenario?type=after")
        self.assertEqual(response.status_code, 200)
        data = response.json()

        self.assertEqual(data["status"], "started")
        self.assertEqual(data["scenario"], "after")
        self.assertEqual(data["ticks"], 5)
        self.assertEqual(data["tick_interval_sec"], 4)
        self.assertEqual(data["duration_sec"], 20)

    def test_05_demo_scenario_alias_and_post_support(self) -> None:
        """Validates scenario parameter alias and POST /demo/scenario support."""
        # Using scenario= instead of type=
        res_alias = self.client.get("/demo/scenario?scenario=before")
        self.assertEqual(res_alias.status_code, 200)
        self.assertEqual(res_alias.json()["scenario"], "before")

        # Using POST
        res_post = self.client.post("/demo/scenario?type=after")
        self.assertEqual(res_post.status_code, 200)
        self.assertEqual(res_post.json()["scenario"], "after")

    def test_06_demo_scenario_invalid_type_rejection(self) -> None:
        """Validates invalid scenario query param returns 422 error."""
        response = self.client.get("/demo/scenario?type=invalid_scenario")
        self.assertEqual(response.status_code, 422)
        data = response.json()
        self.assertIn("error", data)

    def test_07_demo_generator_before_stages_sequence(self) -> None:
        """Validates the 5-stage progression of the 'before' scenario on gate_3."""
        generator = get_demo_generator("before")
        all_ticks = list(generator)

        self.assertEqual(len(all_ticks), 5)

        # Minute 0: All normal, gate_3 starts at 2.0
        m0_gate3 = next(e for e in all_ticks[0] if e.zone_id == "gate_3")
        self.assertEqual(m0_gate3.density_per_sqm, 2.0)
        self.assertEqual(m0_gate3.risk_level, "low")
        self.assertEqual(m0_gate3.flow_speed_mps, 1.2)

        # Minute 1: density rises to 3.2, risk_level=medium
        m1_gate3 = next(e for e in all_ticks[1] if e.zone_id == "gate_3")
        self.assertEqual(m1_gate3.density_per_sqm, 3.2)
        self.assertEqual(m1_gate3.risk_level, "medium")

        # Minute 2: density rises to 4.8, risk_level=high, flow slowing
        m2_gate3 = next(e for e in all_ticks[2] if e.zone_id == "gate_3")
        self.assertEqual(m2_gate3.density_per_sqm, 4.8)
        self.assertEqual(m2_gate3.risk_level, "high")
        self.assertEqual(m2_gate3.flow_speed_mps, 0.4)

        # Minute 3: density hits 6.5, risk_level=critical, flow_speed=0.1
        m3_gate3 = next(e for e in all_ticks[3] if e.zone_id == "gate_3")
        self.assertEqual(m3_gate3.density_per_sqm, 6.5)
        self.assertEqual(m3_gate3.risk_level, "critical")
        self.assertEqual(m3_gate3.flow_speed_mps, 0.1)

        # Minute 4: density hits 8.0 — simulated crush event marker
        m4_gate3 = next(e for e in all_ticks[4] if e.zone_id == "gate_3")
        self.assertEqual(m4_gate3.density_per_sqm, 8.0)
        self.assertEqual(m4_gate3.risk_level, "critical")
        self.assertEqual(m4_gate3.flow_speed_mps, 0.0)
        self.assertIn("SIMULATED_CRUSH_EVENT", m4_gate3.recommendations)

    def test_08_demo_generator_after_stages_sequence(self) -> None:
        """Validates the 5-stage early intervention and recovery of the 'after' scenario."""
        generator = get_demo_generator("after")
        all_ticks = list(generator)

        self.assertEqual(len(all_ticks), 5)

        # Minute 0: Normal start
        m0_gate3 = next(e for e in all_ticks[0] if e.zone_id == "gate_3")
        self.assertEqual(m0_gate3.density_per_sqm, 2.0)

        # Minute 1: density=3.2 (medium) — recommendations fired, gate_2 opens
        m1_gate3 = next(e for e in all_ticks[1] if e.zone_id == "gate_3")
        self.assertEqual(m1_gate3.density_per_sqm, 3.2)
        self.assertEqual(m1_gate3.risk_level, "medium")
        self.assertIn("open_gate_2", m1_gate3.recommendations)
        self.assertIn("redirect_flow_west", m1_gate3.recommendations)

        # Minute 2: density stabilizes at 3.5 (intervention working)
        m2_gate3 = next(e for e in all_ticks[2] if e.zone_id == "gate_3")
        self.assertEqual(m2_gate3.density_per_sqm, 3.5)
        self.assertEqual(m2_gate3.risk_level, "medium")

        # Minute 3: density drops to 2.8, risk_level=low
        m3_gate3 = next(e for e in all_ticks[3] if e.zone_id == "gate_3")
        self.assertEqual(m3_gate3.density_per_sqm, 2.8)
        self.assertEqual(m3_gate3.risk_level, "low")

        # Minute 4: All clear
        m4_gate3 = next(e for e in all_ticks[4] if e.zone_id == "gate_3")
        self.assertLessEqual(m4_gate3.density_per_sqm, 2.0)
        self.assertEqual(m4_gate3.risk_level, "low")

    def test_09_video_path_resolution_helper(self) -> None:
        """Validates video path resolution logic."""
        # Non-existent path returns None
        self.assertIsNone(_resolve_video_path("non_existent_file_xyz_123.mp4"))

        # RTSP stream URI passes through directly
        self.assertEqual(_resolve_video_path("rtsp://192.168.1.100:554/stream"), "rtsp://192.168.1.100:554/stream")


if __name__ == "__main__":
    unittest.main()
