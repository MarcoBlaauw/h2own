#!/usr/bin/env bash
set -euo pipefail

pnpm build-storybook

pnpm exec http-server storybook-static --port 6006 --silent &
SERVER_PID=$!
cleanup() {
  if kill -0 "$SERVER_PID" >/dev/null 2>&1; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

# Wait for the static server to be ready before running the test runner
pnpm exec wait-on http://127.0.0.1:6006

pnpm exec test-storybook --ci --url http://127.0.0.1:6006
