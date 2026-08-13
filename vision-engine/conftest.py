"""
conftest.py — pytest configuration for vision-engine.

Adds the vision-engine directory to sys.path so that absolute imports
(from density_estimator import ..., from detectors import ...) work correctly
when running pytest from any working directory.
"""
import sys
import os

# Insert the vision-engine directory at the front of sys.path
VISION_ENGINE_DIR = os.path.dirname(os.path.abspath(__file__))
if VISION_ENGINE_DIR not in sys.path:
    sys.path.insert(0, VISION_ENGINE_DIR)
