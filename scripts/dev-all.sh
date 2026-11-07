#!/usr/bin/env bash
# Link local @trazzoapp/* packages, then open one console per process so
# logs stay readable. Each app gets its own Terminal (or iTerm) window.
# Close those windows to stop, or run ./scripts/stop-all.sh.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [ "${SKIP_LINK:-}" = "1" ]; then
  echo "==> Skipping link (SKIP_LINK=1)"
else
  "$ROOT/scripts/link-packages.sh"
fi

SERVICES=(
  "trazzo-api|pnpm -C trazzo-api dev"
  "trazzo-worker|pnpm -C trazzo-api dev:worker"
  "trazzo-landing|pnpm -C trazzo-landing dev"
  "trazzo-webapp|pnpm -C trazzo-webapp dev"
  "trazzo-clients|pnpm -C trazzo-clients dev"
  "trazzo-marketplace|pnpm -C trazzo-marketplace dev"
  "trazzo-admin|pnpm -C trazzo-admin dev"
  "trazzo-app|pnpm -C trazzo-app start"
)

OPENER=(open)
if [ -d "/Applications/iTerm.app" ] || [ -d "$HOME/Applications/iTerm.app" ]; then
  OPENER=(open -a iTerm)
fi

rundir="${TMPDIR:-/tmp}/trazzo-dev-consoles"
mkdir -p "$rundir"

echo
echo "==> Opening one console per app"
for entry in "${SERVICES[@]}"; do
  name="${entry%%|*}"
  cmd="${entry#*|}"
  file="$rundir/${name}.command"
  cat >"$file" <<EOF
#!/bin/bash
cd $(printf %q "$ROOT")
printf '\\033]0;%s\\007' $(printf %q "$name")
echo "==> $name"
exec $cmd
EOF
  chmod +x "$file"
  "${OPENER[@]}" "$file"
done

echo
echo "==> Dashboard"
if lsof -nP -iTCP:3999 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "  already running on http://127.0.0.1:3999"
else
  node "$ROOT/scripts/dashboard-server.mjs" >/tmp/trazzo-dashboard.log 2>&1 &
  echo $! >/tmp/trazzo-dashboard.pid
  sleep 0.4
fi
open "http://127.0.0.1:3999"

echo
echo "Linked. Consoles + dashboard:"
echo "  dashboard    http://127.0.0.1:3999"
echo "  landing      http://localhost:3000"
echo "  api          http://localhost:3001"
echo "  webapp       http://localhost:3002"
echo "  clients      http://localhost:3003"
echo "  marketplace  http://localhost:3004"
echo "  admin        http://localhost:3005"
echo "  app          Expo  http://localhost:8081"
echo
echo "Close app windows to stop them, or run ./scripts/stop-all.sh"
