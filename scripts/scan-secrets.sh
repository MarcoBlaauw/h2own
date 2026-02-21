#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if command -v gitleaks >/dev/null 2>&1; then
  exec gitleaks detect --source . --config .gitleaks.toml --redact --verbose
fi

if command -v docker >/dev/null 2>&1; then
  exec docker run --rm -v "$ROOT_DIR:/repo" -w /repo zricethezav/gitleaks:latest \
    detect --source . --config .gitleaks.toml --redact --verbose
fi

echo "gitleaks not found (and Docker unavailable). Install gitleaks or Docker to run secret scanning." >&2
exit 1
