"""
CrowdShield — Optical Flow & Crowd Motion Tracker
-------------------------------------------------
Calculates crowd movement velocity (metres per second) and aggregate movement direction
using OpenCV optical flow analysis.

Key Capabilities:
    1. Lucas-Kanade Sparse Feature Flow (`cv2.calcOpticalFlowPyrLK`) / Shi-Tomasi Corners:
       Tracks key feature points across consecutive sampled frames to compute precise
       motion displacement vectors.
    2. Physical Unit Calibration:
       Converts raw pixel displacements into physical velocity (metres/second) based on a
       calibrated `pixels_per_meter` spatial ratio and $\\Delta t$ temporal sampling interval.
    3. Directional Classification:
       Categorizes aggregate crowd dynamics into:
         - `towards_exit`: Coherent crowd stream moving toward the designated egress.
         - `away_from_exit`: Coherent crowd counter-flow moving inward/away from exit.
         - `stationary`: Crowd velocity below threshold (standing, stalled, or gridlocked).
         - `mixed`: Turbulent, multi-directional, or conflicting crowd movement.

Privacy Guarantee:
    Optical flow is computed strictly in-memory. Intermediate frame arrays are released
    immediately after vector calculation.
"""

from __future__ import annotations

import logging
import math
from typing import List, Optional, Tuple, Union
import cv2
import numpy as np

from models import FlowDirection

logger = logging.getLogger(__name__)


# Direction lookup helpers mapping common strings to unit reference vectors (dx, dy)
DIRECTION_VECTORS: dict[str, tuple[float, float]] = {
    "down": (0.0, 1.0),
    "south": (0.0, 1.0),
    "up": (0.0, -1.0),
    "north": (0.0, -1.0),
    "right": (1.0, 0.0),
    "east": (1.0, 0.0),
    "left": (-1.0, 0.0),
    "west": (-1.0, 0.0),
}


class CrowdFlowTracker:
    """Estimates crowd flow velocity (m/s) and directional orientation from video frames.

    Attributes:
        pixels_per_meter: Spatial calibration scale ratio (pixels / meter).
        exit_direction: Designated exit orientation ('down', 'up', 'left', 'right', or custom angle).
        stationary_threshold_mps: Minimum speed threshold below which flow is classified as stationary.
        mixed_coherence_threshold: Circular variance threshold above which flow is marked as mixed.
        max_corners: Maximum number of Shi-Tomasi feature points to track per frame.
    """

    def __init__(
        self,
        pixels_per_meter: float = 30.0,
        exit_direction: Union[str, float, Tuple[float, float]] = "down",
        stationary_threshold_mps: float = 0.08,
        mixed_coherence_threshold: float = 0.65,
        max_corners: int = 200,
    ) -> None:
        """Initializes the crowd flow tracker.

        Args:
            pixels_per_meter: Number of camera pixels representing one real-world metre.
            exit_direction: Target exit direction ('down', 'up', 'left', 'right', or (dx, dy) tuple).
            stationary_threshold_mps: Speed in m/s below which the crowd is considered stationary.
            mixed_coherence_threshold: Angular dispersion threshold above which motion is marked mixed.
            max_corners: Maximum number of feature points to detect for optical flow.

        Why this exists:
            Configures spatial-temporal calibration parameters for converting pixel motions to
            physical crowd speed metrics and directional risk indicators.
        """
        self.pixels_per_meter = max(0.1, pixels_per_meter)
        self.stationary_threshold_mps = max(0.0, stationary_threshold_mps)
        self.mixed_coherence_threshold = mixed_coherence_threshold
        self.max_corners = max_corners

        # Resolve reference exit unit vector (ex, ey)
        self._exit_unit_vector = self._resolve_exit_vector(exit_direction)

        # Previous frame state for optical flow (transient in-memory grayscale)
        self._prev_gray: Optional[np.ndarray] = None
        self._prev_time_sec: Optional[float] = None

    def _resolve_exit_vector(
        self,
        exit_dir: Union[str, float, Tuple[float, float]],
    ) -> Tuple[float, float]:
        """Parses exit direction into a normalized 2D unit vector (dx, dy).

        Args:
            exit_dir: String name, angle in degrees, or vector tuple.

        Returns:
            Normalized tuple (dx, dy) in image coordinate space (x right, y down).

        Why this exists:
            Standardizes exit vector representations for directional alignment calculations.
        """
        if isinstance(exit_dir, tuple) and len(exit_dir) == 2:
            dx, dy = float(exit_dir[0]), float(exit_dir[1])
            norm = math.hypot(dx, dy)
            return (dx / norm, dy / norm) if norm > 1e-6 else (0.0, 1.0)

        if isinstance(exit_dir, (int, float)):
            # Angle in degrees (0 = right, 90 = down in image coords)
            rad = math.radians(float(exit_dir))
            return (math.cos(rad), math.sin(rad))

        if isinstance(exit_dir, str):
            key = exit_dir.strip().lower()
            if key in DIRECTION_VECTORS:
                return DIRECTION_VECTORS[key]

        # Default fallback: moving downwards in the frame (typical CCTV entrance to exit)
        return (0.0, 1.0)

    def reset(self) -> None:
        """Resets the internal tracking history.

        Why this exists:
            Clears cached previous frame buffers when switching video files or resetting streams.
        """
        self._prev_gray = None
        self._prev_time_sec = None

    def calculate_flow(
        self,
        current_frame: np.ndarray,
        current_time_sec: float,
        roi: Optional[Tuple[int, int, int, int]] = None,
    ) -> Tuple[float, Optional[FlowDirection], Optional[List[float]]]:
        """Computes optical flow velocity (m/s) and movement direction against the previous frame.

        Args:
            current_frame: Current video frame (BGR or grayscale).
            current_time_sec: Playback timestamp in seconds of the current frame.
            roi: Optional region of interest (x, y, w, h) to restrict optical flow calculation.

        Returns:
            Tuple of:
                - flow_speed_mps: Float average crowd speed in metres per second.
                - flow_direction: Optional `FlowDirection` enum value.
                - raw_motion_vector: Optional list [vx_px_per_sec, vy_px_per_sec].

        Why this exists:
            Performs the core differential motion estimation across time intervals.
        """
        if current_frame is None or current_frame.size == 0:
            return 0.0, FlowDirection.STATIONARY, [0.0, 0.0]

        # Convert frame to grayscale
        if len(current_frame.shape) == 3 and current_frame.shape[2] == 3:
            curr_gray = cv2.cvtColor(current_frame, cv2.COLOR_BGR2GRAY)
        else:
            curr_gray = current_frame.copy()

        # Apply ROI crop if supplied
        if roi is not None:
            rx, ry, rw, rh = roi
            h_max, w_max = curr_gray.shape[:2]
            rx = max(0, min(rx, w_max - 1))
            ry = max(0, min(ry, h_max - 1))
            rw = max(1, min(rw, w_max - rx))
            rh = max(1, min(rh, h_max - ry))
            curr_gray = curr_gray[ry : ry + rh, rx : rx + rw]

        # If this is the first frame, store and return baseline stationary
        if self._prev_gray is None or self._prev_time_sec is None:
            self._prev_gray = curr_gray
            self._prev_time_sec = current_time_sec
            return 0.0, FlowDirection.STATIONARY, [0.0, 0.0]

        # Ensure spatial shapes match
        if self._prev_gray.shape != curr_gray.shape:
            self._prev_gray = curr_gray
            self._prev_time_sec = current_time_sec
            return 0.0, FlowDirection.STATIONARY, [0.0, 0.0]

        dt = current_time_sec - self._prev_time_sec
        if dt <= 0.0:
            dt = 1.0 / 30.0  # Fallback to standard frame delta if non-positive

        # Compute optical flow displacements
        displacements = self._compute_sparse_lk_flow(self._prev_gray, curr_gray)

        # Update cached previous frame
        self._prev_gray = curr_gray
        self._prev_time_sec = current_time_sec

        if not displacements:
            return 0.0, FlowDirection.STATIONARY, [0.0, 0.0]

        # Calculate average displacement per second in pixel space
        displacements_arr = np.array(displacements, dtype=np.float32)  # Shape (N, 2) [dx, dy]
        mean_dx = float(np.mean(displacements_arr[:, 0]))
        mean_dy = float(np.mean(displacements_arr[:, 1]))

        # Velocity in pixels per second
        vx_px_per_sec = mean_dx / dt
        vy_px_per_sec = mean_dy / dt
        speed_px_per_sec = math.hypot(vx_px_per_sec, vy_px_per_sec)

        # Convert to metres per second
        flow_speed_mps = round(speed_px_per_sec / self.pixels_per_meter, 3)

        # Classify crowd flow direction
        direction = self._classify_direction(
            displacements_arr=displacements_arr,
            mean_vector=(mean_dx, mean_dy),
            speed_mps=flow_speed_mps,
        )

        raw_vector = [round(vx_px_per_sec, 2), round(vy_px_per_sec, 2)]
        return flow_speed_mps, direction, raw_vector

    def _compute_sparse_lk_flow(
        self,
        prev_gray: np.ndarray,
        curr_gray: np.ndarray,
    ) -> List[Tuple[float, float]]:
        """Tracks feature points between two frames using Lucas-Kanade optical flow.

        Args:
            prev_gray: Grayscale image of previous frame.
            curr_gray: Grayscale image of current frame.

        Returns:
            List of (dx, dy) displacement vectors in pixel units.

        Why this exists:
            Fast, robust motion vector calculation focused on high-contrast crowd features.
        """
        # Detect Good Features To Track in the previous frame
        corners = cv2.goodFeaturesToTrack(
            prev_gray,
            maxCorners=self.max_corners,
            qualityLevel=0.01,
            minDistance=7,
            blockSize=7,
        )

        if corners is None or len(corners) == 0:
            # Fallback to dense Farneback flow if no sparse corners detected
            return self._compute_dense_farneback_flow(prev_gray, curr_gray)

        # Calculate Lucas-Kanade optical flow
        p1, st, err = cv2.calcOpticalFlowPyrLK(
            prev_gray,
            curr_gray,
            corners,
            None,
            winSize=(15, 15),
            maxLevel=2,
            criteria=(cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 10, 0.03),
        )

        if p1 is None or st is None:
            return []

        # Filter valid tracked points
        good_old = corners[st == 1]
        good_new = p1[st == 1]

        if len(good_new) == 0:
            return []

        displacements = good_new - good_old  # Shape (N, 2) [dx, dy]
        return [(float(d[0]), float(d[1])) for d in displacements]

    def _compute_dense_farneback_flow(
        self,
        prev_gray: np.ndarray,
        curr_gray: np.ndarray,
    ) -> List[Tuple[float, float]]:
        """Calculates dense optical flow using Gunnar Farneback's algorithm.

        Args:
            prev_gray: Previous grayscale frame.
            curr_gray: Current grayscale frame.

        Returns:
            Subsampled list of (dx, dy) flow displacement vectors.

        Why this exists:
            Provides a resilient fallback when high-contrast corner points are sparse.
        """
        try:
            flow = cv2.calcOpticalFlowFarneback(
                prev_gray,
                curr_gray,
                None,
                pyr_scale=0.5,
                levels=2,
                winsize=13,
                iterations=2,
                poly_n=5,
                poly_sigma=1.1,
                flags=0,
            )
            # Subsample flow grid every 16 pixels to maintain performance
            step = 16
            sampled = flow[::step, ::step].reshape(-1, 2)
            return [(float(d[0]), float(d[1])) for d in sampled]
        except Exception as e:
            logger.debug("Dense optical flow calculation encountered error: %s", e)
            return []

    def _classify_direction(
        self,
        displacements_arr: np.ndarray,
        mean_vector: Tuple[float, float],
        speed_mps: float,
    ) -> FlowDirection:
        """Classifies aggregate motion into directional categories.

        Args:
            displacements_arr: Array of (dx, dy) displacement vectors of shape (N, 2).
            mean_vector: Tuple of (mean_dx, mean_dy).
            speed_mps: Aggregate speed in metres per second.

        Returns:
            `FlowDirection` enum value.

        Why this exists:
            Translates raw 2D displacement vectors into high-level crowd safety semantics.
        """
        if speed_mps < self.stationary_threshold_mps:
            return FlowDirection.STATIONARY

        if len(displacements_arr) == 0:
            return FlowDirection.STATIONARY

        # Check motion coherence (measure circular variance of vector angles)
        angles = np.arctan2(displacements_arr[:, 1], displacements_arr[:, 0])
        # Circular mean resultant length R = hypot(sum(cos), sum(sin)) / N
        cos_sum = np.sum(np.cos(angles))
        sin_sum = np.sum(np.sin(angles))
        r_length = math.hypot(cos_sum, sin_sum) / len(angles)

        # Circular variance = 1 - R (0 = completely aligned, 1 = completely scattered)
        circ_var = 1.0 - r_length

        if circ_var > self.mixed_coherence_threshold:
            return FlowDirection.MIXED

        # Alignment with target exit unit vector
        mean_norm = math.hypot(mean_vector[0], mean_vector[1])
        if mean_norm < 1e-5:
            return FlowDirection.STATIONARY

        norm_mean_x = mean_vector[0] / mean_norm
        norm_mean_y = mean_vector[1] / mean_norm

        ex, ey = self._exit_unit_vector
        dot_product = norm_mean_x * ex + norm_mean_y * ey

        if dot_product > 0.35:
            return FlowDirection.TOWARDS_EXIT
        elif dot_product < -0.35:
            return FlowDirection.AWAY_FROM_EXIT
        else:
            return FlowDirection.MIXED
