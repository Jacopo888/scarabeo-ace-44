#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://localhost:8000}"
echo "[smoke] Using base URL: $BASE_URL"

fail() { echo "[smoke][FAIL] $1" >&2; exit 1; }

echo "[smoke] GET /health"
health_json=$(curl -fsS "$BASE_URL/health" || fail "health unreachable")
echo "$health_json" | grep -q '"engine_ready"' || fail "health missing engine_ready"

if command -v jq >/dev/null 2>&1; then
  engine_ready=$(echo "$health_json" | jq -r '.engine_ready')
else
  # Fallback grossolano (true/false presente nella stessa riga)
  echo "$health_json" | grep -q '"engine_ready": true' && engine_ready=true || engine_ready=false
fi

if [[ "$engine_ready" != "true" ]]; then
  echo "[smoke] engine_ready=false (lexicon/bin incomplete) -> basic smoke PASS (deferred best-move)"; exit 0
fi

echo "[smoke] POST /best-move"
resp=$(curl -fsS -H 'Content-Type: application/json' -d '{"rack":"AEIRSTZ","board":{}}' "$BASE_URL/best-move" || fail "best-move request failed")
echo "$resp" | grep -q '"move_type"' || fail "missing move_type"
echo "$resp" | grep -q '"raw"' || fail "missing raw"
echo "[smoke][OK] all checks passed"