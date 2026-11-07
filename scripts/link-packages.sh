#!/usr/bin/env bash
# Link local trazzo-packages into one or more consuming repos, bypassing the
# published @trazzoapp/* registry versions entirely. Lets you edit a shared
# package and see the change in a consumer instantly (after a rebuild), with
# no publish/version-bump/deploy step.
#
# Usage:
#   ./scripts/link-packages.sh                       # link into every consumer
#   ./scripts/link-packages.sh trazzo-webapp          # link into just one
#   ./scripts/link-packages.sh trazzo-webapp trazzo-app
#
# Undo with ./scripts/unlink-packages.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PACKAGES_DIR="$ROOT/trazzo-packages"
ALL_CONSUMERS=(trazzo-api trazzo-app trazzo-admin trazzo-clients trazzo-landing trazzo-marketplace trazzo-webapp)

if [ "$#" -gt 0 ]; then
  CONSUMERS=("$@")
else
  CONSUMERS=("${ALL_CONSUMERS[@]}")
fi

echo "==> Building trazzo-packages (skipping storybook; link targets need dist/)"
(cd "$PACKAGES_DIR" && pnpm --filter @trazzoapp/core --filter @trazzoapp/logger --filter @trazzoapp/api-client --filter @trazzoapp/mock-api --filter @trazzoapp/ui --filter @trazzoapp/icons run build)

# Direct `pnpm link <path>` (not `pnpm link --global`). The global route
# re-registers every package on every run and then collides with its own
# prior symlink ("Symlink path is the same as the target path").
#
# Path links persist as `link:` entries under the consumer's
# `pnpm-workspace.yaml` `overrides:` block, so they survive a lockfile swap.
# That's also why `pnpm unlink` is a no-op against them — use unlink-packages.sh.
echo "==> Linking into consumers"
for consumer in "${CONSUMERS[@]}"; do
  consumer_dir="$ROOT/$consumer"
  pkg_json="$consumer_dir/package.json"
  if [ ! -f "$pkg_json" ]; then
    echo "  ! skipping $consumer (no package.json found at $pkg_json)"
    continue
  fi

  echo "  - $consumer:"
  linked=0
  while IFS= read -r dep; do
    [ -z "$dep" ] && continue
    pkg_name="${dep#@trazzoapp/}"
    pkg_dir="$PACKAGES_DIR/$pkg_name"
    if [ ! -d "$pkg_dir" ]; then
      echo "      ! skipping $dep (no directory at $pkg_dir)"
      continue
    fi
    echo "      linking $dep"
    (cd "$consumer_dir" && pnpm link "$pkg_dir" >/dev/null)
    linked=1
  done < <(jq -r '(.dependencies // {}) * (.devDependencies // {}) | keys[] | select(startswith("@trazzoapp/"))' "$pkg_json")

  if [ "$linked" -eq 0 ]; then
    echo "      no @trazzoapp/* dependencies, skipping"
  fi
done

echo "==> Done. Each consumer now resolves @trazzoapp/* from your local trazzo-packages checkout."
echo "    Re-run 'pnpm build' in trazzo-packages (or 'pnpm dev' in the specific package) after edits."
echo "    Run ./scripts/unlink-packages.sh when you're done to go back to the published versions."
