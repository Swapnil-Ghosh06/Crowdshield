"""
CrowdShield — Pipeline Server Test Suite
-----------------------------------------
Tests:
    1. GET /health  — returns 200 with {status, mode, active_connections, engines} contract
    2. GET /events/latest  — returns dict keyed by zone_id with 4 zones (after broadcast tick)
    3. GET /demo/scenario?mode=without_intervention  — 10 events, escalating risk_level
    4. GET /demo/scenario?mode=with_intervention  — 10 events, risk peaks then drops
    5. Legacy /demo/scenario?type=before|after  — still triggers WS broadcast
    6. Invalid mode/type rejection (422)
    7. Video path resolution helper
"""

from __future__ import annotations

import os
import sys
import unittest
from datetime import datetime, timezone

from fastapi.testclient import TestClient

# ---------------------------------------------------------------------------
# Path setup — ensure pipeline, risk-engine, vision-engine are importable
# ---------------------------------------------------------------------------

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PIPELINE_DIR = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
CROWDSHIELD_ROOT = os.path.abspath(os.path.join(PIPELINE_DIR, ".."))

# Insert siblings first (lower priority) then pipeline last (highest priority)
# so that pipeline/models.py wins over vision-engine/models.py
for path in [
    os.path.join(CROWDSHIELD_ROOT, "vision-engine"),
    os.path.join(CROWDSHIELD_ROOT, "risk-engine"),
    CROWDSHIELD_ROOT,
    PIPELINE_DIR,  # ← must be last insert so it lands at sys.path[0]
]:
    if path not in sys.path:
        sys.path.insert(0, path)

from main import app, _resolve_video_path  # noqa: E402
from models import RiskEvent  # noqa: E402

RISK_LEVELS = {"low", "medium", "high", "critical"}
EXPECTED_ZONES = {"gate_1", "gate_2", "gate_3", "gate_4"}


class TestHealth(unittest.TestCase):
    """Tests for GET /health endpoint."""

    def setUp(self) -> None:
        self.client = TestClient(app)

    def test_health_returns_200(self) -> None:
        """GET /health must return HTTP 200."""
        resp = self.client.get("/health")
        self.assertEqual(resp.status_code, 200)

    def test_health_contract_keys(self) -> None:
        """Response must contain status, mode, active_connections, engines."""
        data = self.client.get("/health").json()
        for key in ("status", "mode", "active_connections", "engines"):
            self.assertIn(key, data, f"Missing key: {key}")

    def test_health_status_is_ok(self) -> None:
        """`status` must be 'ok'."""
        data = self.client.get("/health").json()
        self.assertEqual(data["status"], "ok")

    def test_health_mode_values(self) -> None:
        """`mode` must be 'mock' or 'live'."""
        data = self.client.get("/health").json()
        self.assertIn(data["mode"], ("mock", "live"))

    def test_health_active_connections_is_string(self) -> None:
        """`active_connections` must be a string (per contract)."""
        data = self.client.get("/health").json()
        self.assertIsInstance(data["active_connections"], str)

    def test_health_engines_shape(self) -> None:
        """`engines` must contain vision, risk, recommendation keys each 'ok' or 'degraded'."""
        data = self.client.get("/health").json()
        engines = data["engines"]
        self.assertIsInstance(engines, dict)
        for engine in ("vision", "risk", "recommendation"):
            self.assertIn(engine, engines, f"Missing engine key: {engine}")
            self.assertIn(engines[engine], ("ok", "degraded"),
                          f"Engine {engine} has unexpected status: {engines[engine]}")


class TestEventsLatest(unittest.TestCase):
    """Tests for GET /events/latest endpoint."""

    def setUp(self) -> None:
        self.client = TestClient(app)

    def test_events_latest_returns_200(self) -> None:
        """GET /events/latest must return HTTP 200."""
        resp = self.client.get("/events/latest")
        self.assertEqual(resp.status_code, 200)

    def test_events_latest_is_dict(self) -> None:
        """Response must be a dict."""
        data = self.client.get("/events/latest").json()
        self.assertIsInstance(data, dict)


class TestDemoScenarioWithoutIntervention(unittest.TestCase):
    """Tests for GET /demo/scenario?mode=without_intervention."""

    def setUp(self) -> None:
        self.client = TestClient(app)
        resp = self.client.get("/demo/scenario?mode=without_intervention")
        self.assertEqual(resp.status_code, 200, f"Expected 200, got {resp.status_code}: {resp.text}")
        self.events = resp.json()

    def test_returns_exactly_10_events(self) -> None:
        """Must return exactly 10 snapshots."""
        self.assertEqual(len(self.events), 10)

    def test_all_events_for_gate_1(self) -> None:
        """All snapshots must be for gate_1 (South Entrance)."""
        for e in self.events:
            self.assertEqual(e["zone_id"], "gate_1")
            self.assertEqual(e["zone_name"], "South Entrance")

    def test_all_required_fields_present(self) -> None:
        """Every snapshot must have all RiskEvent contract fields."""
        required = {
            "zone_id", "zone_name", "timestamp", "density_per_sqm",
            "flow_speed_mps", "risk_score", "risk_level", "eta_minutes",
            "recommendations", "announcement",
        }
        for i, e in enumerate(self.events):
            for field in required:
                self.assertIn(field, e, f"Step {i}: missing field '{field}'")

    def test_risk_level_escalates(self) -> None:
        """risk_level must escalate: starts low/medium, ends high/critical."""
        first = self.events[0]["risk_level"]
        last = self.events[-1]["risk_level"]
        self.assertIn(first, ("low", "medium"), f"First step should be low/medium, got {first!r}")
        self.assertIn(last, ("high", "critical"), f"Last step should be high/critical, got {last!r}")

    def test_density_increases(self) -> None:
        """Density must be higher at step 9 than step 0."""
        self.assertGreater(
            self.events[-1]["density_per_sqm"],
            self.events[0]["density_per_sqm"],
        )

    def test_flow_speed_decreases(self) -> None:
        """Flow speed must be lower at step 9 than step 0."""
        self.assertLess(
            self.events[-1]["flow_speed_mps"],
            self.events[0]["flow_speed_mps"],
        )

    def test_timestamps_spaced_3s_apart(self) -> None:
        """Consecutive timestamps must be 3 seconds apart."""
        for i in range(len(self.events) - 1):
            t0 = datetime.strptime(self.events[i]["timestamp"], "%Y-%m-%dT%H:%M:%SZ")
            t1 = datetime.strptime(self.events[i + 1]["timestamp"], "%Y-%m-%dT%H:%M:%SZ")
            delta = (t1 - t0).total_seconds()
            self.assertEqual(delta, 3.0, f"Step {i}→{i+1}: expected 3s gap, got {delta}s")

    def test_risk_score_in_range(self) -> None:
        """risk_score must be in [0.0, 1.0] for all steps."""
        for i, e in enumerate(self.events):
            self.assertGreaterEqual(e["risk_score"], 0.0, f"Step {i}: risk_score below 0")
            self.assertLessEqual(e["risk_score"], 1.0, f"Step {i}: risk_score above 1")

    def test_announcement_has_en_and_hi(self) -> None:
        """Every announcement must have 'en' and 'hi' keys."""
        for i, e in enumerate(self.events):
            ann = e["announcement"]
            self.assertIn("en", ann, f"Step {i}: announcement missing 'en'")
            self.assertIn("hi", ann, f"Step {i}: announcement missing 'hi'")


class TestDemoScenarioWithIntervention(unittest.TestCase):
    """Tests for GET /demo/scenario?mode=with_intervention."""

    def setUp(self) -> None:
        self.client = TestClient(app)
        resp = self.client.get("/demo/scenario?mode=with_intervention")
        self.assertEqual(resp.status_code, 200, f"Expected 200, got {resp.status_code}: {resp.text}")
        self.events = resp.json()

    def test_returns_exactly_10_events(self) -> None:
        """Must return exactly 10 snapshots."""
        self.assertEqual(len(self.events), 10)

    def test_all_events_for_gate_1(self) -> None:
        """All snapshots must be for gate_1."""
        for e in self.events:
            self.assertEqual(e["zone_id"], "gate_1")

    def test_risk_peaks_then_drops(self) -> None:
        """risk_level must be higher in the middle than at the end."""
        # Peak should be in steps 3-5
        peak_levels = [self.events[i]["risk_level"] for i in range(3, 6)]
        # At least one of the peak steps should be high or critical
        self.assertTrue(
            any(lvl in ("high", "critical") for lvl in peak_levels),
            f"Expected high/critical in peak steps 3-5, got: {peak_levels}",
        )
        # End should be lower risk than peak
        end_level = self.events[-1]["risk_level"]
        self.assertIn(end_level, ("low", "medium"),
                      f"End risk_level should be low/medium after intervention, got {end_level!r}")

    def test_density_rises_then_falls(self) -> None:
        """Density should peak around step 4-5 then be lower by step 9."""
        peak_density = max(e["density_per_sqm"] for e in self.events[:6])
        end_density = self.events[-1]["density_per_sqm"]
        self.assertGreater(peak_density, end_density,
                           "Peak density must be higher than end density")

    def test_open_alternate_gate_at_intervention_point(self) -> None:
        """At least one high-risk step must include 'open_alternate_gate' recommendation."""
        high_risk_steps = [e for e in self.events if e["risk_level"] in ("high", "critical")]
        any_has_rec = any(
            "open_alternate_gate" in e["recommendations"]
            for e in high_risk_steps
        )
        self.assertTrue(any_has_rec,
                        "Expected 'open_alternate_gate' in recommendations at intervention point")

    def test_timestamps_spaced_3s_apart(self) -> None:
        """Consecutive timestamps must be 3 seconds apart."""
        for i in range(len(self.events) - 1):
            t0 = datetime.strptime(self.events[i]["timestamp"], "%Y-%m-%dT%H:%M:%SZ")
            t1 = datetime.strptime(self.events[i + 1]["timestamp"], "%Y-%m-%dT%H:%M:%SZ")
            delta = (t1 - t0).total_seconds()
            self.assertEqual(delta, 3.0, f"Step {i}→{i+1}: expected 3s gap, got {delta}s")


class TestDemoScenarioLegacy(unittest.TestCase):
    """Tests for legacy GET/POST /demo/scenario?type=before|after (WebSocket trigger)."""

    def setUp(self) -> None:
        self.client = TestClient(app)

    def test_before_scenario_starts(self) -> None:
        """GET ?type=before must return started confirmation."""
        resp = self.client.get("/demo/scenario?type=before")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["status"], "started")
        self.assertEqual(data["scenario"], "before")
        self.assertEqual(data["ticks"], 5)
        self.assertEqual(data["tick_interval_sec"], 4)
        self.assertEqual(data["duration_sec"], 20)
        self.assertIn("gate_3", data["incident_zone"])

    def test_after_scenario_starts(self) -> None:
        """GET ?type=after must return started confirmation."""
        resp = self.client.get("/demo/scenario?type=after")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["status"], "started")
        self.assertEqual(data["scenario"], "after")

    def test_scenario_alias_param(self) -> None:
        """?scenario= alias must work the same as ?type=."""
        resp = self.client.get("/demo/scenario?scenario=before")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["scenario"], "before")

    def test_post_scenario_supported(self) -> None:
        """POST /demo/scenario?type=after must also work."""
        resp = self.client.post("/demo/scenario?type=after")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["scenario"], "after")

    def test_invalid_type_rejected_422(self) -> None:
        """Invalid ?type= must return 422 with error key."""
        resp = self.client.get("/demo/scenario?type=invalid_xyz")
        self.assertEqual(resp.status_code, 422)
        self.assertIn("error", resp.json())

    def test_invalid_mode_rejected_422(self) -> None:
        """Invalid ?mode= must return 422 with error key."""
        resp = self.client.get("/demo/scenario?mode=bad_mode")
        self.assertEqual(resp.status_code, 422)
        self.assertIn("error", resp.json())


class TestVideoPathResolution(unittest.TestCase):
    """Tests for _resolve_video_path helper."""

    def test_nonexistent_path_returns_none(self) -> None:
        """Non-existent path must return None."""
        self.assertIsNone(_resolve_video_path("totally_fake_file_xyz_999.mp4"))

    def test_rtsp_uri_passes_through(self) -> None:
        """RTSP URI must pass through unchanged."""
        uri = "rtsp://192.168.1.100:554/stream"
        self.assertEqual(_resolve_video_path(uri), uri)

    def test_http_uri_passes_through(self) -> None:
        """HTTP URI must pass through unchanged."""
        uri = "http://example.com/stream.m3u8"
        self.assertEqual(_resolve_video_path(uri), uri)


class TestAISummary(unittest.TestCase):
    """Tests for GET /ai/summary endpoint."""

    def setUp(self) -> None:
        self.client = TestClient(app)

    def test_ai_summary_returns_200_and_has_all_required_keys(self) -> None:
        """GET /ai/summary must return 200 and contain all required keys."""
        resp = self.client.get("/ai/summary")
        self.assertEqual(resp.status_code, 200, f"Expected 200, got {resp.status_code}: {resp.text}")
        data = resp.json()

        required_keys = [
            "zone_id",
            "zone_name",
            "risk_level",
            "summary_en",
            "summary_hi",
            "recommended_actions",
            "generated_by",
            "timestamp",
        ]
        for key in required_keys:
            self.assertIn(key, data, f"Missing required key: {key}")

    def test_ai_summary_generated_by_is_valid(self) -> None:
        """generated_by must be one of: 'gemini', 'groq', 'cohere', 'fallback'."""
        resp = self.client.get("/ai/summary")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn(data["generated_by"], ("gemini", "groq", "cohere", "fallback"))


if __name__ == "__main__":
    unittest.main()

