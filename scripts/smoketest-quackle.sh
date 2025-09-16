#!/usr/bin/env bash
set -euo pipefail

HOST="${HOST:-localhost}"
PORT="${PORT:-8080}"
BASE="http://${HOST}:${PORT}"

echo "Running smoketests against ${BASE}"

curl_api(){
  local name="$1"; shift
  echo "\n=== ${name} ==="
  http_code=$(curl -sS -o /tmp/resp.json -w "%{http_code}" "$@") || true
  cat /tmp/resp.json
  echo
  echo "HTTP ${http_code}"
}

# A. Empty grid
curl_api "A grid empty" -H 'Content-Type: application/json' \
  --data-binary @- ${BASE}/best-move <<'JSON'
{
  "rack":"AEIRSTZ",
  "board":{
    "rows":15,"cols":15,"center_x":7,"center_y":7,
    "grid":[
      "...............","...............","...............",
      "...............","...............","...............",
      "...............","...............","...............",
      "...............","...............","...............",
      "...............","...............","..............."
    ]
  }
}
JSON

# B. Letter at center
curl_api "B grid with A at center" -H 'Content-Type: application/json' \
  --data-binary @- ${BASE}/best-move <<'JSON'
{
  "rack":"AEIRST?",
  "board":{
    "rows":15,"cols":15,"center_x":7,"center_y":7,
    "grid":[
      "...............","...............","...............",
      "...............","...............","...............",
      "...............",".......A.......","...............",
      "...............","...............","...............",
      "...............","...............","..............."
    ]
  }
}
JSON

# C. squares 2D null
curl_api "C squares 2D" -H 'Content-Type: application/json' \
  --data-binary @- ${BASE}/best-move <<'JSON'
{
  "rack":"HELLO??",
  "board":{
    "rows":15,"cols":15,"center_x":7,"center_y":7,
    "squares":[
      [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
      [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
      [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
      [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
      [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
      [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
      [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
      [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
      [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
      [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
      [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
      [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
      [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
      [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
      [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]
    ]
  }
}
JSON

# D. placements
curl_api "D placements" -H 'Content-Type: application/json' \
  --data-binary @- ${BASE}/best-move <<'JSON'
{
  "rack":"AEIRST?",
  "board":{
    "rows":15,"cols":15,"center_x":7,"center_y":7,
    "placements":[{"x":7,"y":7,"letter":"A","is_blank":false}]
  }
}
JSON

# E. Rack with blanks
curl_api "E rack with blanks" -H 'Content-Type: application/json' \
  --data-binary @- ${BASE}/best-move <<'JSON'
{"rack":"HELLO??","board":{"rows":15,"cols":15,"center_x":7,"center_y":7,"grid":["...............","...............","...............","...............","...............","...............","...............","...............","...............","...............","...............","...............","...............","...............","..............."]}}
JSON

echo "\nAll smoketests sent. Check that engine_fallback:false and move_type!='pass'."

