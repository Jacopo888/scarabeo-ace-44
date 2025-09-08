#!/usr/bin/env bash
set -euo pipefail

# Critical smoke test for GADDAG loading
# This script MUST pass for the build to succeed

GADDAG_PATH="${GADDAG_PATH:-/app/lexica/enable1.gaddag}"
WRAPPER_PATH="/app/bin/engine_wrapper"
ALPHABET_PATH="${QUACKLE_ALPHABET:-}"

echo "[smoke] Critical smoke test starting..."
echo "[smoke] GADDAG: $GADDAG_PATH"
echo "[smoke] Wrapper: $WRAPPER_PATH"
echo "[smoke] Alphabet: ${ALPHABET_PATH:-<default>}"

# Step 1: Basic file checks
if [[ ! -f "$GADDAG_PATH" ]]; then
    echo "[smoke] FATAL: GADDAG file not found: $GADDAG_PATH"
    exit 1
fi

GADDAG_SIZE=$(stat -c%s "$GADDAG_PATH")
if [[ $GADDAG_SIZE -eq 0 ]]; then
    echo "[smoke] FATAL: GADDAG file is empty: $GADDAG_PATH"
    exit 1
fi

echo "[smoke] GADDAG file OK: $GADDAG_SIZE bytes"

# Step 2: Wrapper binary check
if [[ ! -f "$WRAPPER_PATH" ]]; then
    echo "[smoke] FATAL: Wrapper not found: $WRAPPER_PATH"
    exit 1
fi

if [[ ! -x "$WRAPPER_PATH" ]]; then
    echo "[smoke] FATAL: Wrapper not executable: $WRAPPER_PATH"
    exit 1
fi

echo "[smoke] Wrapper binary OK"

# Step 3: Critical test - wrapper must load GADDAG without segfault
echo "[smoke] Testing GADDAG loading..."

# Create a temporary script to capture both stdout and stderr
TEMP_SCRIPT=$(mktemp)
cat > "$TEMP_SCRIPT" << 'EOF'
#!/bin/bash
echo '{"op":"ping"}' | timeout 30s /app/bin/engine_wrapper --gaddag /app/lexica/enable1.gaddag --ruleset it 2>&1
echo "EXIT_CODE:$?"
EOF

chmod +x "$TEMP_SCRIPT"

# Run the test and capture output
TEST_OUTPUT=$("$TEMP_SCRIPT" 2>&1 || true)
rm -f "$TEMP_SCRIPT"

# Check if wrapper loaded GADDAG successfully
if echo "$TEST_OUTPUT" | grep -q "gaddag_loaded"; then
    echo "[smoke] ✓ GADDAG loaded successfully"
    if echo "$TEST_OUTPUT" | grep -q '"pong":true'; then
        echo "[smoke] ✓ Ping response OK"
    else
        echo "[smoke] ⚠ GADDAG loaded but ping response unclear"
        echo "[smoke] Output: $TEST_OUTPUT"
    fi
else
    echo "[smoke] ✗ GADDAG loading failed"
    echo "[smoke] Full output:"
    echo "$TEST_OUTPUT"
    
    # Check for specific error patterns
    if echo "$TEST_OUTPUT" | grep -q "Segmentation fault"; then
        echo "[smoke] FATAL: Segmentation fault detected"
    elif echo "$TEST_OUTPUT" | grep -q "EXIT_CODE:139"; then
        echo "[smoke] FATAL: Exit code 139 (segfault)"
    elif echo "$TEST_OUTPUT" | grep -q "invalid or unsupported"; then
        echo "[smoke] FATAL: GADDAG format incompatibility"
    fi
    
    exit 1
fi

echo "[smoke] ✓ Critical smoke test PASSED"
