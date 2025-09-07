#!/usr/bin/env bash
set -euo pipefail
BIN="/app/bin/engine_wrapper"
if [[ ! -x "$BIN" ]]; then
  echo "[verify_runtime] Manca $BIN o non è eseguibile"; exit 1
fi
echo '[verify_runtime] ldd check (solo diagnostica)'
ldd "$BIN" || true
if [[ ! -f "${GADDAG_PATH:-/app/lexica/enable1.gaddag}" ]]; then
  echo "[verify_runtime] Dizionario mancante: ${GADDAG_PATH}"; exit 1
fi
echo "[verify_runtime] OK"


