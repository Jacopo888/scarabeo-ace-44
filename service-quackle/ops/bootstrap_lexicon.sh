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

if [ -z "${DAWG_URL}" ] || [ -z "${GADDAG_URL}" ]; then
  echo "[bootstrap] Missing DAWG_URL or GADDAG_URL environment variables"
  exit 1
fi

command -v curl >/dev/null 2>&1 || { echo "[bootstrap] curl not found in image"; exit 1; }

echo "[bootstrap] Downloading DAWG from ${DAWG_URL} -> ${DAWG_PATH}"
TMP_DAWG="/tmp/${LEXICON_NAME}.dawg.$$"
curl -fL --retry 3 --retry-delay 2 -o "${TMP_DAWG}" "${DAWG_URL}"
test -s "${TMP_DAWG}" || { echo "[bootstrap] Downloaded DAWG is empty"; exit 1; }
mv -f "${TMP_DAWG}" "${DAWG_PATH}"

echo "[bootstrap] Downloading GADDAG from ${GADDAG_URL} -> ${GADDAG_PATH}"
TMP_GAD="/tmp/${LEXICON_NAME}.gaddag.$$"
curl -fL --retry 3 --retry-delay 2 -o "${TMP_GAD}" "${GADDAG_URL}"
test -s "${TMP_GAD}" || { echo "[bootstrap] Downloaded GADDAG is empty"; exit 1; }
mv -f "${TMP_GAD}" "${GADDAG_PATH}"

echo "[bootstrap] Completed. Contents of ${LEX_DIR}:"
ls -lh "${LEX_DIR}" || true


