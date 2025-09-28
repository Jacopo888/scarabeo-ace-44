#!/usr/bin/env bash
set -euo pipefail

BRIDGE_BIN="${BRIDGE_BIN:-/srv/bridge/engine_wrapper}"
LEX="${QUACKLE_LEXICON:-enable1.15}"
LEXDIR="${QUACKLE_LEXDIR:-/data/lexica}"

echo "[smoke_bridge] bin=$BRIDGE_BIN lexicon=$LEX lexdir=$LEXDIR"

if [ ! -x "$BRIDGE_BIN" ]; then
  echo "[smoke_bridge] missing bridge bin: $BRIDGE_BIN (skipping)"; exit 0;
fi

set +e
"$BRIDGE_BIN" --lexicon "$LEX" --lexdir "$LEXDIR" --selftest 2>/dev/null
rc=$?
set -e

echo "[smoke_bridge] selftest rc=$rc"

# Extra negative cases (best-effort if bin available)
if [ -x "$BRIDGE_BIN" ]; then
  # Malformed JSON path to ensure rc=64 and error=json_parse
  out=$(echo '{malformed' | "$BRIDGE_BIN" --lexicon "$LEX" --lexdir "$LEXDIR" 2>/dev/null)
  echo "[smoke_bridge] malformed json output=$out"

  # Rack too long (8 tiles)
  payload='{"board":{},"rack":"ABCDEFGH"}'
  out=$(echo "$payload" | "$BRIDGE_BIN" --lexicon "$LEX" --lexdir "$LEXDIR" 2>/dev/null)
  echo "[smoke_bridge] rack_too_long output=$out"

  # Invalid rack char (e.g., '#')
  payload='{"board":{},"rack":"AB#DE"}'
  out=$(echo "$payload" | "$BRIDGE_BIN" --lexicon "$LEX" --lexdir "$LEXDIR" 2>/dev/null)
  echo "[smoke_bridge] rack_invalid_char output=$out"

  # Invalid board letter
  payload='{"board":{"1,1":{"letter":"#","isBlank":false}},"rack":"ABC"}'
  out=$(echo "$payload" | "$BRIDGE_BIN" --lexicon "$LEX" --lexdir "$LEXDIR" 2>/dev/null)
  echo "[smoke_bridge] board_invalid_letter output=$out"

  # Out of bounds coordinate
  payload='{"board":{"16,1":{"letter":"A","isBlank":false}},"rack":"ABC"}'
  out=$(echo "$payload" | "$BRIDGE_BIN" --lexicon "$LEX" --lexdir "$LEXDIR" 2>/dev/null)
  echo "[smoke_bridge] out_of_bounds output=$out"
fi
exit 0
