#!/usr/bin/env bash
set -euo pipefail

: "${QUACKLE_LEXDIR:=/data/lexica}"
: "${QUACKLE_APPDATA_DIR:=/data/appdata}"
: "${PORT:=8080}"  # default locale; PaaS può sovrascrivere

mkdir -p "$QUACKLE_LEXDIR" "$QUACKLE_APPDATA_DIR"
echo "[entrypoint] Ensured dirs LEXDIR=$QUACKLE_LEXDIR APPDATA=$QUACKLE_APPDATA_DIR PORT=$PORT"

exec uvicorn quackle_service.main:app --host 0.0.0.0 --port "$PORT"
