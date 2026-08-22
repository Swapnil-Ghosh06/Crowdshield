#!/bin/bash
# CrowdShield — one-command startup script
# Usage: bash start.sh
# Starts both the pipeline (port 8000) and dashboard (port 3000)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV="$SCRIPT_DIR/venv"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║        CrowdShield — Startup             ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── 1. Pipeline ────────────────────────────────────────────────────────────────
echo "[1/2] Starting CrowdShield pipeline (port 8000)..."
cd "$SCRIPT_DIR/pipeline"

if [ ! -d "$VENV" ]; then
  echo "  Creating virtual environment..."
  python3 -m venv "$VENV"
fi

echo "  Installing pipeline dependencies..."
"$VENV/bin/pip" install -r requirements.txt -q

"$VENV/bin/uvicorn" main:app --host 0.0.0.0 --port 8000 &
PIPELINE_PID=$!
echo "  ✓ Pipeline running (PID $PIPELINE_PID)"
echo "    → HTTP:  http://localhost:8000"
echo "    → WS:    ws://localhost:8000/ws/risk-events"
echo "    → Health: curl http://localhost:8000/health"
echo ""

# Give pipeline a moment to boot
sleep 2

# ── 2. Dashboard ───────────────────────────────────────────────────────────────
echo "[2/2] Starting CrowdShield dashboard (port 3000)..."
cd "$SCRIPT_DIR/dashboard"

if [ ! -d "node_modules" ]; then
  echo "  Installing npm dependencies..."
  npm install -q
fi

npm run dev &
DASHBOARD_PID=$!
echo "  ✓ Dashboard running (PID $DASHBOARD_PID)"
echo "    → http://localhost:3000"
echo ""

echo "════════════════════════════════════════════"
echo "  Both services running. Press Ctrl+C to stop."
echo "════════════════════════════════════════════"
echo ""

# Wait for either process to exit
wait $PIPELINE_PID $DASHBOARD_PID
