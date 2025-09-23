#!/usr/bin/env bash
set -euo pipefail

: "${QUACKLE_LEXDIR:=/data/lexica}"
: "${QUACKLE_APPDATA_DIR:=/data/appdata}"
: "${PORT:=8080}"  # default locale; PaaS può sovrascrivere

mkdir -p "$QUACKLE_LEXDIR" "$QUACKLE_APPDATA_DIR"
echo "[BOOT] Ensured dirs LEXDIR=$QUACKLE_LEXDIR APPDATA=$QUACKLE_APPDATA_DIR PORT=$PORT"

echo "[BOOT] Ensuring strategy files in /data/appdata/strategy ..."
need_sync=0
for f in default_english/syn2 default_english/vcplace default_english/superleaves default_english/worths default/bogowin; do
  if [ ! -s "/data/appdata/strategy/$f" ]; then
    echo "[BOOT] Missing /data/appdata/strategy/$f"
    need_sync=1
  fi
done

if [ "$need_sync" -eq 1 ]; then
  echo "[BOOT] Syncing from /usr/share/quackle/data/strategy -> /data/appdata/strategy"
  rsync -a --mkpath /usr/share/quackle/data/strategy/ /data/appdata/strategy/
fi

echo "[BOOT] Strategy inventory:"
for f in default_english/syn2 default_english/vcplace default_english/superleaves default_english/worths default/bogowin; do
  p="/data/appdata/strategy/$f"
  if [ -s "$p" ]; then
    sz=$(stat -c '%s' "$p")
    sha=$(sha256sum "$p" | cut -d' ' -f1)
    echo " - $p size=$sz sha256=$sha"
  else
    echo " - $p MISSING"
  fi
done

# Create symlinks into /usr/share/quackle/data/strategy pointing at appdata
echo "[BOOT] Ensuring symlinks from /usr/share/quackle/data/strategy to /data/appdata/strategy"
mkdir -p /usr/share/quackle/data/strategy/default_english /usr/share/quackle/data/strategy/default
for n in syn2 vcplace superleaves worths; do
  ln -sf "/data/appdata/strategy/default_english/$n" "/usr/share/quackle/data/strategy/default_english/$n"
done
ln -sf "/data/appdata/strategy/default/bogowin" "/usr/share/quackle/data/strategy/default/bogowin"

exec uvicorn quackle_service.main:app --host 0.0.0.0 --port "$PORT"
sleep 3600
