#!/usr/bin/env bash
set -euo pipefail

: "${QUACKLE_LEXDIR:=/data/lexica}"
: "${QUACKLE_APPDATA_DIR:=/data/appdata}"

mkdir -p "$QUACKLE_LEXDIR" "$QUACKLE_APPDATA_DIR"
echo "[entrypoint] Ensured directories: QUACKLE_LEXDIR=$QUACKLE_LEXDIR QUACKLE_APPDATA_DIR=$QUACKLE_APPDATA_DIR"

exec "$@"

