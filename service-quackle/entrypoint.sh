#!/usr/bin/env bash
set -e
export QUACKLE_APPDATA_DIR="${QUACKLE_APPDATA_DIR:-/usr/share/quackle/data}"

# Ensure lexicon files exist on the mounted volume, download if missing
/usr/local/bin/bootstrap_lexicon.sh

exec "$@"


