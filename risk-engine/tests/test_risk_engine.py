"""
CrowdShield — Risk Engine Unit and Integration Tests
----------------------------------------------------
Tests transparent risk scoring, explainability, rolling-window trend analysis,
bottleneck detection, ETA prediction, threshold tuning, and wire contract validation.
"""

from datetime import datetime, timezone
import os
import sys
import unittest

# Ensure risk-engine and workspace roots are on sys.path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
RISK_ENGINE_DIR = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
CROWDSHIELD_ROOT = os.path.abspath(os.path.join(RISK_ENGINE_DIR, ".."))

if RISK_ENGINE_DIR not in sys.path:
    sys.path.insert(0, RISK_ENGINE_DIR)
if CROWDSHIELD_ROOT not in sys.path:
    sys.path.insert(0, CROWDSHIELD_ROOT)

from config import RiskEngineConfig
from explainability import RiskBreakdown
from risk_engine import RiskEngine, RiskEvent
from rules import Announcement


class TestRiskEngine(unittest.TestCase):
    """Test suite covering all predictive risk scoring scenarios and contracts."""

    def setUp(self) -> None:
        """Initializes a fresh RiskEngine instance before each test."""
        self.engine = RiskEngine()

    def test_01_low_density_safe_scenario(self) -> None:
        """Scenario 1: Low density + normal flow velocity produces a 'low' risk event with null ETA."""
        # Feed 5 readings: density=0.5 p/m² (well below safe 1.2), flow=1.2 m/s (free flow)
        for i in range(5):
            event = self.engine.process_estimate({
                "zone_id": "gate_1",
                "zone_name": "Gate 1 Main Entrance",
                "density_per_sqm": 0.5,
                "flow_speed_mps": 1.2,
                "video_time_sec": float(i * 2.0),
                "timestamp": "2026-08-11T12:00:00Z",
            })

        self.assertEqual(event.zone_id, "gate_1")
        self.assertEqual(event.risk_level, "low")
        self.assertLess(event.risk_score, 0.30)
        self.assertIsNone(event.eta_minutes)
        self.assertIsInstance(event.announcement, Announcement)
        self.assertIn("normal", event.announcement.en.lower())

    def test_02_high_density_rising_trend_scenario(self) -> None:
        """Scenario 2: Rapidly rising density escalates risk level to 'high' or 'critical'."""
        # Feed an escalating sequence of densities from 1.0 up to 3.8 p/m² over 20 seconds
        densities = [1.0, 1.5, 2.2, 2.8, 3.4, 3.8]
        last_event: RiskEvent = None  # type: ignore

        for i, d in enumerate(densities):
            last_event = self.engine.process_estimate({
                "zone_id": "gate_2",
                "zone_name": "North Gate 2",
                "density_per_sqm": d,
                "flow_speed_mps": 0.7,
                "video_time_sec": float(i * 2.0),
            })

        self.assertIsNotNone(last_event)
        self.assertIn(last_event.risk_level, ["high", "critical"])
        self.assertGreaterEqual(last_event.risk_score, 0.60)
        self.assertGreater(len(last_event.recommendations), 0)

    def test_03_slow_flow_high_density_bottleneck_scenario(self) -> None:
        """Scenario 3: High density combined with stagnant flow triggers the bottleneck penalty."""
        # Density is high (3.6 p/m²) and flow has collapsed to 0.05 m/s (gridlock)
        for i in range(4):
            event = self.engine.process_estimate({
                "zone_id": "gate_3",
                "zone_name": "South Concourse Gate 3",
                "density_per_sqm": 3.6,
                "flow_speed_mps": 0.05,
                "video_time_sec": float(i * 2.0),
            })

        self.assertEqual(event.risk_level, "critical")
        self.assertGreaterEqual(event.risk_score, 0.80)

        # Verify explainability shows bottleneck contribution
        breakdown = self.engine.get_explanation("gate_3")
        self.assertIsNotNone(breakdown)
        assert breakdown is not None
        self.assertGreater(breakdown.bottleneck_score, 0.5)
        self.assertIn("bottleneck", breakdown.explanation.lower())

    def test_04_eta_minutes_calculation(self) -> None:
        """Scenario 4: Positive density slope projects accurate time-to-critical in minutes."""
        # Start at density 2.0 p/m² and rise at +0.02 p/m² per second (gap to critical 4.0 is 2.0 p/m² -> ~100s -> ~2 mins)
        for i in range(6):
            t = float(i * 2.0)
            d = 2.0 + (0.02 * t)
            event = self.engine.process_estimate({
                "zone_id": "gate_4",
                "density_per_sqm": round(d, 2),
                "flow_speed_mps": 0.6,
                "video_time_sec": t,
            })

        self.assertIsNotNone(event.eta_minutes)
        # Expect eta_minutes between 1 and 3 minutes
        self.assertGreaterEqual(event.eta_minutes, 1)  # type: ignore
        self.assertLessEqual(event.eta_minutes, 4)     # type: ignore

    def test_05_negative_trend_clearing_scenario(self) -> None:
        """Scenario 5: Falling density trend dampens risk score and reduces alert level."""
        # Crowd begins dispersing: density drops from 3.0 down to 1.2
        densities = [3.0, 2.6, 2.1, 1.6, 1.2]
        last_event: RiskEvent = None  # type: ignore

        for i, d in enumerate(densities):
            last_event = self.engine.process_estimate({
                "zone_id": "gate_1",
                "density_per_sqm": d,
                "flow_speed_mps": 1.1,
                "video_time_sec": float(i * 2.0),
            })

        self.assertEqual(last_event.risk_level, "low")
        self.assertLess(last_event.risk_score, 0.35)

    def test_06_config_threshold_tuning(self) -> None:
        """Scenario 6: Customizing RiskEngineConfig thresholds adjusts risk classification."""
        # Create a conservative / sensitive config where medium starts at 0.20 and high at 0.40
        sensitive_config = RiskEngineConfig(
            threshold_medium=0.20,
            threshold_high=0.40,
            threshold_critical=0.70,
        )
        custom_engine = RiskEngine(config=sensitive_config)

        event = custom_engine.process_estimate({
            "zone_id": "gate_sens",
            "density_per_sqm": 1.8,
            "flow_speed_mps": 0.9,
            "video_time_sec": 0.0,
        })

        # With default thresholds, this would be low/medium; with sensitive config, it triggers medium/high
        self.assertIn(event.risk_level, ["medium", "high"])

    def test_07_custom_weights_tuning(self) -> None:
        """Scenario 7: Adjusting component weights directly shifts the resulting score."""
        # Config heavily weighted on flow speed (w_flow = 0.70)
        flow_focused_config = RiskEngineConfig(
            weight_density=0.10,
            weight_trend=0.10,
            weight_flow=0.70,
            weight_bottleneck=0.10,
        )
        custom_engine = RiskEngine(config=flow_focused_config)

        # Low density (1.0 p/m²) but 0 flow speed (0.0 m/s)
        event = custom_engine.process_estimate({
            "zone_id": "gate_flow",
            "density_per_sqm": 1.0,
            "flow_speed_mps": 0.0,
            "video_time_sec": 0.0,
        })

        # Flow score is 1.0 * 0.70 weight = 0.70+, driving risk to high
        self.assertGreaterEqual(event.risk_score, 0.60)
        self.assertIn(event.risk_level, ["high", "critical"])

    def test_08_rolling_window_capacity_and_reset(self) -> None:
        """Scenario 8: Rolling window enforces maxlen and reset_zone clears state."""
        config = RiskEngineConfig(window_size=5)
        engine = RiskEngine(config=config)

        for i in range(12):
            engine.process_estimate({
                "zone_id": "gate_win",
                "density_per_sqm": 1.0 + i * 0.1,
                "flow_speed_mps": 1.0,
                "video_time_sec": float(i * 2.0),
            })

        self.assertEqual(len(engine._zone_windows["gate_win"]), 5)

        # Test reset
        engine.reset_zone("gate_win")
        self.assertNotIn("gate_win", engine._latest_events)
        self.assertEqual(len(engine._zone_windows["gate_win"]), 0)

    def test_09_explainability_diagnostics(self) -> None:
        """Scenario 9: get_explanation produces comprehensive diagnostic object and dictionary."""
        self.engine.process_estimate({
            "zone_id": "gate_diag",
            "zone_name": "Diagnostic Gate",
            "density_per_sqm": 2.8,
            "flow_speed_mps": 0.4,
            "video_time_sec": 0.0,
        })

        breakdown = self.engine.get_explanation("gate_diag")
        self.assertIsInstance(breakdown, RiskBreakdown)
        assert breakdown is not None
        self.assertIn("Diagnostic Gate", breakdown.explanation)

        d = breakdown.to_dict()
        self.assertIn("components", d)
        self.assertIn("density_score", d["components"])
        self.assertIn("explanation", d)

    def test_10_pipeline_contract_parity(self) -> None:
        """Scenario 10: Emitted RiskEvent strictly adheres to shared wire format specification."""
        event = self.engine.process_estimate({
            "zone_id": "gate_3",
            "zone_name": "Gate 3 Concourse",
            "density_per_sqm": 3.2,
            "flow_speed_mps": 0.4,
            "video_time_sec": 10.0,
            "timestamp": "2026-08-11T12:30:00Z",
        })

        data = event.model_dump()
        required_keys = [
            "zone_id",
            "zone_name",
            "timestamp",
            "density_per_sqm",
            "flow_speed_mps",
            "risk_score",
            "risk_level",
            "eta_minutes",
            "recommendations",
            "announcement",
        ]
        for key in required_keys:
            self.assertIn(key, data, f"Missing contract key: {key}")

        self.assertIn("en", data["announcement"])
        self.assertIn("hi", data["announcement"])
        self.assertIsInstance(data["recommendations"], list)


if __name__ == "__main__":
    unittest.main()
