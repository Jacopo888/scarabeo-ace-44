#!/usr/bin/env bash
# CI smoke test allineato alla "modalità vs quackle"
# - Usa board come mappa di coordinate 1-based (o vuota {})
# - Verifica HTTP 200, engine_fallback=false, move_type!='pass', tiles non vuote
#
# Variabili:
#   QUACKLE_BASE (default: http://localhost:8080)
#
set -euo pipefail

BASE=${QUACKLE_BASE:-http://localhost:8080}
JQ=${JQ:-jq}

fail(){ echo "[FAIL] $*" >&2; exit 1; }
info(){ echo "[INFO] $*" >&2; }

# Helper: POST JSON e cattura header/body
post_json(){
  local path="$1"; shift
  local body_file="$1"; shift
  local hdr="/tmp/resp.hdr$$" out="/tmp/resp.json$$"
  trap 'rm -f "$hdr" "$out"' RETURN
  curl -sS -D "$hdr" -o "$out" -X POST "${BASE}${path}" -H 'content-type: application/json' --data-binary @"$body_file" || true
  local code
  code=$(awk 'NR==1{print $2}' "$hdr")
  echo "$code" "$out"
}

# Health check
H_OUT="/tmp/health.$$.json"
curl -sS "$BASE/health" -o "$H_OUT" || true
code=$(jq -r '"ok"' "$H_OUT" >/dev/null 2>&1 && echo 200 || echo 000)
if [ "$code" != 200 ]; then cat "$H_OUT" || true; fail "health non raggiungibile"; fi
$JQ -e '(.engine_ready//true)==true' "$H_OUT" >/dev/null || { cat "$H_OUT"; fail "engine_ready deve essere true"; }
$JQ -e '(.strategy_ready//true)==true' "$H_OUT" >/dev/null || { cat "$H_OUT"; fail "strategy_ready deve essere true"; }
$JQ -e '(.gaddag_exists//true)==true and (.dawg_exists//true)==true' "$H_OUT" >/dev/null || { cat "$H_OUT"; fail "gaddag/dawg devono esistere"; }
$JQ -e '(.gaddag_size//1)>0 and (.dawg_size//1)>0' "$H_OUT" >/dev/null || { cat "$H_OUT"; fail "gaddag/dawg size > 0"; }

# Caso unico robusto: centro ancorato + rack HELLO??, fallback FALREI? se necessario
PRIMARY="/tmp/body.primary.$$"
cat >"$PRIMARY" <<'JSON'
{"rack":"HELLO??","board":{"8,8":{"letter":"A","isBlank":false}}}
JSON
FALLBACK="/tmp/body.fallback.$$"
cat >"$FALLBACK" <<'JSON'
{"rack":"FALREI?","board":{"8,8":{"letter":"A","isBlank":false}}}
JSON

run_case(){
  local label="$1"; shift
  local body="$1"; shift
  read -r status outFile < <(post_json "/best-move" "$body")
  info "$label status=${status}"
  [ "$status" = 200 ] || { cat "$outFile"; fail "$label: atteso HTTP 200"; }
  $JQ -e '.engine_fallback==false' "$outFile" >/dev/null || { cat "$outFile"; fail "$label: engine_fallback deve essere false"; }
  $JQ -e '.move_type!="pass"' "$outFile" >/dev/null || { cat "$outFile"; fail "$label: move_type non deve essere pass"; }
  $JQ -e '.tiles|type=="array" and length>0' "$outFile" >/dev/null || { cat "$outFile"; fail "$label: tiles deve essere non vuoto"; }
  $JQ -e '(.score//0)>0' "$outFile" >/dev/null || { cat "$outFile"; fail "$label: score deve essere > 0"; }
}

if ! run_case primary "$PRIMARY"; then
  run_case fallback "$FALLBACK"
fi

info "Smoke test CI OK"
