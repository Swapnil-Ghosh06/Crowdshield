"""
conftest.py — pytest configuration for risk-engine.

Adds the risk-engine directory to sys.path so that absolute imports
(from config import ..., from risk_engine import ...) work correctly
when running pytest from any working directory.
"""
import sys
import os

# Insert the risk-engine directory at the front of sys.path
RISK_ENGINE_DIR = os.path.dirname(os.path.abspath(__file__))
if RISK_ENGINE_DIR not in sys.path:
    sys.path.insert(0, RISK_ENGINE_DIR)
