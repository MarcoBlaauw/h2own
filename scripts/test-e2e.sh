#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/docker-compose.yaml}"
PROJECT_NAME="${COMPOSE_PROJECT_NAME:-h2own-e2e}"
API_PORT="${API_PORT:-3001}"
POSTGRES_USER="${POSTGRES_USER:-h2own}"
POSTGRES_DB="${POSTGRES_DB:-h2own}"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required for test:e2e but was not found in PATH." >&2
  exit 1
fi

cleanup() {
  docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" down -v || true
}
trap cleanup EXIT

# Ensure services are rebuilt with the latest sources
docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" up -d --build postgres redis api

echo "Waiting for Postgres to be ready..."
for _ in $(seq 1 30); do
  if docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" exec -T postgres pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; then
    break
  fi
  sleep 2

done

if ! docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" exec -T postgres pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; then
  echo "Postgres did not become ready in time" >&2
  exit 1
fi

echo "Waiting for API to respond..."
for _ in $(seq 1 60); do
  if curl -fsS "http://localhost:${API_PORT}/healthz" >/dev/null 2>&1; then
    break
  fi
  sleep 2

done

if ! curl -fsS "http://localhost:${API_PORT}/healthz" >/dev/null 2>&1; then
  echo "API did not become ready in time" >&2
  exit 1
fi

echo "Seeding database via API container..."
docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" exec -T api pnpm seed

echo "Running smoke tests..."
API_BASE="http://localhost:${API_PORT}" "$ROOT_DIR/scripts/e2e-pools.sh"

echo "E2E smoke tests completed successfully."
