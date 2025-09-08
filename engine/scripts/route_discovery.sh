#!/usr/bin/env bash
set -euo pipefail
echo "[routes]"
curl -s http://localhost:8080/openapi.json | jq -r '.paths | keys[]' || true
