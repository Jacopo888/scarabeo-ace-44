#!/usr/bin/env bash
set -euo pipefail
: "${GADDAG_PATH:=/app/lexica/enable1.gaddag}"

if [[ -f "$GADDAG_PATH" ]]; then
  echo "[init_lexicon] found $GADDAG_PATH"
  exit 0
else
  echo "[init_lexicon] MISSING: $GADDAG_PATH"
  echo "Piano A prevede il lexicon incluso nell'immagine. Copialo in engine/lexica/ prima del build."
  exit 1
fi


