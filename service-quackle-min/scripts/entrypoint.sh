#!/bin/sh
set -euxo pipefail

# If a command is provided (e.g., heroku run bash -lc '...'), execute it directly
if [ "$#" -gt 0 ]; then
  exec "$@"
fi

# Log ambiente essenziale
echo "[ENTRY] Python $(python -V 2>&1 || true)" >&2
if command -v uvicorn >/dev/null 2>&1; then
  echo "[ENTRY] Uvicorn $(uvicorn --version 2>&1 || true)" >&2
fi

# Log CORS
echo "[ENTRY] CORS_ORIGINS=${CORS_ORIGINS:-} (empty means disabled)" >&2

# Log QUACKLE vars
echo "[ENTRY] QUACKLE_LEXDIR=${QUACKLE_LEXDIR:-/data/lexica} QUACKLE_LEXICON=${QUACKLE_LEXICON:-enable1.15}" >&2

# Bootstrap lexicon (non fatale se assenti)
/usr/local/bin/bootstrap_lexicon.sh || echo "[ENTRY] bootstrap_lexicon.sh returned non-zero, continuing"

# Piccolo smoke: lista file lessico se presenti
ls -l "${QUACKLE_LEXDIR:-/data/lexica}" || true

# Avvio server sulla porta indicata da Heroku ($PORT) o 8000 in locale
PORT_ENV="${PORT:-8000}"
echo "[ENTRY] Starting uvicorn on 0.0.0.0:${PORT_ENV}" >&2
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT_ENV}"
