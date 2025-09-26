#!/usr/bin/env bash
# Scarica i lessici corretti enable1.15.* nella cartella ./data/lexica (e opzionalmente ./lexica)
# Usa URL di default dalla repo jacopo88/quackle, sovrascrivibili via env GADDAG_URL/DAWG_URL.
set -euo pipefail

GADDAG_URL=${GADDAG_URL:-https://raw.githubusercontent.com/Jacopo888/quackle/master/data/lexica/enable1.15.gaddag}
DAWG_URL=${DAWG_URL:-https://raw.githubusercontent.com/Jacopo888/quackle/master/data/lexica/enable1.15.dawg}

mkdir -p ./data/lexica ./lexica

download() {
  local url="$1" dest="$2"
  echo "[INFO] Scarico $url -> $dest"
  curl -fL --retry 3 --retry-delay 2 -o "$dest.tmp" "$url"
  mv "$dest.tmp" "$dest"
  local sz
  sz=$(stat -c%s "$dest" 2>/dev/null || stat -f%z "$dest")
  if [ "${sz:-0}" -le 0 ]; then echo "[FAIL] File vuoto: $dest" >&2; exit 1; fi
}

# Scarica in ./data/lexica (usata dal container)
download "$GADDAG_URL" ./data/lexica/enable1.15.gaddag
download "$DAWG_URL"   ./data/lexica/enable1.15.dawg

# Copia anche in ./lexica (utile per referenze locali)
cp -f ./data/lexica/enable1.15.gaddag ./lexica/
cp -f ./data/lexica/enable1.15.dawg   ./lexica/

echo "[OK] Lessici pronti in ./data/lexica e ./lexica"
