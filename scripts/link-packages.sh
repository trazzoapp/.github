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
# Undo with ./scripts/unlink-packages.sh — plain `pnpm install` in a single
# consumer also works, since that re-resolves straight from the registry.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PACKAGES_DIR="$ROOT/trazzo-packages"
ALL_CONSUMERS=(trazzo-api trazzo-app trazzo-clients trazzo-landing trazzo-webapp)

if [ "$#" -gt 0 ]; then
  CONSUMERS=("$@")
else
  CONSUMERS=("${ALL_CONSUMERS[@]}")
fi

echo "==> Building trazzo-packages (link targets need up-to-date dist/)"
(cd "$PACKAGES_DIR" && pnpm build)

echo "==> Registering global pnpm links for every publishable package"
for pkg_dir in "$PACKAGES_DIR"/*/; do
  pkg_dir="${pkg_dir%/}"
  [ -f "$pkg_dir/package.json" ] || continue
  is_private=$(jq -r '.private // false' "$pkg_dir/package.json")
  [ "$is_private" = "true" ] && continue
  name=$(jq -r '.name' "$pkg_dir/package.json")
  echo "  - $name ($pkg_dir)"
  (cd "$pkg_dir" && pnpm link --global >/dev/null)
done

echo "==> Linking into consumers"
for consumer in "${CONSUMERS[@]}"; do
  consumer_dir="$ROOT/$consumer"
  pkg_json="$consumer_dir/package.json"
  if [ ! -f "$pkg_json" ]; then
    echo "  ! skipping $consumer (no package.json found at $pkg_json)"
    continue
  fi
  deps=$(jq -r '(.dependencies // {}) * (.devDependencies // {}) | keys[] | select(startswith("@trazzoapp/"))' "$pkg_json")
  if [ -z "$deps" ]; then
    echo "  - $consumer: no @trazzoapp/* dependencies, skipping"
    continue
  fi
  echo "  - $consumer:"
  for dep in $deps; do
    echo "      linking $dep"
    (cd "$consumer_dir" && pnpm link --global "$dep" >/dev/null)
  done
done

echo "==> Done. Each consumer now resolves @trazzoapp/* from your local trazzo-packages checkout."
echo "    Re-run 'pnpm build' in trazzo-packages (or 'pnpm dev' in the specific package) after edits."
echo "    Run ./scripts/unlink-packages.sh when you're done to go back to the published versions."
