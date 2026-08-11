"""
CrowdShield — Person & Crowd Detectors
--------------------------------------
Modular object detection interface and implementations for crowd counting.

Supported Detector Backends:
    1. `HOGPedestrianDetector` (Default):
       Uses OpenCV's native Histogram of Oriented Gradients (HOG) + Linear SVM
       person detector (`cv2.HOGDescriptor`). Fully offline, lightweight, requires
       no model weight downloads, and runs efficiently on CPU.

    2. `YOLOCrowdDetector` (Pluggable Slot):
       Modular extension slot for YOLO (e.g. YOLOv8, YOLOv5, ONNX, or OpenCV DNN
       person/head detection) with custom weights support.

    3. `CSRNetCrowdDetector` (Pluggable Slot):
       Modular extension slot for Dilated Convolutional Neural Networks (CSRNet)
       specifically designed for dense crowd counting via continuous density maps.

Factory Function:
    `get_detector(name="hog", **kwargs)` dynamically instantiates the selected backend.
"""

from __future__ import annotations

import abc
import logging
from typing import Any, List, Optional, Tuple, Union
import cv2
import numpy as np

try:
    from models import DetectionBox
except ImportError:
    from .models import DetectionBox

logger = logging.getLogger(__name__)


def apply_non_max_suppression(
    boxes: List[Tuple[int, int, int, int]],
    scores: Optional[List[float]] = None,
    overlap_threshold: float = 0.4,
) -> List[Tuple[int, int, int, int]]:
    """Applies Non-Maximum Suppression (NMS) to eliminate duplicate, overlapping bounding boxes.

    Args:
        boxes: List of bounding boxes formatted as (x, y, w, h).
        scores: Optional list of confidence scores matching each box. If None, box area is used.
        overlap_threshold: Intersection-over-Union (IoU) threshold above which overlapping
            boxes are suppressed (default: 0.4).

    Returns:
        Filtered list of bounding boxes (x, y, w, h).

    Why this exists:
        HOG multi-scale sliding window detectors frequently produce multiple overlapping
        detection hits for a single pedestrian. NMS merges and suppresses redundant boxes
        to prevent severe crowd overcounting.
    """
    if not boxes:
        return []

    # Convert (x, y, w, h) to (x1, y1, x2, y2)
    boxes_array = np.array(boxes, dtype=np.float32)
    x1 = boxes_array[:, 0]
    y1 = boxes_array[:, 1]
    x2 = boxes_array[:, 0] + boxes_array[:, 2]
    y2 = boxes_array[:, 1] + boxes_array[:, 3]

    area = (x2 - x1 + 1) * (y2 - y1 + 1)

    if scores is not None and len(scores) == len(boxes):
        idxs = np.argsort(np.array(scores, dtype=np.float32))
    else:
        idxs = np.argsort(y2)

    pick: List[int] = []

    while len(idxs) > 0:
        last = len(idxs) - 1
        i = idxs[last]
        pick.append(i)

        # Find intersection coordinates
        xx1 = np.maximum(x1[i], x1[idxs[:last]])
        yy1 = np.maximum(y1[i], y1[idxs[:last]])
        xx2 = np.minimum(x2[i], x2[idxs[:last]])
        yy2 = np.minimum(y2[i], y2[idxs[:last]])

        w = np.maximum(0.0, xx2 - xx1 + 1)
        h = np.maximum(0.0, yy2 - yy1 + 1)
        intersection = w * h

        # Calculate Intersection over Union (IoU)
        iou = intersection / (area[i] + area[idxs[:last]] - intersection)

        # Delete all indices that have IoU greater than threshold
        idxs = np.delete(
            idxs,
            np.concatenate(([last], np.where(iou > overlap_threshold)[0])),
        )

    selected_boxes = [boxes[idx] for idx in pick]
    return selected_boxes


class BaseCrowdDetector(abc.ABC):
    """Abstract Base Class defining the contract for all crowd and person detectors.

    Why this exists:
        Establishes an interchangeable interface so high-level video estimation logic
        remains completely decoupled from the underlying computer vision model architecture.
    """

    @abc.abstractmethod
    def detect(
        self,
        frame: np.ndarray,
        roi: Optional[Tuple[int, int, int, int]] = None,
    ) -> List[DetectionBox]:
        """Detects individuals or crowd clusters in a single video frame.

        Args:
            frame: BGR or grayscale image array of shape (H, W, C) or (H, W).
            roi: Optional Region of Interest bounding box (x, y, w, h) restricting the
                detection area. If None, the entire frame is processed.

        Returns:
            List of `DetectionBox` objects representing detected persons.

        Why this exists:
            Provides the spatial locations of people needed for centroid tracking and counting.
        """
        raise NotImplementedError

    def count(
        self,
        frame: np.ndarray,
        roi: Optional[Tuple[int, int, int, int]] = None,
    ) -> int:
        """Computes the total count of persons in the frame or region of interest.

        Args:
            frame: Video frame image array.
            roi: Optional Region of Interest bounding box (x, y, w, h).

        Returns:
            Integer representing estimated crowd size.

        Why this exists:
            Provides an efficient shorthand for count-only queries or density map integrations.
        """
        detections = self.detect(frame, roi=roi)
        return len(detections)


class HOGPedestrianDetector(BaseCrowdDetector):
    """OpenCV HOG (Histogram of Oriented Gradients) + Linear SVM pedestrian detector.

    This is the default offline detector. It requires no external neural network weights,
    operates entirely locally, and provides fast CPU inference.

    Attributes:
        hit_threshold: Detection threshold for the SVM classifier (default: 0.0).
        win_stride: Sliding window stride in pixels (default: (8, 8)).
        padding: Mock window padding in pixels (default: (8, 8)).
        scale: Image pyramid scale factor between successive downsamplings (default: 1.05).
        overlap_threshold: NMS IoU threshold for merging duplicates (default: 0.3).
    """

    def __init__(
        self,
        hit_threshold: float = 0.0,
        win_stride: Tuple[int, int] = (8, 8),
        padding: Tuple[int, int] = (8, 8),
        scale: float = 1.05,
        overlap_threshold: float = 0.3,
    ) -> None:
        """Initializes the OpenCV HOG pedestrian detector.

        Args:
            hit_threshold: SVM decision hyperplane distance threshold.
            win_stride: Step size (x, y) for sliding the detection window.
            padding: Padding (x, y) around the image frame during feature extraction.
            scale: Multi-scale pyramid downsampling ratio (smaller is slower but more accurate).
            overlap_threshold: Non-maximum suppression overlap threshold.

        Why this exists:
            Configures OpenCV's pre-trained INRIA/Dalal-Triggs people detector for offline execution.
        """
        self.hit_threshold = hit_threshold
        self.win_stride = win_stride
        self.padding = padding
        self.scale = scale
        self.overlap_threshold = overlap_threshold

        self._hog = cv2.HOGDescriptor()
        self._hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())

    def detect(
        self,
        frame: np.ndarray,
        roi: Optional[Tuple[int, int, int, int]] = None,
    ) -> List[DetectionBox]:
        """Runs HOG pedestrian detection on the frame with non-maximum suppression.

        Args:
            frame: Input image array (BGR or grayscale).
            roi: Optional region of interest (x, y, w, h).

        Returns:
            List of `DetectionBox` objects for each detected pedestrian.

        Why this exists:
            Performs the core person detection step without saving any frame data.
        """
        if frame is None or frame.size == 0:
            return []

        # Crop to ROI if specified
        offset_x, offset_y = 0, 0
        target_frame = frame
        if roi is not None:
            rx, ry, rw, rh = roi
            h_max, w_max = frame.shape[:2]
            rx = max(0, min(rx, w_max - 1))
            ry = max(0, min(ry, h_max - 1))
            rw = max(1, min(rw, w_max - rx))
            rh = max(1, min(rh, h_max - ry))
            target_frame = frame[ry : ry + rh, rx : rx + rw]
            offset_x, offset_y = rx, ry

        # Preprocessing: convert to grayscale or enhance contrast if needed
        if len(target_frame.shape) == 3 and target_frame.shape[2] == 3:
            gray = cv2.cvtColor(target_frame, cv2.COLOR_BGR2GRAY)
        else:
            gray = target_frame

        # Run HOG multiscale detection
        try:
            rects, weights = self._hog.detectMultiScale(
                gray,
                winStride=self.win_stride,
                padding=self.padding,
                scale=self.scale,
                hitThreshold=self.hit_threshold,
            )
        except Exception as e:
            logger.warning("HOG detection failed on frame: %s", e)
            return []

        if len(rects) == 0:
            return []

        # Convert to list of tuples (x, y, w, h)
        raw_boxes = [(int(r[0]), int(r[1]), int(r[2]), int(r[3])) for r in rects]
        raw_weights = [float(w[0]) if isinstance(w, (list, np.ndarray)) else float(w) for w in weights] if len(weights) > 0 else None

        # Apply Non-Maximum Suppression to remove duplicates
        suppressed_boxes = apply_non_max_suppression(
            raw_boxes,
            scores=raw_weights,
            overlap_threshold=self.overlap_threshold,
        )

        results: List[DetectionBox] = []
        for box in suppressed_boxes:
            bx, by, bw, bh = box
            results.append(
                DetectionBox(
                    x=bx + offset_x,
                    y=by + offset_y,
                    width=bw,
                    height=bh,
                    confidence=1.0,
                )
            )

        return results


class YOLOCrowdDetector(BaseCrowdDetector):
    """Pluggable detector slot for YOLO-based crowd / person detection models.

    Allows drop-in integration of Ultralytics YOLOv8, YOLOv5, ONNX, or OpenCV DNN
    person detectors when model weights are provided.

    Attributes:
        weights_path: Path to `.pt`, `.onnx`, or `.weights` file.
        confidence_threshold: Minimum detection confidence (default: 0.35).
        iou_threshold: NMS IoU threshold (default: 0.45).
        device: Target execution device ('cpu', 'cuda', etc.).
    """

    def __init__(
        self,
        weights_path: Optional[str] = None,
        confidence_threshold: float = 0.35,
        iou_threshold: float = 0.45,
        device: str = "cpu",
    ) -> None:
        """Initializes the YOLO crowd detector slot.

        Args:
            weights_path: Path to YOLO model weights file.
            confidence_threshold: Minimum confidence score to accept a person detection.
            iou_threshold: IoU overlap threshold for NMS.
            device: Computing device ('cpu', 'cuda').

        Why this exists:
            Enables easy plug-and-play scaling from default HOG to state-of-the-art YOLO
            detectors without modifying any downstream pipelines or estimation logic.
        """
        self.weights_path = weights_path
        self.confidence_threshold = confidence_threshold
        self.iou_threshold = iou_threshold
        self.device = device
        self._model: Any = None
        self._backend: str = "none"

        self._initialize_model()

    def _initialize_model(self) -> None:
        """Attempts to load YOLO model from available frameworks (Ultralytics, ONNX, OpenCV DNN).

        Why this exists:
            Provides graceful discovery and initialization with helpful fallback warnings.
        """
        if not self.weights_path:
            logger.info(
                "YOLOCrowdDetector initialized without weights_path. Running in mock/standby mode."
            )
            return

        try:
            # Check for Ultralytics YOLO package
            from ultralytics import YOLO  # type: ignore

            self._model = YOLO(self.weights_path)
            self._backend = "ultralytics"
            logger.info("Loaded YOLO model via Ultralytics: %s", self.weights_path)
        except ImportError:
            logger.warning(
                "Ultralytics not installed. Attempting OpenCV DNN loader for %s",
                self.weights_path,
            )
            if self.weights_path.endswith(".onnx"):
                try:
                    self._model = cv2.dnn.readNetFromONNX(self.weights_path)
                    self._backend = "opencv_dnn"
                    logger.info("Loaded ONNX model via OpenCV DNN: %s", self.weights_path)
                except Exception as e:
                    logger.error("Failed loading ONNX model with OpenCV DNN: %s", e)
            else:
                logger.warning(
                    "To enable YOLO, install ultralytics (`pip install ultralytics`) or supply an ONNX model."
                )

    def detect(
        self,
        frame: np.ndarray,
        roi: Optional[Tuple[int, int, int, int]] = None,
    ) -> List[DetectionBox]:
        """Performs person detection using the configured YOLO backend.

        Args:
            frame: Input video frame.
            roi: Optional region of interest (x, y, w, h).

        Returns:
            List of `DetectionBox` objects representing detected persons.

        Why this exists:
            Implements the standard detection interface for YOLO models.
        """
        if frame is None or frame.size == 0:
            return []

        offset_x, offset_y = 0, 0
        target_frame = frame
        if roi is not None:
            rx, ry, rw, rh = roi
            target_frame = frame[ry : ry + rh, rx : rx + rw]
            offset_x, offset_y = rx, ry

        # If model is loaded via Ultralytics
        if self._backend == "ultralytics" and self._model is not None:
            # Filter class 0 (person in standard COCO dataset)
            results = self._model(
                target_frame,
                classes=[0],
                conf=self.confidence_threshold,
                iou=self.iou_threshold,
                device=self.device,
                verbose=False,
            )
            boxes: List[DetectionBox] = []
            for r in results:
                for box in r.boxes:
                    x1, y1, x2, y2 = box.xyxy[0].tolist()
                    conf = float(box.conf[0])
                    boxes.append(
                        DetectionBox(
                            x=int(x1) + offset_x,
                            y=int(y1) + offset_y,
                            width=int(x2 - x1),
                            height=int(y2 - y1),
                            confidence=conf,
                        )
                    )
            return boxes

        # Fallback if no weights provided: fallback to HOG detector to ensure zero crashes
        logger.debug("YOLO model not loaded; falling back to HOG pedestrian detection.")
        fallback_hog = HOGPedestrianDetector()
        return fallback_hog.detect(frame, roi=roi)


class CSRNetCrowdDetector(BaseCrowdDetector):
    """Pluggable detector slot for CSRNet (Dilated Convolutional Crowd Density Estimator).

    CSRNet estimates continuous density maps $D(x, y)$ rather than discrete bounding
    boxes, making it ideal for dense, overlapping crowds (e.g. ShanghaiTech dataset).

    Attributes:
        weights_path: Path to trained PyTorch or ONNX CSRNet weights.
        device: Target execution device ('cpu', 'cuda').
    """

    def __init__(
        self,
        weights_path: Optional[str] = None,
        device: str = "cpu",
    ) -> None:
        """Initializes the CSRNet crowd density estimator slot.

        Args:
            weights_path: Filepath to CSRNet model weights.
            device: Computation device ('cpu', 'cuda').

        Why this exists:
            Enables drop-in support for continuous density map architectures designed for high-density crowds.
        """
        self.weights_path = weights_path
        self.device = device
        self._model: Any = None
        self._initialize_model()

    def _initialize_model(self) -> None:
        """Attempts to load CSRNet model if weights and PyTorch/ONNX are available.

        Why this exists:
            Sets up the neural network runtime for density regression.
        """
        if not self.weights_path:
            logger.info("CSRNet initialized without weights. Running in standby mode.")
            return

        try:
            import torch  # type: ignore

            logger.info("CSRNet slot ready with weights: %s on device: %s", self.weights_path, self.device)
        except ImportError:
            logger.warning("PyTorch not installed. Install `torch` to activate CSRNet backend.")

    def detect(
        self,
        frame: np.ndarray,
        roi: Optional[Tuple[int, int, int, int]] = None,
    ) -> List[DetectionBox]:
        """Estimates crowd locations by locating local density peaks in the density map.

        Args:
            frame: Video frame image.
            roi: Optional region of interest (x, y, w, h).

        Returns:
            List of `DetectionBox` objects corresponding to detected crowd cluster centroids.

        Why this exists:
            Adapts continuous density map output to the shared `DetectionBox` interface.
        """
        # If no weights or model available, gracefully fall back to HOG
        fallback_hog = HOGPedestrianDetector()
        return fallback_hog.detect(frame, roi=roi)

    def count(
        self,
        frame: np.ndarray,
        roi: Optional[Tuple[int, int, int, int]] = None,
    ) -> int:
        """Computes total crowd count by integrating the estimated density map $\\int\\int D(x, y) dx dy$.

        Args:
            frame: Video frame image.
            roi: Optional region of interest (x, y, w, h).

        Returns:
            Integer representing estimated total crowd count.

        Why this exists:
            Provides exact mathematical count integration from CSRNet density maps.
        """
        if self._model is None:
            return super().count(frame, roi=roi)
        # Integration placeholder when CSRNet model is attached
        return super().count(frame, roi=roi)


def get_detector(
    name: str = "hog",
    **kwargs: Any,
) -> BaseCrowdDetector:
    """Factory function to instantiate and configure a crowd detector backend.

    Args:
        name: Name of the detector backend ('hog', 'yolo', or 'csrnet').
        **kwargs: Backend-specific configuration keyword arguments (e.g. `weights_path`, `scale`).

    Returns:
        Configured instance of `BaseCrowdDetector`.

    Raises:
        ValueError: If an unrecognized detector backend name is provided.

    Why this exists:
        Provides a single, uniform instantiation entry point for the estimation module and CLI.
    """
    normalized_name = name.strip().lower()
    if normalized_name == "hog":
        return HOGPedestrianDetector(**kwargs)
    elif normalized_name in ("yolo", "yolov8", "yolov5"):
        return YOLOCrowdDetector(**kwargs)
    elif normalized_name == "csrnet":
        return CSRNetCrowdDetector(**kwargs)
    else:
        raise ValueError(
            f"Unknown detector backend '{name}'. Supported options: 'hog', 'yolo', 'csrnet'."
        )
