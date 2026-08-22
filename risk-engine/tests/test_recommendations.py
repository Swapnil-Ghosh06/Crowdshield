"""
CrowdShield — Recommendation Engine Unit & Integration Tests
------------------------------------------------------------
Tests the 4-layer recommendation engine and fallback cascade:
    1. Deterministic rule layer across all 4 zones and all 4 risk levels
    2. Dynamic adjacent zone capacity routing
    3. 4-layer LLM cascade:
       - Layer 1: Google Gemini (Primary)
       - Layer 2: Groq (Secondary Fallback)
       - Layer 3: Cohere (Tertiary Fallback)
       - Layer 4: Rule-based Templates (Quaternary Guaranteed Fallback)
    4. Silent fallback behavior across all failure modes (missing keys, network timeouts, API errors)
    5. Environment variable toggling (LLM_CASCADE_ENABLED / RECOMMENDATIONS_USE_LLM)
    6. Contract compliance with pipeline and mobile/dashboard wire schemas
"""

from datetime import datetime, timezone
import os
import sys
import unittest
from unittest.mock import MagicMock, patch

# Ensure risk-engine and crowdshield root are on sys.path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
RISK_ENGINE_DIR = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
CROWDSHIELD_ROOT = os.path.abspath(os.path.join(RISK_ENGINE_DIR, ".."))

if RISK_ENGINE_DIR not in sys.path:
    sys.path.insert(0, RISK_ENGINE_DIR)
if CROWDSHIELD_ROOT not in sys.path:
    sys.path.insert(0, CROWDSHIELD_ROOT)

from recommendations import (
    Announcement,
    RecommendationEngine,
    RecommendationResult,
    VENUE_MAP,
    generate_llm_announcement,
    generate_llm_cascade_announcement,
    generate_rule_announcement,
    generate_rule_recommendations,
    get_optimal_alternate_zone,
    get_recommendations,
)
from risk_engine import RiskEvent


class TestRecommendationEngine(unittest.TestCase):
    """Unit test suite validating rule logic, 4-layer LLM cascade, and fail-safe fallbacks."""

    def setUp(self) -> None:
        """Sets up a clean testing environment before each test."""
        self.engine = RecommendationEngine()
        # Clean environment overrides
        for env_var in [
            "LLM_CASCADE_ENABLED",
            "RECOMMENDATIONS_USE_LLM",
            "GEMINI_API_KEY",
            "GEMINI_API_KEY_2",
            "GROQ_API_KEY",
            "COHERE_API_KEY",
        ]:
            if env_var in os.environ:
                del os.environ[env_var]

    def test_01_rule_layer_low_risk(self) -> None:
        """Scenario 1: Low risk level across all zones returns monitoring SOPs and welcoming announcements."""
        for zone_id in ["gate_1", "gate_2", "gate_3", "gate_4"]:
            event = RiskEvent(
                zone_id=zone_id,
                zone_name=VENUE_MAP[zone_id].zone_name,
                timestamp="2026-08-11T12:00:00Z",
                density_per_sqm=0.8,
                flow_speed_mps=1.3,
                risk_score=0.15,
                risk_level="low",
                eta_minutes=None,
                recommendations=[],
                announcement=Announcement(en="temp", hi="temp"),
            )
            result = self.engine.generate(event)

            self.assertIsInstance(result, RecommendationResult)
            self.assertFalse(result.used_llm)
            self.assertIn("maintain_standard_monitoring", result.recommendations)
            self.assertIn(f"monitor_{zone_id}", result.recommendations)
            self.assertIn("normal", result.announcement.en.lower())
            self.assertIn("सामान्य", result.announcement.hi)

    def test_02_rule_layer_medium_risk(self) -> None:
        """Scenario 2: Medium risk level generates staff preparation and monitoring escalation."""
        event = RiskEvent(
            zone_id="gate_1",
            zone_name="South Entrance",
            timestamp="2026-08-11T12:00:00Z",
            density_per_sqm=2.2,
            flow_speed_mps=0.9,
            risk_score=0.45,
            risk_level="medium",
            eta_minutes=15,
            recommendations=[],
            announcement=Announcement(en="temp", hi="temp"),
        )
        result = self.engine.generate(event)

        self.assertIn("increase_monitoring_gate_1", result.recommendations)
        self.assertIn("prepare_staff_gate_1", result.recommendations)
        self.assertIn("increase_monitoring", result.recommendations)
        self.assertIn("moderately heavy", result.announcement.en.lower())
        self.assertIn("धीमा", result.announcement.hi)

    def test_03_rule_layer_high_risk(self) -> None:
        """Scenario 3: High risk level triggers alternate gate opening, directional redirection, and staff deployment."""
        event = RiskEvent(
            zone_id="gate_2",
            zone_name="West Entrance",
            timestamp="2026-08-11T12:00:00Z",
            density_per_sqm=3.5,
            flow_speed_mps=0.5,
            risk_score=0.72,
            risk_level="high",
            eta_minutes=8,
            recommendations=[],
            announcement=Announcement(en="temp", hi="temp"),
        )
        result = self.engine.generate(event)

        self.assertIn("deploy_staff_gate_2", result.recommendations)
        self.assertIn("open_alternate_gate", result.recommendations)
        self.assertIn("redirect_crowd_flow", result.recommendations)
        # Should include specific actionable target gate token
        has_open_gate = any(r.startswith("open_gate_") for r in result.recommendations)
        has_redirect = any(r.startswith("redirect_flow_") for r in result.recommendations)
        self.assertTrue(has_open_gate)
        self.assertTrue(has_redirect)
        self.assertIn("high crowd density", result.announcement.en.lower())
        self.assertIn("वैकल्पिक", result.announcement.hi)

    def test_04_rule_layer_critical_risk_and_east_corridor(self) -> None:
        """Scenario 4: Critical risk level executes emergency shutdown and gate_4 side exits."""
        event = RiskEvent(
            zone_id="gate_4",
            zone_name="East Entrance",
            timestamp="2026-08-11T12:00:00Z",
            density_per_sqm=4.8,
            flow_speed_mps=0.1,
            risk_score=0.92,
            risk_level="critical",
            eta_minutes=0,
            recommendations=[],
            announcement=Announcement(en="temp", hi="temp"),
        )
        result = self.engine.generate(event)

        self.assertIn("close_gate_4", result.recommendations)
        self.assertIn("emergency_broadcast", result.recommendations)
        self.assertIn("deploy_all_staff_gate_4", result.recommendations)
        self.assertIn("call_security", result.recommendations)
        self.assertIn("open_side_corridor_exits", result.recommendations)
        self.assertIn("emergency advisory", result.announcement.en.lower())
        self.assertIn("आपातकालीन", result.announcement.hi)

    def test_05_adjacent_zone_capacity_dynamic_routing(self) -> None:
        """Scenario 5: Dynamic capacity routing directs crowd to least congested adjacent gate."""
        # gate_1 (South) is adjacent to gate_2 (West) and gate_4 (East)
        # Case A: gate_2 is congested (load=4.0), gate_4 is clear (load=0.5) -> route East to gate_4
        capacities_a = {"gate_2": 4.0, "gate_4": 0.5}
        target_a, dir_a = get_optimal_alternate_zone("gate_1", capacities_a)
        self.assertEqual(target_a, "gate_4")
        self.assertEqual(dir_a, "east")

        recs_a = generate_rule_recommendations("gate_1", "high", adjacent_capacities=capacities_a)
        self.assertIn("open_gate_4", recs_a)
        self.assertIn("redirect_flow_east", recs_a)

        # Case B: gate_4 is congested (load=3.8), gate_2 is clear (load=0.2) -> route West to gate_2
        capacities_b = {"gate_2": 0.2, "gate_4": 3.8}
        target_b, dir_b = get_optimal_alternate_zone("gate_1", capacities_b)
        self.assertEqual(target_b, "gate_2")
        self.assertEqual(dir_b, "west")

        recs_b = generate_rule_recommendations("gate_1", "high", adjacent_capacities=capacities_b)
        self.assertIn("open_gate_2", recs_b)
        self.assertIn("redirect_flow_west", recs_b)

    def test_llm_cascade_gemini_primary(self) -> None:
        """Layer 1 Test: When Gemini succeeds, returns bilingual announcement with used_llm='gemini'."""
        os.environ["LLM_CASCADE_ENABLED"] = "true"
        os.environ["GEMINI_API_KEY"] = "gemini-test-valid-key"

        with patch("recommendations._call_gemini") as mock_gemini:
            mock_gemini.return_value = Announcement(
                en="South Entrance is experiencing high density. Please proceed calmly towards West Entrance.",
                hi="साउथ एंट्रेंस पर भीड़ अधिक है। कृपया शांतिपूर्वक वेस्ट एंट्रेंस की ओर बढ़ें।",
            )

            event = {
                "zone_id": "gate_1",
                "zone_name": "South Entrance",
                "risk_level": "high",
                "density_per_sqm": 3.4,
                "flow_speed_mps": 0.5,
                "eta_minutes": 7,
            }
            result = self.engine.generate(event)

            mock_gemini.assert_called_once()
            self.assertEqual(result.used_llm, "gemini")
            self.assertTrue(result.used_llm)
            self.assertEqual(
                result.announcement.en,
                "South Entrance is experiencing high density. Please proceed calmly towards West Entrance.",
            )
            self.assertEqual(
                result.announcement.hi,
                "साउथ एंट्रेंस पर भीड़ अधिक है। कृपया शांतिपूर्वक वेस्ट एंट्रेंस की ओर बढ़ें।",
            )

    def test_llm_cascade_groq_fallback(self) -> None:
        """Layer 2 Test: When Gemini fails, Groq succeeds, returns used_llm='groq'."""
        os.environ["LLM_CASCADE_ENABLED"] = "true"
        os.environ["GEMINI_API_KEY"] = "gemini-test-key"
        os.environ["GROQ_API_KEY"] = "groq-test-key"

        with patch("recommendations._call_gemini") as mock_gemini, patch("recommendations._call_groq") as mock_groq:
            # Gemini fails (e.g. rate limited or connection timeout)
            mock_gemini.return_value = None
            # Groq succeeds
            mock_groq.return_value = Announcement(
                en="Attention at West Entrance: High density. Please move steadily towards North Entrance.",
                hi="वेस्ट एंट्रेंस पर अत्यधिक भीड़ है। कृपया नॉर्थ एंट्रेंस की ओर बढ़ें।",
            )

            event = {
                "zone_id": "gate_2",
                "zone_name": "West Entrance",
                "risk_level": "high",
                "density_per_sqm": 3.6,
                "flow_speed_mps": 0.4,
                "eta_minutes": 6,
            }
            result = self.engine.generate(event)

            mock_gemini.assert_called_once()
            mock_groq.assert_called_once()
            self.assertEqual(result.used_llm, "groq")
            self.assertTrue(result.used_llm)
            self.assertIn("Attention at West Entrance", result.announcement.en)
            self.assertIn("वेस्ट एंट्रेंस", result.announcement.hi)

    def test_llm_cascade_cohere_fallback(self) -> None:
        """Layer 3 Test: When Gemini and Groq fail, Cohere succeeds, returns used_llm='cohere'."""
        os.environ["LLM_CASCADE_ENABLED"] = "true"
        os.environ["GEMINI_API_KEY"] = "gemini-key"
        os.environ["GROQ_API_KEY"] = "groq-key"
        os.environ["COHERE_API_KEY"] = "cohere-key"

        with patch("recommendations._call_gemini") as mock_gemini, \
             patch("recommendations._call_groq") as mock_groq, \
             patch("recommendations._call_cohere") as mock_cohere:
            mock_gemini.return_value = None
            mock_groq.return_value = None
            mock_cohere.return_value = Announcement(
                en="North Entrance congested. Please follow marshal instructions towards East Entrance.",
                hi="नॉर्थ एंट्रेंस पर भीड़ है। कृपया सुरक्षा कर्मियों के निर्देशों का पालन करें।",
            )

            event = {
                "zone_id": "gate_3",
                "zone_name": "North Entrance",
                "risk_level": "high",
                "density_per_sqm": 3.8,
                "flow_speed_mps": 0.3,
                "eta_minutes": 5,
            }
            result = self.engine.generate(event)

            mock_gemini.assert_called_once()
            mock_groq.assert_called_once()
            mock_cohere.assert_called_once()
            self.assertEqual(result.used_llm, "cohere")
            self.assertTrue(result.used_llm)
            self.assertIn("North Entrance congested", result.announcement.en)
            self.assertIn("नॉर्थ एंट्रेंस", result.announcement.hi)

    def test_llm_cascade_template_fallback(self) -> None:
        """Layer 4 Test: When all 3 API layers fail, falls back to deterministic rule template."""
        os.environ["LLM_CASCADE_ENABLED"] = "true"
        os.environ["GEMINI_API_KEY"] = "gemini-key"
        os.environ["GROQ_API_KEY"] = "groq-key"
        os.environ["COHERE_API_KEY"] = "cohere-key"

        with patch("recommendations._call_gemini", return_value=None), \
             patch("recommendations._call_groq", return_value=None), \
             patch("recommendations._call_cohere", return_value=None):
            event = {
                "zone_id": "gate_1",
                "zone_name": "South Entrance",
                "risk_level": "critical",
                "density_per_sqm": 4.5,
                "flow_speed_mps": 0.1,
                "eta_minutes": 2,
            }
            result = get_recommendations(event)

            # Must fall back to rule announcement with used_llm=False
            self.assertFalse(result.used_llm)
            self.assertEqual(result.used_llm, False)
            self.assertIn("EMERGENCY ADVISORY", result.announcement.en)
            self.assertIn("आपातकालीन", result.announcement.hi)

    def test_llm_cascade_disabled(self) -> None:
        """Scenario: LLM_CASCADE_ENABLED=false goes straight to rule template without calling APIs."""
        os.environ["LLM_CASCADE_ENABLED"] = "false"
        os.environ["GEMINI_API_KEY"] = "gemini-key"
        os.environ["GROQ_API_KEY"] = "groq-key"
        os.environ["COHERE_API_KEY"] = "cohere-key"

        with patch("recommendations._call_gemini") as mock_gemini, \
             patch("recommendations._call_groq") as mock_groq, \
             patch("recommendations._call_cohere") as mock_cohere:
            event = {
                "zone_id": "gate_2",
                "risk_level": "medium",
                "density_per_sqm": 2.0,
                "flow_speed_mps": 1.0,
            }
            result = self.engine.generate(event)

            mock_gemini.assert_not_called()
            mock_groq.assert_not_called()
            mock_cohere.assert_not_called()
            self.assertFalse(result.used_llm)
            self.assertIn("Attention visitors near West Entrance", result.announcement.en)

    def test_llm_fallback_when_api_keys_missing(self) -> None:
        """Scenario: When LLM cascade is enabled but no API keys are present, silently falls back to template."""
        os.environ["LLM_CASCADE_ENABLED"] = "true"
        # Ensure no keys set
        os.environ.pop("GEMINI_API_KEY", None)
        os.environ.pop("GROQ_API_KEY", None)
        os.environ.pop("COHERE_API_KEY", None)

        event = RiskEvent(
            zone_id="gate_3",
            zone_name="North Entrance",
            timestamp="2026-08-11T12:00:00Z",
            density_per_sqm=3.0,
            flow_speed_mps=0.6,
            risk_score=0.65,
            risk_level="high",
            eta_minutes=10,
            recommendations=[],
            announcement=Announcement(en="temp", hi="temp"),
        )
        result = self.engine.generate(event)

        self.assertFalse(result.used_llm)
        self.assertIsNotNone(result.announcement)
        self.assertTrue(len(result.announcement.en) > 0)
        self.assertTrue(len(result.announcement.hi) > 0)
        self.assertIn("attention", result.announcement.en.lower())

    def test_output_contract_compliance_and_unpacking(self) -> None:
        """Scenario: Validates output shape, tuple unpacking, and dictionary serialization."""
        event = {
            "zone_id": "gate_3",
            "zone_name": "North Gate 3",
            "risk_level": "high",
            "density_per_sqm": 3.6,
            "flow_speed_mps": 0.4,
            "eta_minutes": 6,
        }
        result = get_recommendations(event)

        # 1. Attribute access
        self.assertIsInstance(result.recommendations, list)
        self.assertIsInstance(result.announcement, Announcement)
        self.assertIsInstance(result.announcement.en, str)
        self.assertIsInstance(result.announcement.hi, str)

        # 2. Tuple unpacking
        recs, ann = result
        self.assertIsInstance(recs, list)
        self.assertIsInstance(ann, dict)
        self.assertIn("en", ann)
        self.assertIn("hi", ann)

        # 3. Dict serialization
        d = result.to_dict()
        self.assertIn("recommendations", d)
        self.assertIn("announcement", d)
        self.assertIn("en", d["announcement"])
        self.assertIn("hi", d["announcement"])
        self.assertIn("used_llm", d)


if __name__ == "__main__":
    unittest.main()
