"""
Unit and Integration Tests for CrowdShield Vision Engine
--------------------------------------------------------
Tests crowd density estimation, HOG/modular detectors, optical flow tracking,
temporal sub-sampling, and Pydantic data serialization using synthetic video streams.
"""

import math
import os
import subprocess
import sys
import tempfile
import unittest
import cv2
import numpy as np

# Ensure vision-engine is on sys.path for direct imports
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
VISION_ENGINE_DIR = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if VISION_ENGINE_DIR not in sys.path:
    sys.path.insert(0, VISION_ENGINE_DIR)

from density_estimator import CrowdDensityEstimator
from detectors import (
    BaseCrowdDetector,
    CSRNetCrowdDetector,
    HOGPedestrianDetector,
    YOLOCrowdDetector,
    apply_non_max_suppression,
    get_detector,
)
from flow_tracker import CrowdFlowTracker
from models import DetectionBox, FlowDirection, ZoneDensityEstimate


def create_synthetic_test_video(
    filepath: str,
    duration_sec: float = 6.0,
    fps: float = 30.0,
    width: int = 640,
    height: int = 480,
    moving_objects: bool = True,
) -> None:
    """Generates a synthetic MP4 video file with simulated moving human-like shapes.

    Args:
        filepath: Destination video file path.
        duration_sec: Total length in seconds.
        fps: Frames per second.
        width: Video frame width in pixels.
        height: Video frame height in pixels.
        moving_objects: Whether to render downward-moving pedestrian shapes.
    """
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    out = cv2.VideoWriter(filepath, fourcc, fps, (width, height))

    total_frames = int(duration_sec * fps)

    # Initial positions for 3 simulated pedestrians (moving downwards = towards exit)
    pedestrians = [
        {"x": 160, "y": 60, "speed_y": 2.0},
        {"x": 320, "y": 100, "speed_y": 2.5},
        {"x": 480, "y": 80, "speed_y": 1.8},
    ]

    for frame_idx in range(total_frames):
        # Create neutral background with grid pattern
        frame = np.full((height, width, 3), 200, dtype=np.uint8)

        # Draw background grid lines for texture
        for gx in range(0, width, 40):
            cv2.line(frame, (gx, 0), (gx, height), (180, 180, 180), 1)
        for gy in range(0, height, 40):
            cv2.line(frame, (0, gy), (width, gy), (180, 180, 180), 1)

        # Render moving human-like silhouettes (head + body)
        if moving_objects:
            for p in pedestrians:
                current_y = int(p["y"] + frame_idx * p["speed_y"]) % (height - 120)
                cx = p["x"]

                # Head (circle)
                cv2.circle(frame, (cx, current_y + 20), 16, (40, 40, 40), -1)
                # Torso (rectangle)
                cv2.rectangle(
                    frame,
                    (cx - 24, current_y + 36),
                    (cx + 24, current_y + 90),
                    (50, 50, 50),
                    -1,
                )
                # Legs
                cv2.line(frame, (cx - 12, current_y + 90), (cx - 14, current_y + 130), (30, 30, 30), 6)
                cv2.line(frame, (cx + 12, current_y + 90), (cx + 14, current_y + 130), (30, 30, 30), 6)

        out.write(frame)

    out.release()


class TestDataModels(unittest.TestCase):
    """Unit tests for Pydantic data models and schemas."""

    def test_zone_density_estimate_validation(self):
        """Tests standard creation and validation of ZoneDensityEstimate."""
        estimate = ZoneDensityEstimate(
            zone_id="gate_3",
            zone_name="Gate 3 Entrance",
            timestamp="2026-08-11T12:00:00Z",
            frame_index=60,
            video_time_sec=2.0,
            person_count=100,
            zone_area_sqm=50.0,
            density_per_sqm=2.0,
            flow_speed_mps=1.15,
            flow_direction=FlowDirection.TOWARDS_EXIT,
        )
        self.assertEqual(estimate.zone_id, "gate_3")
        self.assertEqual(estimate.density_per_sqm, 2.0)
        self.assertEqual(estimate.flow_direction, FlowDirection.TOWARDS_EXIT)

    def test_to_risk_input_serialization(self):
        """Verifies that to_risk_input provides the exact dictionary expected by risk engines."""
        estimate = ZoneDensityEstimate(
            zone_id="gate_1",
            zone_name="Gate 1 Main",
            timestamp="2026-08-11T12:00:00Z",
            frame_index=30,
            video_time_sec=1.0,
            person_count=45,
            zone_area_sqm=30.0,
            density_per_sqm=1.5,
            flow_speed_mps=0.8,
            flow_direction=FlowDirection.STATIONARY,
        )
        payload = estimate.to_risk_input()
        self.assertIn("zone_id", payload)
        self.assertIn("density_per_sqm", payload)
        self.assertIn("flow_speed_mps", payload)
        self.assertIn("flow_direction", payload)
        self.assertEqual(payload["flow_direction"], "stationary")
        self.assertEqual(payload["density_per_sqm"], 1.5)

    def test_detection_box_center(self):
        """Tests geometric centroid calculation on DetectionBox."""
        box = DetectionBox(x=100, y=200, width=50, height=80, confidence=0.95)
        self.assertEqual(box.center, (125.0, 240.0))


class TestDetectors(unittest.TestCase):
    """Unit tests for detector backends, NMS algorithm, and factory function."""

    def test_nms_suppression(self):
        """Tests that overlapping duplicate bounding boxes are merged by NMS."""
        # Two boxes heavily overlapping (IoU ~ 0.8)
        boxes = [
            (100, 100, 50, 100),
            (102, 103, 50, 100),
            (300, 300, 50, 100),  # Separate box
        ]
        filtered = apply_non_max_suppression(boxes, overlap_threshold=0.3)
        self.assertEqual(len(filtered), 2)

    def test_hog_detector_initialization(self):
        """Verifies HOG detector initializes without errors."""
        detector = HOGPedestrianDetector()
        self.assertIsInstance(detector, BaseCrowdDetector)
        # Test on blank image
        blank = np.zeros((480, 640, 3), dtype=np.uint8)
        results = detector.detect(blank)
        self.assertIsInstance(results, list)

    def test_get_detector_factory(self):
        """Tests detector factory instantiation for hog, yolo, and csrnet."""
        hog_det = get_detector("hog")
        self.assertIsInstance(hog_det, HOGPedestrianDetector)

        yolo_det = get_detector("yolo")
        self.assertIsInstance(yolo_det, YOLOCrowdDetector)

        csrnet_det = get_detector("csrnet")
        self.assertIsInstance(csrnet_det, CSRNetCrowdDetector)

        with self.assertRaises(ValueError):
            get_detector("unsupported_detector_type")


class TestFlowTracker(unittest.TestCase):
    """Unit tests for optical flow speed calculation and direction classification."""

    def test_flow_initialization_and_reset(self):
        """Tests tracker initialization and clean reset."""
        tracker = CrowdFlowTracker(pixels_per_meter=30.0, exit_direction="down")
        frame1 = np.full((200, 200, 3), 128, dtype=np.uint8)
        speed, direction, vec = tracker.calculate_flow(frame1, current_time_sec=0.0)
        self.assertEqual(speed, 0.0)
        self.assertEqual(direction, FlowDirection.STATIONARY)

        tracker.reset()
        self.assertIsNone(tracker._prev_gray)

    def test_directional_exit_vectors(self):
        """Tests that exit vectors correctly map cardinal directions and custom angles."""
        tracker_down = CrowdFlowTracker(exit_direction="down")
        self.assertEqual(tracker_down._exit_unit_vector, (0.0, 1.0))

        tracker_up = CrowdFlowTracker(exit_direction="up")
        self.assertEqual(tracker_up._exit_unit_vector, (0.0, -1.0))

        tracker_right = CrowdFlowTracker(exit_direction="right")
        self.assertEqual(tracker_right._exit_unit_vector, (1.0, 0.0))

    def test_flow_calculation_with_motion(self):
        """Tests that moving texture between frames produces positive velocity."""
        tracker = CrowdFlowTracker(pixels_per_meter=10.0, exit_direction="down")

        # Frame 1: Circle at y=50
        f1 = np.full((300, 300, 3), 220, dtype=np.uint8)
        cv2.circle(f1, (150, 50), 30, (20, 20, 20), -1)
        tracker.calculate_flow(f1, current_time_sec=0.0)

        # Frame 2: Circle moved downward to y=80 at t=1.0s (30px displacement in 1.0s)
        f2 = np.full((300, 300, 3), 220, dtype=np.uint8)
        cv2.circle(f2, (150, 80), 30, (20, 20, 20), -1)
        speed_mps, direction, vec = tracker.calculate_flow(f2, current_time_sec=1.0)

        self.assertGreater(speed_mps, 0.0)
        self.assertIn(direction, [FlowDirection.TOWARDS_EXIT, FlowDirection.MIXED, FlowDirection.STATIONARY])


class TestDensityEstimatorIntegration(unittest.TestCase):
    """Integration tests executing the full estimation pipeline on synthetic video."""

    def setUp(self):
        """Creates a temporary synthetic video for testing."""
        self.temp_dir = tempfile.TemporaryDirectory()
        self.video_path = os.path.join(self.temp_dir.name, "test_synthetic.mp4")
        create_synthetic_test_video(
            filepath=self.video_path,
            duration_sec=4.0,
            fps=30.0,
            width=640,
            height=480,
            moving_objects=True,
        )

    def tearDown(self):
        """Cleans up temporary video files."""
        self.temp_dir.cleanup()

    def test_density_estimator_sampling(self):
        """Verifies that frame sampling occurs every N seconds (e.g. sample_interval_sec=1.0)."""
        estimator = CrowdDensityEstimator(
            video_source=self.video_path,
            zone_id="gate_3",
            zone_name="South Gate 3",
            zone_area_sqm=50.0,
            sample_interval_sec=1.0,
            detector="hog",
            pixels_per_meter=30.0,
            exit_direction="down",
        )

        estimates = estimator.process_all()
        # For a 4.0 second video sampled every 1.0s, expect approximately 4-5 samples
        self.assertGreaterEqual(len(estimates), 3)
        self.assertLessEqual(len(estimates), 6)

        first_sample = estimates[0]
        self.assertEqual(first_sample.zone_id, "gate_3")
        self.assertEqual(first_sample.zone_area_sqm, 50.0)
        self.assertGreaterEqual(first_sample.density_per_sqm, 0.0)
        self.assertGreaterEqual(first_sample.flow_speed_mps, 0.0)
        self.assertIsInstance(first_sample.timestamp, str)

    def test_cli_execution(self):
        """Verifies standalone CLI execution via subprocess."""
        output_json = os.path.join(self.temp_dir.name, "cli_output.json")
        cmd = [
            sys.executable,
            os.path.join(VISION_ENGINE_DIR, "density_estimator.py"),
            "--video",
            self.video_path,
            "--zone",
            "gate_3",
            "--area",
            "50",
            "--sample-interval",
            "1.5",
            "--output",
            output_json,
        ]

        result = subprocess.run(cmd, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, f"CLI execution failed:\n{result.stderr}")
        self.assertTrue(os.path.exists(output_json))
        self.assertIn("Gate 3", result.stdout)


if __name__ == "__main__":
    unittest.main()
