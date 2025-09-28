#!/usr/bin/env bash
set -euo pipefail

# This script is a tiny sanity check for the Railway production setup.
# It doesn't alter state and only calls health endpoints plus one benign best-move.

BASE_URL="${BASE_URL:-https://service-quackle-production.up.railway.app}"

echo "Running Railway smoketest against ${BASE_URL}"

curl_json(){
  local path="$1"; shift
  echo -e "\n=== GET ${path} ==="
  http_code=$(curl -sS -o /tmp/resp.json -w "%{http_code}" "${BASE_URL}${path}") || true
  cat /tmp/resp.json; echo; echo "HTTP ${http_code}"
}

post_json(){
  local path="$1"; shift
  echo -e "\n=== POST ${path} ==="
  http_code=$(curl -sS -o /tmp/resp.json -w "%{http_code}" -H 'Content-Type: application/json' --data-binary @- "${BASE_URL}${path}") || true
  cat /tmp/resp.json; echo; echo "HTTP ${http_code}"
}

curl_json "/health"
curl_json "/health/cors"

post_json "/best-move" <<'JSON'
{
  "rack": "AEIRST?",
  "board": {}
}
JSON

echo -e "\nSmoketest complete. Expect HTTP 200 for /health and /health/cors; /best-move should contain engine_fallback=false."
