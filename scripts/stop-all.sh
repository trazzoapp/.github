#!/usr/bin/env bash
# Stop the processes started by scripts/dev-all.sh.
set -euo pipefail

pkill -f "tsx watch src/server.ts" 2>/dev/null || true
pkill -f "tsx watch src/worker.ts" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true
pkill -f "expo start" 2>/dev/null || true
if [ -f /tmp/trazzo-dashboard.pid ]; then
  kill "$(cat /tmp/trazzo-dashboard.pid)" 2>/dev/null || true
  rm -f /tmp/trazzo-dashboard.pid
fi
pkill -f "scripts/dashboard-server.mjs" 2>/dev/null || true
echo "Stopped trazzo API, worker, Next apps, Expo, and the dashboard."
