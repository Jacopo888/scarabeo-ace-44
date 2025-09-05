#!/usr/bin/env bash
set -euo pipefail
umask 022

DEST="${RAILWAY_VOLUME_MOUNT_PATH:-/data}/quackle/lexica/enable1"
mkdir -p "$DEST"

# idempotenza
if [ -s "$DEST/enable1.dawg" ] && [ -s "$DEST/enable1.gaddag" ]; then
  echo "[setup] enable1.* già presenti in $DEST"
  ls -lh "$DEST"
  exit 0
fi

# prerequisiti
command -v curl >/dev/null 2>&1 || { echo "[setup] curl non trovato: installalo in build"; exit 1; }
[ -d /tmp/quackle ] || git clone --depth 1 https://github.com/quackle/quackle.git /tmp/quackle

# tool (compila solo se mancanti)
command -v makedawg   >/dev/null 2>&1 || g++ -O3 -std=c++14 -o /usr/local/bin/makedawg   /tmp/quackle/makedawg.cpp
command -v makegaddag >/dev/null 2>&1 || g++ -O3 -std=c++14 -I/tmp/quackle -o /usr/local/bin/makegaddag /tmp/quackle/makegaddag/*.cpp

# alphabets + appdata per makegaddag
mkdir -p /usr/share/quackle/data/alphabets
cp -n /tmp/quackle/data/alphabets/* /usr/share/quackle/data/alphabets/ 2>/dev/null || true
export QUACKLE_APPDATA_DIR=/usr/share/quackle/data

# ENABLE → /tmp/enable1.txt (upper, A–Z, uniq)
curl -Ls https://raw.githubusercontent.com/rressler/data_raw_courses/main/enable1_words.txt \
 | awk '{print toupper($0)}' | sed -E 's/[^A-Z]//g' | sed '/^$/d' | sort -u > /tmp/enable1.txt

# DAWG sul volume
/usr/local/bin/makedawg /tmp/enable1.txt "$DEST/enable1.dawg"

# GADDAG: CWD deve essere /usr/share/quackle/lexica e serve gaddaginput.raw
mkdir -p /usr/share/quackle/lexica
cd /usr/share/quackle/lexica
cp -f /tmp/enable1.txt gaddaginput.raw
/usr/local/bin/makegaddag

# copia l'output nel nome definitivo
if [ -f output.gaddag ]; then
  cp -f output.gaddag "$DEST/enable1.gaddag"
else
  cp -f *.gaddag "$DEST/enable1.gaddag"
fi

# txt di debug
cp -n /tmp/enable1.txt "$DEST/enable1.txt" || true

# verifica finale (fail-fast)
test -s "$DEST/enable1.dawg" || { echo "[setup] Manca enable1.dawg"; exit 1; }
test -s "$DEST/enable1.gaddag" || { echo "[setup] Manca enable1.gaddag"; exit 1; }

echo "[setup] Completato. Contenuto:"
ls -lh "$DEST"


