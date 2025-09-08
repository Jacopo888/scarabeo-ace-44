#!/usr/bin/env bash
set -euo pipefail
umask 022

LEXICON_NAME="${LEXICON_NAME:-enable1}"
# Sanitize LEX_DIR to avoid accidental newlines/spaces from env
RAW_LEX_DIR="${LEX_DIR:-/data/quackle/lexica/enable1}"
# remove trailing CR/LF and surrounding spaces
LEX_DIR="$(printf '%s' "${RAW_LEX_DIR}" | tr -d '\r' | sed -E 's/[[:space:]]+$//' | sed -E 's/^[[:space:]]+//')"
DAWG_URL="${DAWG_URL:-}"
GADDAG_URL="${GADDAG_URL:-}"

mkdir -p "${LEX_DIR}"

# If a malformed directory exists (e.g., with newline) containing our files, migrate them
PARENT_DIR="$(dirname "${LEX_DIR}")"
BASE_NAME="$(basename "${LEX_DIR}")"
if [ -d "${PARENT_DIR}" ]; then
  for d in "${PARENT_DIR}"/*; do
    [ -d "$d" ] || continue
    name="$(basename "$d")"
    if [ "$name" != "$BASE_NAME" ] && echo "$name" | grep -qi "${LEXICON_NAME}"; then
      if [ -s "$d/${LEXICON_NAME}.dawg" ] || [ -s "$d/${LEXICON_NAME}.gaddag" ]; then
        echo "[bootstrap] Migrating lexicon files from malformed dir '$d' to '${LEX_DIR}'"
        mkdir -p "${LEX_DIR}"
        [ -s "$d/${LEXICON_NAME}.dawg" ] && mv -f "$d/${LEXICON_NAME}.dawg" "${LEX_DIR}/" || true
        [ -s "$d/${LEXICON_NAME}.gaddag" ] && mv -f "$d/${LEXICON_NAME}.gaddag" "${LEX_DIR}/" || true
        rmdir "$d" 2>/dev/null || true
      fi
    fi
  done
fi

DAWG_PATH="${LEX_DIR}/${LEXICON_NAME}.dawg"
GADDAG_PATH="${LEX_DIR}/${LEXICON_NAME}.gaddag"

if [ -s "${DAWG_PATH}" ] && [ -s "${GADDAG_PATH}" ]; then
  echo "[bootstrap] Lexicon already present at ${LEX_DIR}"
  ls -lh "${LEX_DIR}" || true
  exit 0
fi

# Copy lexicon files from container to volume if they don't exist on volume
CONTAINER_DAWG="/usr/share/quackle/lexica/${LEXICON_NAME}.dawg"
CONTAINER_GADDAG="/usr/share/quackle/lexica/${LEXICON_NAME}.gaddag"

if [ ! -s "${CONTAINER_DAWG}" ] || [ ! -s "${CONTAINER_GADDAG}" ]; then
  echo "[bootstrap] Container lexicon files missing"
  exit 1
fi

echo "[bootstrap] Copying DAWG from container ${CONTAINER_DAWG} -> ${DAWG_PATH}"
cp -f "${CONTAINER_DAWG}" "${DAWG_PATH}"

echo "[bootstrap] Copying GADDAG from container ${CONTAINER_GADDAG} -> ${GADDAG_PATH}"
cp -f "${CONTAINER_GADDAG}" "${GADDAG_PATH}"

echo "[bootstrap] Completed. Contents of ${LEX_DIR}:"
ls -lh "${LEX_DIR}" || true


