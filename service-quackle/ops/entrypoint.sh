#!/usr/bin/env bash
set -e
export QUACKLE_APPDATA_DIR=/usr/share/quackle/data
/usr/local/bin/setup_enable_lexicon.sh
exec "$@"


