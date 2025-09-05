#!/usr/bin/env bash
set -euo pipefail

DEST="${RAILWAY_VOLUME_MOUNT_PATH:-/data}/quackle/lexica/enable1"
mkdir -p "$DEST"

if [ -s "$DEST/enable1.dawg" ] && [ -s "$DEST/enable1.gaddag" ]; then
  echo "[setup] enable1.* già presenti in $DEST"
  ls -lh "$DEST"
  exit 0
fi

# Quackle repo per sorgenti tool e alphabets
[ -d /tmp/quackle ] || git clone --depth 1 https://github.com/quackle/quackle.git /tmp/quackle

# Tool
command -v makedawg   >/dev/null 2>&1 || g++ -O3 -std=c++14 -o /usr/local/bin/makedawg   /tmp/quackle/makedawg.cpp
command -v makegaddag >/dev/null 2>&1 || g++ -O3 -std=c++14 -I/tmp/quackle -o /usr/local/bin/makegaddag /tmp/quackle/makegaddag/*.cpp

# Alphabets + AppData
mkdir -p /usr/share/quackle/data/alphabets
cp -n /tmp/quackle/data/alphabets/* /usr/share/quackle/data/alphabets/ 2>/dev/null || true
export QUACKLE_APPDATA_DIR=/usr/share/quackle/data

# ENABLE → /tmp/enable1.txt
apt-get update -y && apt-get install -y curl
curl -Ls https://raw.githubusercontent.com/rressler/data_raw_courses/main/enable1_words.txt \
 | awk '{print toupper($0)}' | sed -E 's/[^A-Z]//g' | sed '/^$/d' | sort -u >/tmp/enable1.txt

# DAWG
/usr/local/bin/makedawg /tmp/enable1.txt "$DEST/enable1.dawg"

# GADDAG (richiede CWD specifica e gaddaginput.raw)
mkdir -p /usr/share/quackle/lexica
cd /usr/share/quackle/lexica
cp -f /tmp/enable1.txt gaddaginput.raw
/usr/local/bin/makegaddag
[ -f output.gaddag ] && cp -f output.gaddag "$DEST/enable1.gaddag" || cp -f *.gaddag "$DEST/enable1.gaddag"

# Copia la txt per debug
cp -n /tmp/enable1.txt "$DEST/enable1.txt" || true

echo "[setup] Completato. Contenuto:"
ls -lh "$DEST"


