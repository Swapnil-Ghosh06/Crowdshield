"""
CrowdShield — Crowd Density & Flow Estimator
--------------------------------------------
Core computer vision pipeline for frame-by-frame crowd monitoring, density estimation,
and optical flow velocity tracking.

Key Capabilities:
    1. Video Stream Ingestion: Accepts local video files (.mp4, .avi, .mkv), RTSP live
       camera feeds, or webcam device indices.
    2. Temporal Sub-sampling: Configurable sample interval ($N$ seconds, default 2.0s)
       to balance real-time throughput and CPU efficiency.
    3. Modular Crowd Detection: Uses OpenCV HOG pedestrian detection by default (offline,
       zero weights needed) with pluggable slots for YOLO and CSRNet models.
    4. Optical Flow Tracking: Lucas-Kanade and Farneback optical flow motion analysis
       computing average movement velocity (`flow_speed_mps`) and direction classification
       (`towards_exit`, `away_from_exit`, `stationary`, `mixed`).
    5. Privacy-by-Design: Processes video frames transiently in memory. No raw video frames,
       cropped faces, or biometric data are ever persisted or logged to disk.
    6. Strongly Typed Output: Emits `ZoneDensityEstimate` Pydantic models for direct ingestion
       by `risk-engine/` and `pipeline/`.

Standalone CLI Usage:
    python density_estimator.py --video sample.mp4 --zone gate_3 --area 50
    python density_estimator.py --video rtsp://camera-1/stream --zone gate_1 --area 75 --sample-interval 2.0
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
import logging
import os
import sys
import time
from typing import Generator, List, Optional, Tuple, Union
import cv2

from detectors import BaseCrowdDetector, get_detector
from flow_tracker import CrowdFlowTracker
from models import FlowDirection, ZoneDensityEstimate

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("vision_engine.density_estimator")


class CrowdDensityEstimator:
    """Processes video streams to produce structured crowd density and flow estimates per zone.

    Attributes:
        video_source: Path to video file (.mp4), RTSP stream URI, or camera index.
        zone_id: Machine-readable identifier for the monitored zone (e.g. "gate_3").
        zone_name: Human-readable label for the zone (e.g. "Gate 3 Concourse").
        zone_area_sqm: Calibrated physical area of the zone in square metres.
        sample_interval_sec: Temporal sampling interval in seconds (default: 2.0).
        detector: Configured `BaseCrowdDetector` instance (or name string: 'hog', 'yolo', 'csrnet').
        pixels_per_meter: Spatial calibration scale ratio for optical flow (default: 30.0).
        exit_direction: Target exit direction orientation ('down', 'up', 'left', 'right', or tuple).
        roi: Optional Region of Interest bounding box (x, y, w, h) restricting the zone within frame.
    """

    def __init__(
        self,
        video_source: Union[str, int],
        zone_id: str = "gate_1",
        zone_name: Optional[str] = None,
        zone_area_sqm: float = 50.0,
        sample_interval_sec: float = 2.0,
        detector: Union[str, BaseCrowdDetector] = "hog",
        pixels_per_meter: float = 30.0,
        exit_direction: Union[str, Tuple[float, float]] = "down",
        roi: Optional[Tuple[int, int, int, int]] = None,
        detector_kwargs: Optional[dict] = None,
    ) -> None:
        """Initializes the crowd density and flow estimator.

        Args:
            video_source: Video file path, RTSP stream URL, or camera device integer.
            zone_id: Unique identifier for the monitored venue zone.
            zone_name: Optional human-readable zone name (defaults to Title-cased zone_id).
            zone_area_sqm: Physical zone surface area in square metres (must be > 0).
            sample_interval_sec: Sampling interval in seconds (default: 2.0).
            detector: Instance of `BaseCrowdDetector` or backend name string ('hog', 'yolo', 'csrnet').
            pixels_per_meter: Calibration ratio converting pixel displacement to real-world metres.
            exit_direction: Designated exit heading ('down', 'up', 'left', 'right', or (dx, dy)).
            roi: Optional region of interest (x, y, w, h) in pixel coordinates.
            detector_kwargs: Optional dictionary of keyword arguments passed to the detector factory.

        Why this exists:
            Configures the estimation pipeline parameters for a specific physical monitoring zone.
        """
        self.video_source = video_source
        self.zone_id = zone_id
        self.zone_name = zone_name or zone_id.replace("_", " ").title()
        self.zone_area_sqm = max(0.1, float(zone_area_sqm))
        self.sample_interval_sec = max(0.1, float(sample_interval_sec))
        self.roi = roi

        # Initialize detector
        if isinstance(detector, BaseCrowdDetector):
            self.detector = detector
        else:
            kwargs = detector_kwargs or {}
            self.detector = get_detector(detector, **kwargs)

        # Initialize optical flow tracker
        self.flow_tracker = CrowdFlowTracker(
            pixels_per_meter=pixels_per_meter,
            exit_direction=exit_direction,
        )

    def _open_capture(self) -> cv2.VideoCapture:
        """Opens and validates the OpenCV VideoCapture resource.

        Returns:
            Open instance of `cv2.VideoCapture`.

        Raises:
            FileNotFoundError: If a local video file path does not exist.
            RuntimeError: If the video stream or file cannot be opened by OpenCV.

        Why this exists:
            Centralizes video source opening with explicit error diagnostics.
        """
        # Check local file existence if a string path is given
        if isinstance(self.video_source, str) and not self.video_source.startswith(
            ("rtsp://", "http://", "https://")
        ):
            # Check if it's a digit string representing camera index
            if self.video_source.isdigit():
                cap = cv2.VideoCapture(int(self.video_source))
            else:
                if not os.path.exists(self.video_source):
                    raise FileNotFoundError(
                        f"Video file not found at path: '{self.video_source}'"
                    )
                cap = cv2.VideoCapture(self.video_source)
        else:
            cap = cv2.VideoCapture(self.video_source)

        if not cap.isOpened():
            raise RuntimeError(
                f"Failed to open video source: '{self.video_source}'. "
                f"Check file integrity, RTSP connection, or codec compatibility."
            )

        return cap

    def process_video(
        self,
        max_duration_sec: Optional[float] = None,
    ) -> Generator[ZoneDensityEstimate, None, None]:
        """Processes video frame by frame, yielding density and flow estimates at sampled intervals.

        Args:
            max_duration_sec: Optional maximum playback duration in seconds to process.

        Yields:
            `ZoneDensityEstimate` objects for each sampled time interval.

        Why this exists:
            Implements the streaming generator loop that powers live feeds and file processing
            while enforcing privacy by deleting raw frame arrays immediately after metric extraction.
        """
        cap = self._open_capture()
        self.flow_tracker.reset()

        fps = cap.get(cv2.CAP_PROP_FPS)
        if fps <= 0.0 or math_isnan(fps):
            fps = 30.0  # Fallback to standard frame rate if unreadable

        frame_interval = max(1, int(round(fps * self.sample_interval_sec)))
        frame_idx = 0
        last_sampled_frame_idx = -frame_interval  # Force immediate processing of the first frame

        logger.info(
            "Starting video processing for zone '%s' (%s) | FPS: %.2f | Sample Interval: %.2fs (%d frames)",
            self.zone_id,
            self.zone_name,
            fps,
            self.sample_interval_sec,
            frame_interval,
        )

        try:
            while cap.isOpened():
                ret, frame = cap.read()
                if not ret or frame is None:
                    break

                current_time_sec = frame_idx / fps

                if max_duration_sec is not None and current_time_sec > max_duration_sec:
                    logger.info("Reached maximum requested duration: %.2fs", max_duration_sec)
                    break

                # Check if current frame aligns with the sampling interval
                if (frame_idx - last_sampled_frame_idx) >= frame_interval or frame_idx == 0:
                    last_sampled_frame_idx = frame_idx

                    # 1. Estimate crowd count and person locations
                    person_count = self.detector.count(frame, roi=self.roi)

                    # 2. Compute crowd density (people / m²)
                    density_per_sqm = round(person_count / self.zone_area_sqm, 2)

                    # 3. Calculate optical flow speed and direction
                    flow_speed_mps, flow_direction, raw_vector = self.flow_tracker.calculate_flow(
                        current_frame=frame,
                        current_time_sec=current_time_sec,
                        roi=self.roi,
                    )

                    # 4. Generate UTC timestamp
                    now_utc = datetime.now(timezone.utc).isoformat()

                    # 5. Build strongly typed output model
                    estimate = ZoneDensityEstimate(
                        zone_id=self.zone_id,
                        zone_name=self.zone_name,
                        timestamp=now_utc,
                        frame_index=frame_idx,
                        video_time_sec=round(current_time_sec, 2),
                        person_count=person_count,
                        zone_area_sqm=self.zone_area_sqm,
                        density_per_sqm=density_per_sqm,
                        flow_speed_mps=flow_speed_mps,
                        flow_direction=flow_direction,
                        raw_motion_vector=raw_vector,
                    )

                    # Privacy Enforcement: Frame reference is overwritten in next loop iteration
                    # and explicitly dereferenced here.
                    del frame

                    yield estimate

                else:
                    # Non-sampled frame: discard immediately
                    del frame

                frame_idx += 1

        finally:
            cap.release()
            logger.info("Completed processing for zone '%s'. Total frames read: %d", self.zone_id, frame_idx)

    def process_all(
        self,
        max_duration_sec: Optional[float] = None,
    ) -> List[ZoneDensityEstimate]:
        """Convenience method to process an entire video source and return all estimates.

        Args:
            max_duration_sec: Optional duration limit in seconds.

        Returns:
            List of `ZoneDensityEstimate` objects.

        Why this exists:
            Provides a non-streaming batch execution interface for testing and evaluation scripts.
        """
        return list(self.process_video(max_duration_sec=max_duration_sec))


def math_isnan(value: float) -> bool:
    """Helper to check if float value is NaN without importing extra libraries.

    Args:
        value: Float number.

    Returns:
        Boolean True if NaN, False otherwise.

    Why this exists:
        Safely validates OpenCV FPS properties.
    """
    return value != value


def print_estimate_row(estimate: ZoneDensityEstimate, header: bool = False) -> None:
    """Prints a formatted ASCII table row for an estimate in the terminal.

    Args:
        estimate: `ZoneDensityEstimate` object.
        header: Whether to print table header columns.

    Why this exists:
        Provides clean, operator-readable visual feedback during CLI execution.
    """
    if header:
        print("-" * 92)
        print(
            f"{'Time (s)':<10} | {'Zone ID':<10} | {'Count':<7} | {'Area(m²)':<8} | "
            f"{'Density(p/m²)':<14} | {'Flow(m/s)':<10} | {'Direction':<15}"
        )
        print("-" * 92)

    dir_str = estimate.flow_direction.value if estimate.flow_direction else "none"
    print(
        f"{estimate.video_time_sec:<10.1f} | "
        f"{estimate.zone_id:<10} | "
        f"{estimate.person_count:<7} | "
        f"{estimate.zone_area_sqm:<8.1f} | "
        f"{estimate.density_per_sqm:<14.2f} | "
        f"{estimate.flow_speed_mps:<10.2f} | "
        f"{dir_str:<15}"
    )


def main() -> None:
    """Standalone CLI entry point for executing crowd density and flow estimation.

    Command-line Arguments:
        --video: Path to input video file or stream URI (Required).
        --zone: Monitored Zone ID (default: 'gate_3').
        --zone-name: Human-readable zone title.
        --area: Zone surface area in square metres (default: 50.0).
        --sample-interval: Sampling interval in seconds (default: 2.0).
        --detector: Detector backend: 'hog' (default), 'yolo', or 'csrnet'.
        --weights: Optional path to YOLO or CSRNet model weights.
        --pixels-per-meter: Spatial calibration scale ratio (default: 30.0).
        --exit-direction: Target exit direction ('down', 'up', 'left', 'right'; default: 'down').
        --max-duration: Optional duration limit in seconds to process.
        --output: Optional path to output JSON metrics file.
        --quiet: Suppress per-sample table printing.

    Why this exists:
        Allows field engineers, safety operators, and developers to test and verify the
        vision pipeline independently from the command line.
    """
    parser = argparse.ArgumentParser(
        description="CrowdShield — Vision Engine: Crowd Density & Flow Estimation",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--video",
        "-v",
        type=str,
        required=True,
        help="Path to input video file (.mp4, .avi) or RTSP stream URI",
    )
    parser.add_argument(
        "--zone",
        "-z",
        type=str,
        default="gate_3",
        help="Machine-readable zone identifier (e.g. gate_1, gate_3)",
    )
    parser.add_argument(
        "--zone-name",
        type=str,
        default=None,
        help="Human-readable zone label (e.g. 'South Concourse Gate 3')",
    )
    parser.add_argument(
        "--area",
        "-a",
        type=float,
        default=50.0,
        help="Monitored physical surface area in square metres",
    )
    parser.add_argument(
        "--sample-interval",
        "-s",
        type=float,
        default=2.0,
        help="Sampling frequency in seconds (interval between measurements)",
    )
    parser.add_argument(
        "--detector",
        "-d",
        type=str,
        default="hog",
        choices=["hog", "yolo", "csrnet"],
        help="Person detection backend ('hog' works offline with no downloads)",
    )
    parser.add_argument(
        "--weights",
        type=str,
        default=None,
        help="Optional model weights path for YOLO (.pt, .onnx) or CSRNet",
    )
    parser.add_argument(
        "--pixels-per-meter",
        type=float,
        default=30.0,
        help="Spatial calibration ratio (pixels per physical metre)",
    )
    parser.add_argument(
        "--exit-direction",
        type=str,
        default="down",
        choices=["down", "up", "left", "right", "south", "north", "east", "west"],
        help="Reference orientation toward the zone exit for flow classification",
    )
    parser.add_argument(
        "--max-duration",
        type=float,
        default=None,
        help="Maximum playback duration in seconds to process",
    )
    parser.add_argument(
        "--output",
        "-o",
        type=str,
        default=None,
        help="Optional path to write computed numerical metrics (JSON format)",
    )
    parser.add_argument(
        "--quiet",
        "-q",
        action="store_true",
        help="Suppress real-time ASCII table logging",
    )

    args = parser.parse_args()

    detector_kwargs = {}
    if args.weights:
        detector_kwargs["weights_path"] = args.weights

    estimator = CrowdDensityEstimator(
        video_source=args.video,
        zone_id=args.zone,
        zone_name=args.zone_name,
        zone_area_sqm=args.area,
        sample_interval_sec=args.sample_interval,
        detector=args.detector,
        pixels_per_meter=args.pixels_per_meter,
        exit_direction=args.exit_direction,
        detector_kwargs=detector_kwargs,
    )

    print("\n" + "=" * 92)
    print(f" CrowdShield — Crowd Density & Flow Estimator")
    print(f" Zone: {estimator.zone_id} ({estimator.zone_name}) | Area: {estimator.zone_area_sqm} m²")
    print(f" Video Source: {args.video} | Detector: {args.detector.upper()}")
    print("=" * 92)

    results: List[ZoneDensityEstimate] = []
    first = True
    start_wall_time = time.time()

    try:
        for estimate in estimator.process_video(max_duration_sec=args.max_duration):
            results.append(estimate)
            if not args.quiet:
                if first:
                    print_estimate_row(estimate, header=True)
                    first = False
                else:
                    print_estimate_row(estimate, header=False)

    except KeyboardInterrupt:
        print("\n[!] Processing interrupted by user.")
    except Exception as e:
        logger.error("Error during estimation: %s", e, exc_info=True)
        sys.exit(1)

    elapsed = time.time() - start_wall_time
    print("-" * 92)
    print(f" Summary: Emitted {len(results)} samples in {elapsed:.2f}s wall time.")

    if results:
        avg_density = sum(r.density_per_sqm for r in results) / len(results)
        max_density = max(r.density_per_sqm for r in results)
        avg_speed = sum(r.flow_speed_mps for r in results) / len(results)
        print(f" Avg Density: {avg_density:.2f} p/m² | Peak Density: {max_density:.2f} p/m² | Avg Speed: {avg_speed:.2f} m/s")

    # Optional output file (Privacy compliant: stores only numerical metrics)
    if args.output:
        out_data = [r.model_dump() for r in results]
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(out_data, f, indent=2)
        print(f" [✓] Numerical metrics saved to: {args.output}")

    print("=" * 92 + "\n")


if __name__ == "__main__":
    main()
