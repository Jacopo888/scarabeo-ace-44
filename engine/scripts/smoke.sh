#!/usr/bin/env bash
set -euo pipefail

# Comprehensive smoke test for Quackle engine
# Tests build, deployment, health checks, and move generation

CONTAINER_NAME="scarabeo-engine-test"
IMAGE_NAME="scarabeo-engine:real"
PORT="8080"
MAX_RETRIES=30
RETRY_DELAY=2

echo "[smoke] Starting comprehensive Quackle engine smoke test"

# Cleanup function
cleanup() {
    echo "[smoke] Cleaning up..."
    docker stop "$CONTAINER_NAME" 2>/dev/null || true
    docker rm "$CONTAINER_NAME" 2>/dev/null || true
}
trap cleanup EXIT

# Step 1: Build the image
echo "[smoke] Building Docker image..."
if ! docker build -t "$IMAGE_NAME" -f engine/Dockerfile engine; then
    echo "[smoke] FAIL: Docker build failed"
    exit 1
fi
echo "[smoke] ✓ Docker build successful"

# Step 2: Start container
echo "[smoke] Starting container..."
cleanup # Ensure clean state
docker run -d --rm --name "$CONTAINER_NAME" -p "$PORT:$PORT" "$IMAGE_NAME"

# Step 3: Wait for container to be ready
echo "[smoke] Waiting for container to be ready..."
for i in $(seq 1 $MAX_RETRIES); do
    if curl -sf "http://localhost:$PORT/healthz" >/dev/null 2>&1; then
        echo "[smoke] ✓ Container is responding"
        break
    fi
    if [ $i -eq $MAX_RETRIES ]; then
        echo "[smoke] FAIL: Container not ready after $((MAX_RETRIES * RETRY_DELAY))s"
        docker logs "$CONTAINER_NAME" | tail -20
        exit 1
    fi
    sleep $RETRY_DELAY
done

# Step 4: Test health endpoints
echo "[smoke] Testing health endpoints..."

# Basic health
HEALTH=$(curl -s "http://localhost:$PORT/healthz" | jq -r '.ok // false')
if [ "$HEALTH" != "true" ]; then
    echo "[smoke] FAIL: /healthz returned: $HEALTH"
    exit 1
fi
echo "[smoke] ✓ /healthz: OK"

# Engine health  
ENGINE_HEALTH=$(curl -s "http://localhost:$PORT/health/engine" | jq -r '.ok // false')
if [ "$ENGINE_HEALTH" != "true" ]; then
    echo "[smoke] FAIL: /health/engine returned: $ENGINE_HEALTH"
    docker logs "$CONTAINER_NAME" | tail -10
    exit 1
fi
echo "[smoke] ✓ /health/engine: OK"

# Lexicon health
LEXICON_HEALTH=$(curl -s "http://localhost:$PORT/health/lexicon" | jq -r '.lexicon_ok // false')
if [ "$LEXICON_HEALTH" != "true" ]; then
    echo "[smoke] FAIL: /health/lexicon returned: $LEXICON_HEALTH"
    curl -s "http://localhost:$PORT/health/lexicon" | jq .
    exit 1
fi
echo "[smoke] ✓ /health/lexicon: OK"

# Step 5: Test engine commands
echo "[smoke] Testing engine commands..."

# Ping test
PING_RESULT=$(curl -s -X POST "http://localhost:$PORT/engine/cmd" \
    -H 'content-type: application/json' \
    -d '{"op":"ping"}' | jq -r '.pong // false')

if [ "$PING_RESULT" != "true" ]; then
    echo "[smoke] FAIL: ping command failed: $PING_RESULT"
    exit 1
fi
echo "[smoke] ✓ ping command: OK"

# Probe lexicon test
PROBE_RESULT=$(curl -s -X POST "http://localhost:$PORT/engine/cmd" \
    -H 'content-type: application/json' \
    -d '{"op":"probe_lexicon"}' | jq -r '.lexicon_ok // false')

if [ "$PROBE_RESULT" != "true" ]; then
    echo "[smoke] FAIL: probe_lexicon command failed: $PROBE_RESULT"
    exit 1
fi
echo "[smoke] ✓ probe_lexicon command: OK"

# Step 6: Test move generation
echo "[smoke] Testing move generation..."

MOVE_RESULT=$(curl -s -X POST "http://localhost:$PORT/engine/move" \
    -H 'content-type: application/json' \
    -d '{"rack":"ABCDEFG"}')

MOVE_SUCCESS=$(echo "$MOVE_RESULT" | jq -r '.success // false')
if [ "$MOVE_SUCCESS" != "true" ]; then
    echo "[smoke] FAIL: move generation failed"
    echo "$MOVE_RESULT" | jq .
    exit 1
fi

MOVE_WORD=$(echo "$MOVE_RESULT" | jq -r '.move.word // ""')
MOVE_SCORE=$(echo "$MOVE_RESULT" | jq -r '.move.score // 0')

if [ -z "$MOVE_WORD" ] || [ "$MOVE_SCORE" -eq 0 ]; then
    echo "[smoke] FAIL: invalid move generated"
    echo "$MOVE_RESULT" | jq .
    exit 1
fi

echo "[smoke] ✓ move generation: OK (word: $MOVE_WORD, score: $MOVE_SCORE)"

# Step 7: Performance test
echo "[smoke] Testing response times..."
START_TIME=$(date +%s%N)
curl -s -X POST "http://localhost:$PORT/engine/cmd" \
    -H 'content-type: application/json' \
    -d '{"op":"ping"}' >/dev/null
END_TIME=$(date +%s%N)
RESPONSE_TIME_MS=$(( (END_TIME - START_TIME) / 1000000 ))

if [ $RESPONSE_TIME_MS -gt 1000 ]; then
    echo "[smoke] WARN: slow response time: ${RESPONSE_TIME_MS}ms"
else
    echo "[smoke] ✓ response time: ${RESPONSE_TIME_MS}ms"
fi

# Step 8: Final validation
echo "[smoke] Running final validation..."
docker exec "$CONTAINER_NAME" /app/scripts/exec_ping.sh >/dev/null 2>&1
echo "[smoke] ✓ direct wrapper execution: OK"

echo ""
echo "[smoke] 🎉 ALL TESTS PASSED!"
echo "[smoke] Engine is ready for production use"
echo "[smoke] Container: $CONTAINER_NAME"
echo "[smoke] Port: $PORT"
echo "[smoke] Image: $IMAGE_NAME"
echo ""
echo "Available endpoints:"
echo "  GET  /healthz"
echo "  GET  /health/engine"  
echo "  GET  /health/lexicon"
echo "  POST /engine/cmd"
echo "  POST /engine/move"
echo "  POST /api/v1/move"
