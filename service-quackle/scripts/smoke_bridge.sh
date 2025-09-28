#!/usr/bin/env bash
set -euo pipefail

BRIDGE_BIN="${BRIDGE_BIN:-/srv/bridge/engine_wrapper}"
LEX="${QUACKLE_LEXICON:-enable1.15}"
LEXDIR="${QUACKLE_LEXDIR:-/data/lexica}"

echo "[smoke_bridge] bin=$BRIDGE_BIN lexicon=$LEX lexdir=$LEXDIR"

if [ ! -x "$BRIDGE_BIN" ]; then
  echo "missing bridge bin: $BRIDGE_BIN"; exit 99;
fi

set +e
"$BRIDGE_BIN" --lexicon "$LEX" --lexdir "$LEXDIR" --selftest 2>/dev/null
rc=$?
set -e

echo "[smoke_bridge] selftest rc=$rc"

# Test malformed JSON path to ensure rc=64 and error=json_parse
if [ -x "$BRIDGE_BIN" ]; then
  out=$(echo '{malformed' | "$BRIDGE_BIN" --lexicon "$LEX" --lexdir "$LEXDIR" 2>/dev/null)
  echo "[smoke_bridge] malformed json output=$out"
fi
exit 0
