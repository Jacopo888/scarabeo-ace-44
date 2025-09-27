#!/usr/bin/env bash
set -euo pipefail

# Inputs (env)
: "${QUACKLE_LEXDIR:=/data/lexica}"
: "${QUACKLE_APPDATA_DIR:=/data/appdata}"
: "${LEXICON_NAME:=${QUACKLE_LEXICON:-enable1.15}}"
: "${GADDAG_URL:=}"
: "${DAWG_URL:=}"

mkdir -p "$QUACKLE_LEXDIR" "$QUACKLE_APPDATA_DIR"

DAWG_PATH="$QUACKLE_LEXDIR/${LEXICON_NAME}.dawg"
GADDAG_PATH="$QUACKLE_LEXDIR/${LEXICON_NAME}.gaddag"

log() { echo "[bootstrap_lexica] $*"; }
need=0
if [ ! -s "$DAWG_PATH" ]; then need=1; fi
if [ ! -s "$GADDAG_PATH" ]; then need=1; fi

if [ "$need" -eq 0 ]; then
  log "Lexica already present: $DAWG_PATH ($(stat -c '%s' "$DAWG_PATH" 2>/dev/null || echo 0) bytes), $GADDAG_PATH ($(stat -c '%s' "$GADDAG_PATH" 2>/dev/null || echo 0) bytes)"
  exit 0
fi

if [ -z "$DAWG_URL" ] || [ -z "$GADDAG_URL" ]; then
  log "Missing DAWG_URL or GADDAG_URL; skipping download (files may be mounted)."
  exit 0
fi

fetch() {
  local url="$1" dest="$2"
  log "Downloading $url -> $dest"
  curl -fsSL "$url" -o "$dest.part"
  mv -f "$dest.part" "$dest"
}

fetch "$DAWG_URL" "$DAWG_PATH"
fetch "$GADDAG_URL" "$GADDAG_PATH"

# Verify sizes
DAWG_SZ=$(stat -c '%s' "$DAWG_PATH" 2>/dev/null || echo 0)
GADDAG_SZ=$(stat -c '%s' "$GADDAG_PATH" 2>/dev/null || echo 0)
log "Sizes: dawg=$DAWG_SZ gaddag=$GADDAG_SZ"
if [ "$DAWG_SZ" -le 0 ] || [ "$GADDAG_SZ" -le 0 ]; then
  log "Download failed or zero-size files" >&2
  exit 1
fi

log "Bootstrap complete"
