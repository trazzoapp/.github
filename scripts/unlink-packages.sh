#!/usr/bin/env bash
# Undo link-packages.sh: removes the `link:../trazzo-packages/<pkg>`
# overrides that script wrote into each consumer's `pnpm-workspace.yaml`,
# then reinstalls so @trazzoapp/* resolves from the published registry
# version again instead of your local checkout.
#
# Usage:
#   ./scripts/unlink-packages.sh                       # unlink every consumer
#   ./scripts/unlink-packages.sh trazzo-webapp          # unlink just one
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ALL_CONSUMERS=(trazzo-api trazzo-app trazzo-admin trazzo-clients trazzo-landing trazzo-marketplace trazzo-webapp)

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

  workspace_yaml="$consumer_dir/pnpm-workspace.yaml"
  if [ -f "$workspace_yaml" ] && grep -q '^overrides:' "$workspace_yaml"; then
    echo "==> Removing local overrides from $consumer/pnpm-workspace.yaml"
    node -e '
      const fs = require("fs");
      const path = process.argv[1];
      const lines = fs.readFileSync(path, "utf8").split("\n");
      const out = [];
      let inOverrides = false;
      for (const line of lines) {
        if (/^overrides:\s*$/.test(line)) {
          inOverrides = true;
          continue;
        }
        if (inOverrides) {
          if (/^\s+\S/.test(line) || line.trim() === "") continue;
          inOverrides = false;
        }
        out.push(line);
      }
      while (out.length && out[out.length - 1].trim() === "") out.pop();
      fs.writeFileSync(path, out.join("\n") + "\n");
    ' "$workspace_yaml"
  fi

  echo "==> Reinstalling $consumer from the registry"
  (cd "$consumer_dir" && pnpm install)
done

echo "==> Done. Every consumer is back on its published @trazzoapp/* version."
