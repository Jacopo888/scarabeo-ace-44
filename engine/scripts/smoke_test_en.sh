#!/bin/bash
set -euo pipefail

# Smoke tests for English ruleset - fail if no moves found
echo "=== SMOKE TESTS FOR ENGLISH RULESET ==="

WRAPPER="/app/bin/engine_wrapper"
GADDAG="/app/lexica/enable1.gaddag"

# Test 1: Ping test
echo "Test 1: Ping test"
echo '{"op":"ping"}' | $WRAPPER --gaddag "$GADDAG" --ruleset en | grep -q '"pong":true' || {
    echo "FAIL: Ping test failed"
    exit 1
}
echo "✓ Ping test passed"

# Test 2: Empty board + AEIRST? (should find moves)
echo "Test 2: Empty board + AEIRST?"
# Create empty 15x15 board array
EMPTY_BOARD='[[],[],[],[],[],[],[],[],[],[],[],[],[],[],[]]'
RESULT=$(echo "{\"op\":\"compute\",\"board\":$EMPTY_BOARD,\"rack\":\"AEIRST?\",\"limit_ms\":800}" | $WRAPPER --gaddag "$GADDAG" --ruleset en)
if echo "$RESULT" | grep -q '"moves":\[\]'; then
    echo "FAIL: Empty board test returned no moves"
    echo "Result: $RESULT"
    exit 1
fi
echo "✓ Empty board test passed"

# Test 3: Board CA + REINST? (should find moves)
echo "Test 3: Board CA + REINST?"
# Create board with CA at (7,7) and (7,8)
BOARD_CA='[[],[],[],[],[],[],[],["","","","","","","","C","A","","","","","",""],[[],[],[],[],[],[],[],[],[],[],[],[],[],[],[]],[[],[],[],[],[],[],[],[],[],[],[],[],[],[],[]],[[],[],[],[],[],[],[],[],[],[],[],[],[],[],[]],[[],[],[],[],[],[],[],[],[],[],[],[],[],[],[]],[[],[],[],[],[],[],[],[],[],[],[],[],[],[],[]],[[],[],[],[],[],[],[],[],[],[],[],[],[],[],[]],[[],[],[],[],[],[],[],[],[],[],[],[],[],[],[]],[[],[],[],[],[],[],[],[],[],[],[],[],[],[],[]],[[],[],[],[],[],[],[],[],[],[],[],[],[],[],[]],[[],[],[],[],[],[],[],[],[],[],[],[],[],[],[]],[[],[],[],[],[],[],[],[],[],[],[],[],[],[],[]],[[],[],[],[],[],[],[],[],[],[],[],[],[],[],[]]]'
RESULT=$(echo "{\"op\":\"compute\",\"board\":$BOARD_CA,\"rack\":\"REINST?\",\"limit_ms\":800}" | $WRAPPER --gaddag "$GADDAG" --ruleset en)
if echo "$RESULT" | grep -q '"moves":\[\]'; then
    echo "FAIL: Board CA test returned no moves"
    echo "Result: $RESULT"
    exit 1
fi
echo "✓ Board CA test passed"

# Test 4: Board HI + RSTLNE? (should find moves)
echo "Test 4: Board HI + RSTLNE?"
# Create board with HI at (7,7) and (7,8)
BOARD_HI='[[],[],[],[],[],[],[],["","","","","","","","H","I","","","","","",""],[[],[],[],[],[],[],[],[],[],[],[],[],[],[],[]],[[],[],[],[],[],[],[],[],[],[],[],[],[],[],[]],[[],[],[],[],[],[],[],[],[],[],[],[],[],[],[]],[[],[],[],[],[],[],[],[],[],[],[],[],[],[],[]],[[],[],[],[],[],[],[],[],[],[],[],[],[],[],[]],[[],[],[],[],[],[],[],[],[],[],[],[],[],[],[]],[[],[],[],[],[],[],[],[],[],[],[],[],[],[],[]],[[],[],[],[],[],[],[],[],[],[],[],[],[],[],[]],[[],[],[],[],[],[],[],[],[],[],[],[],[],[],[]],[[],[],[],[],[],[],[],[],[],[],[],[],[],[],[]],[[],[],[],[],[],[],[],[],[],[],[],[],[],[],[]],[[],[],[],[],[],[],[],[],[],[],[],[],[],[],[]],[[],[],[],[],[],[],[],[],[],[],[],[],[],[],[]]]'
RESULT=$(echo "{\"op\":\"compute\",\"board\":$BOARD_HI,\"rack\":\"RSTLNE?\",\"limit_ms\":800}" | $WRAPPER --gaddag "$GADDAG" --ruleset en)
if echo "$RESULT" | grep -q '"moves":\[\]'; then
    echo "FAIL: Board HI test returned no moves"
    echo "Result: $RESULT"
    exit 1
fi
echo "✓ Board HI test passed"

# Test 5: GADDAG lexicon probe
echo "Test 5: GADDAG lexicon probe"
RESULT=$(echo '{"op":"probe_lexicon"}' | $WRAPPER --gaddag "$GADDAG" --ruleset en)
if echo "$RESULT" | grep -q '"lexicon_ok":true'; then
    echo "✓ GADDAG lexicon probe passed"
else
    echo "FAIL: GADDAG lexicon probe failed"
    echo "Result: $RESULT"
    exit 1
fi

echo "=== ALL SMOKE TESTS PASSED ==="
