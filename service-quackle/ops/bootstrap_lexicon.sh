#!/usr/bin/env bash
set -euo pipefail
umask 022

LEXICON_NAME="${LEXICON_NAME:-enable1}"
LEX_DIR="${LEX_DIR:-/data/quackle/lexica/enable1}"
DAWG_URL="${DAWG_URL:-}"
GADDAG_URL="${GADDAG_URL:-}"

mkdir -p "${LEX_DIR}"

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


