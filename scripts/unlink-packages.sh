#!/usr/bin/env bash
# Undo link-packages.sh: reinstalls every consumer so @trazzoapp/* resolves
# from the published registry version again instead of your local checkout.
#
# Usage:
#   ./scripts/unlink-packages.sh                       # unlink every consumer
#   ./scripts/unlink-packages.sh trazzo-webapp          # unlink just one
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ALL_CONSUMERS=(trazzo-api trazzo-app trazzo-clients trazzo-landing trazzo-webapp)

if [ "$#" -gt 0 ]; then
  CONSUMERS=("$@")
else
  CONSUMERS=("${ALL_CONSUMERS[@]}")
fi

for consumer in "${CONSUMERS[@]}"; do
  consumer_dir="$ROOT/$consumer"
  if [ ! -f "$consumer_dir/package.json" ]; then
    echo "  ! skipping $consumer (no package.json found)"
    continue
  fi
  echo "==> Reinstalling $consumer from the registry"
  (cd "$consumer_dir" && pnpm install)
done

echo "==> Done. Every consumer is back on its published @trazzoapp/* version."
