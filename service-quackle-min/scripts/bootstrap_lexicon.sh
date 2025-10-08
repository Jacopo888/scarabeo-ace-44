#!/bin/sh
set -e
LEXDIR="${QUACKLE_LEXDIR:-/data/lexica}"
LEXICON="${QUACKLE_LEXICON:-enable1.15}"
DAWG_URL="${DAWG_URL:-}" # opzionali
GADDAG_URL="${GADDAG_URL:-}" # opzionali
mkdir -p "$LEXDIR"
DAWG_FILE="$LEXDIR/$LEXICON.dawg"
GADDAG_FILE="$LEXDIR/$LEXICON.gaddag"

need_download=0
[ ! -s "$DAWG_FILE" ] && [ -n "$DAWG_URL" ] && need_download=1
[ ! -s "$GADDAG_FILE" ] && [ -n "$GADDAG_URL" ] && need_download=1

if [ "$need_download" = "1" ]; then
  echo "[bootstrap] Downloading lexicon $LEXICON"
  if [ -n "$DAWG_URL" ] && [ ! -s "$DAWG_FILE" ]; then
    curl -fsSL "$DAWG_URL" -o "$DAWG_FILE" || echo "[bootstrap] WARN dawg download failed"
  fi
  if [ -n "$GADDAG_URL" ] && [ ! -s "$GADDAG_FILE" ]; then
    curl -fsSL "$GADDAG_URL" -o "$GADDAG_FILE" || echo "[bootstrap] WARN gaddag download failed"
  fi
fi

if [ ! -s "$DAWG_FILE" ] || [ ! -s "$GADDAG_FILE" ]; then
  echo "[bootstrap] Lexicon incomplete (dawg/gaddag missing or empty). Service will start but /best-move risponderà 500 lexicon_not_ready." >&2
fi

exit 0
