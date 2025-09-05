#!/usr/bin/env bash
set -e
export QUACKLE_APPDATA_DIR=/usr/share/quackle/data
echo "[entrypoint] Lexicon: ${LEXICON_NAME:-enable1}, LexDir: ${LEX_DIR:-/data/quackle/lexica/enable1}, AppData: ${QUACKLE_APPDATA_DIR}"
/usr/local/bin/setup_enable_lexicon.sh || echo "[entrypoint] setup_enable_lexicon.sh returned non-zero; continuing"
if [ -d "${LEX_DIR:-/data/quackle/lexica/enable1}" ]; then
  echo "[entrypoint] DAWG present? $(test -s ${LEX_DIR:-/data/quackle/lexica/enable1}/${LEXICON_NAME:-enable1}.dawg && echo true || echo false)"
  echo "[entrypoint] GADDAG present? $(test -s ${LEX_DIR:-/data/quackle/lexica/enable1}/${LEXICON_NAME:-enable1}.gaddag && echo true || echo false)"
fi
exec "$@"


