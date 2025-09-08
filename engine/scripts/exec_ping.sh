#!/usr/bin/env bash
set -euo pipefail

# run the wrapper directly to isolate lexicon load errors

printf '{"op":"ping"}\n' | /app/bin/engine_wrapper --gaddag /app/lexica/enable1.gaddag --ruleset it || true
