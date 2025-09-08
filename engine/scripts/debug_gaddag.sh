#!/usr/bin/env bash
set -euo pipefail

# Advanced debugging script for GADDAG loading issues
GADDAG_PATH="${GADDAG_PATH:-/app/lexica/enable1.gaddag}"
WRAPPER_PATH="/app/bin/engine_wrapper"

echo "[debug] Starting GADDAG debugging session"
echo "[debug] GADDAG path: $GADDAG_PATH"
echo "[debug] Wrapper path: $WRAPPER_PATH"

# Step 1: Basic file analysis
echo ""
echo "=== STEP 1: File Analysis ==="
if [[ -f "$GADDAG_PATH" ]]; then
    echo "[debug] GADDAG file exists"
    echo "[debug] Size: $(stat -c%s "$GADDAG_PATH") bytes"
    echo "[debug] File type: $(file "$GADDAG_PATH")"
    echo "[debug] First 64 bytes (hex):"
    if command -v hexdump >/dev/null 2>&1; then
        head -c 64 "$GADDAG_PATH" | hexdump -C
    else
        echo "[debug] hexdump not available, showing first 32 bytes as od:"
        head -c 32 "$GADDAG_PATH" | od -t x1 -A x
    fi
else
    echo "[debug] ERROR: GADDAG file not found"
    exit 1
fi

# Step 2: Wrapper binary analysis
echo ""
echo "=== STEP 2: Binary Analysis ==="
echo "[debug] Wrapper file type: $(file "$WRAPPER_PATH")"
echo "[debug] Wrapper dependencies:"
ldd "$WRAPPER_PATH"

# Step 3: Environment check
echo ""
echo "=== STEP 3: Environment Check ==="
echo "[debug] QUACKLE_ALPHABET: ${QUACKLE_ALPHABET:-<not set>}"
if [[ -n "${QUACKLE_ALPHABET:-}" && -f "$QUACKLE_ALPHABET" ]]; then
    echo "[debug] Alphabet file exists: $(stat -c%s "$QUACKLE_ALPHABET") bytes"
else
    echo "[debug] Alphabet file missing or not set"
fi

# Step 4: Test with --check-gaddag mode
echo ""
echo "=== STEP 4: GADDAG Check Mode ==="
echo "[debug] Testing --check-gaddag mode..."
if timeout 10s "$WRAPPER_PATH" --check-gaddag "$GADDAG_PATH" 2>&1; then
    echo "[debug] ✓ GADDAG check passed"
else
    echo "[debug] ✗ GADDAG check failed (exit code: $?)"
fi

# Step 5: GDB backtrace
echo ""
echo "=== STEP 5: GDB Backtrace ==="
echo "[debug] Running with GDB to get backtrace..."
cat > /tmp/gdb_commands << 'EOF'
set logging file /tmp/gdb_output.log
set logging on
run --gaddag /app/lexica/enable1.gaddag --ruleset it
bt
quit
EOF

echo '{"op":"ping"}' | timeout 30s gdb -batch -x /tmp/gdb_commands "$WRAPPER_PATH" 2>&1 || true

if [[ -f /tmp/gdb_output.log ]]; then
    echo "[debug] GDB output:"
    cat /tmp/gdb_output.log
else
    echo "[debug] No GDB output generated"
fi

# Step 6: Valgrind analysis (if available and not too slow)
echo ""
echo "=== STEP 6: Valgrind Analysis (Quick) ==="
echo "[debug] Running quick valgrind check..."
echo '{"op":"ping"}' | timeout 60s valgrind --tool=memcheck --leak-check=no --track-origins=yes --max-stackframe=8388608 "$WRAPPER_PATH" --gaddag "$GADDAG_PATH" --ruleset it 2>&1 | head -50 || true

echo ""
echo "[debug] Debugging session completed"
echo "[debug] Check logs above for segfault cause"
