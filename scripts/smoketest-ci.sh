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

# Caso A: board vuota + rack "FALREI?" (rack robusto con una blank)
# Forma inviata al bridge: {op:"compute", ruleset:"en", board:{}, rack:"FALREI?"}
A_BODY="/tmp/bodyA.$$"
cat >"$A_BODY" <<'JSON'
{"rack":"FALREI?","board":{}}
JSON

read -r status outFile < <(post_json "/best-move" "$A_BODY")
info "A status=${status}"
[ "$status" = 200 ] || { cat "$outFile"; fail "atteso HTTP 200"; }
$JQ -e '.engine_fallback==false' "$outFile" >/dev/null || { cat "$outFile"; fail "engine_fallback deve essere false"; }
$JQ -e '.move_type!="pass"' "$outFile" >/dev/null || { cat "$outFile"; fail "move_type non deve essere pass"; }
$JQ -e '.tiles|type=="array" and length>0' "$outFile" >/dev/null || { cat "$outFile"; fail "tiles deve essere non vuoto"; }

# Caso B: centro occupato (8,8) con 'A' + rack "HELLO??"
B_BODY="/tmp/bodyB.$$"
cat >"$B_BODY" <<'JSON'
{"rack":"HELLO??","board":{"8,8":{"letter":"A","isBlank":false}}}
JSON

read -r status outFile < <(post_json "/best-move" "$B_BODY")
info "B status=${status}"
[ "$status" = 200 ] || { cat "$outFile"; fail "atteso HTTP 200 (B)"; }
$JQ -e '.engine_fallback==false' "$outFile" >/dev/null || { cat "$outFile"; fail "engine_fallback deve essere false (B)"; }
$JQ -e '.move_type!="pass"' "$outFile" >/dev/null || { cat "$outFile"; fail "move_type non deve essere pass (B)"; }
$JQ -e '.tiles|type=="array" and length>0' "$outFile" >/dev/null || { cat "$outFile"; fail "tiles deve essere non vuoto (B)"; }

info "Smoke test CI OK"
