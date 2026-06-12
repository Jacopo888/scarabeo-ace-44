# service-quackle

Active FastAPI microservice for the strong Quackle bridge used by Tilesword.

Production service:

- `https://tilesword-quackle.onrender.com`

The frontend normally reaches it through the Render Static Site rewrite:

- `https://tilesword.onrender.com/api/quackle/*`

## Runtime Overview

Key endpoints:

- `GET /health` - readiness, bridge, lexicon, and strategy status
- `GET /health/cors` - effective CORS origins
- `POST /best-move` - strongest available move calculation
- `POST /bag/summary` - remaining bag summary
- `POST /debug/bridge-payload` - normalized payload sent to the C++ bridge
- `GET /debug/quackle` - bridge and runtime diagnostics

Board coordinates are 0-based end to end. The center square is `row=7`, `col=7`.

`/best-move` supports:

- `top_n` from 1 to 10
- explicit `bag_pool`
- hard-mode simulation when the bag is small
- endgame solver when the bag is empty

## Architecture

Main modules:

- `quackle_service/main.py` - FastAPI app bootstrap, CORS, lifespan
- `quackle_service/runtime.py` - lexicon and strategy readiness
- `quackle_service/normalization.py` - rack and board normalization
- `quackle_service/bridge_client.py` - native bridge subprocess boundary
- `quackle_service/routes_best_move.py` - best-move contract
- `quackle_service/routes_health.py` - health endpoints
- `quackle_service/routes_debug.py` - diagnostics
- `bridge/quackle_bridge.cpp` - C++ bridge against Quackle

The Docker image clones and builds `Jacopo888/quacklejacopo`, compiles `/srv/bridge/engine_wrapper`, and copies strategy data from the Quackle build into the image/runtime appdata path.

## Configuration

Important env vars:

- `CORS_ORIGINS` - comma-separated allowed origins for direct browser calls
- `QUACKLE_LEXDIR` - lexicon directory, default `/data/lexica`
- `QUACKLE_APPDATA_DIR` - strategy/appdata directory, default `/data/appdata`
- `QUACKLE_LEXICON` or `LEXICON_NAME` - default `enable1.15`
- `DAWG_URL` and `GADDAG_URL` - optional startup downloads for lexica
- `QUACKLE_TIMEOUT_MS` - bridge timeout, default `8000`
- `QUACKLE_BRIDGE_BIN` - override native bridge path
- `DEBUG_ENABLE_LDD` - enable `GET /debug/ldd`

Production lexicon example:

```sh
QUACKLE_LEXDIR=/data/lexica
QUACKLE_APPDATA_DIR=/data/appdata
LEXICON_NAME=enable1.15
QUACKLE_LEXICON=enable1.15
DAWG_URL=https://raw.githubusercontent.com/Jacopo888/quackle/master/data/lexica/enable1.15.dawg
GADDAG_URL=https://raw.githubusercontent.com/Jacopo888/quackle/master/data/lexica/enable1.15.gaddag
```

## Local Development

From the repository root:

```sh
docker compose up -d --build quackle-service
curl -s http://localhost:8080/health
```

Without the native engine, for Python-only tests:

```sh
cd service-quackle
python -m pip install -r requirements.txt pytest
QUACKLE_SKIP_LEXICON_CHECK=1 python -m pytest tests -q
```

## Repository Hygiene

Do not version:

- `.dawg` or `.gaddag` lexica
- generated strategy/appdata files
- compiled native bridge binaries
- `libquackle.a` or other build outputs
- copied Quackle `data/` trees

These are built, downloaded, mounted, or copied at runtime/build time.
