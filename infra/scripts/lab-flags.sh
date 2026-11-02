#!/usr/bin/env bash
# Writes one <slug>.env per lab into <out-dir>, for the lab-runner (phase 011).
# Source per lab: labs/<slug>/flags.env when present (local override), otherwise
# labs/<slug>/flags.env.example. The runner never falls back on its own: a lab
# without a file here stays "unavailable".
#
# Usage (from the repo root):
#   bash infra/scripts/lab-flags.sh infra/stacks/prod/lab-flags
#   bash infra/scripts/lab-flags.sh infra/stacks/dev/lab-flags
set -euo pipefail

out="${1:?usage: lab-flags.sh <out-dir>}"
root="$(cd "$(dirname "$0")/../.." && pwd)"
mkdir -p "$out"

count=0
for dir in "$root"/labs/*/; do
  slug="$(basename "$dir")"
  [[ "$slug" == _* ]] && continue
  [[ -f "$dir/compose.yaml" ]] || continue
  src="$dir/flags.env"
  [[ -f "$src" ]] || src="$dir/flags.env.example"
  if [[ ! -f "$src" ]]; then
    echo "skip $slug: no flags file" >&2
    continue
  fi
  cp "$src" "$out/$slug.env"
  chmod 600 "$out/$slug.env" 2>/dev/null || true
  count=$((count + 1))
done
echo "lab flags: $count file(s) in $out"
