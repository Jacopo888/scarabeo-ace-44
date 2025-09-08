# Scarabeo Engine (Automated Quackle Pipeline)

## Overview

This engine provides a complete Scrabble/Scarabeo move generation service using the Quackle library. The build pipeline automatically:

- Compiles Quackle core libraries (libquackle, quackleio) 
- Generates GADDAG dictionary from wordlist using `makegaddag`
- Builds C++ wrapper with robust error handling
- Provides FastAPI endpoints for move generation and health checks
- Includes comprehensive smoke testing

## Architecture

- **Multi-stage Docker build**: Builder stage compiles Quackle + generates GADDAG, runtime stage runs the service
- **GADDAG format**: Uses Quackle's versioned GADDAG format with MD5 integrity checks
- **Alphabet support**: Includes English alphabet file for proper character mapping
- **Runtime libraries**: Qt5Core, ICU, Boost for GADDAG loading
- **Persistent wrapper**: FastAPI maintains long-running wrapper process for performance

## Quick Start

### Automated Build & Test (Recommended)
```bash
# Run comprehensive smoke test
./engine/scripts/smoke.sh
```

This script will:
1. Build the Docker image with full Quackle integration
2. Start the container and wait for readiness
3. Test all health endpoints
4. Verify move generation works
5. Validate response times
6. Report success/failure with detailed diagnostics

### Manual Build & Run
```bash
# Build with full Quackle integration
docker build -t scarabeo-engine:real -f engine/Dockerfile engine

# Run with health monitoring
docker run -d --rm --name scarabeo-engine -p 8080:8080 scarabeo-engine:real

# Test health endpoints
curl -s http://localhost:8080/healthz | jq .
curl -s http://localhost:8080/health/engine | jq .
curl -s http://localhost:8080/health/lexicon | jq .
```

## API Endpoints

### Health & Status
- `GET /healthz` - Basic service health
- `GET /health/engine` - Wrapper process health  
- `GET /health/lexicon` - GADDAG loading status

### Move Generation
- `POST /engine/cmd` - Direct wrapper command interface
- `POST /engine/move` - Simplified move generation for testing
- `POST /api/v1/move` - Full Scrabble API (MoveRequest/MoveResponse)

### Example Usage

#### Test Engine Commands
```bash
# Ping the wrapper
curl -X POST http://localhost:8080/engine/cmd \
  -H 'content-type: application/json' \
  -d '{"op":"ping"}'

# Check lexicon status  
curl -X POST http://localhost:8080/engine/cmd \
  -H 'content-type: application/json' \
  -d '{"op":"probe_lexicon"}'
```

#### Generate Moves
```bash
# Simple move generation
curl -X POST http://localhost:8080/engine/move \
  -H 'content-type: application/json' \
  -d '{"rack":"ABCDEFG"}' | jq .

# Full API with custom board
curl -X POST http://localhost:8080/api/v1/move \
  -H 'content-type: application/json' \
  -d '{
    "board": [["" for _ in range(15)] for _ in range(15)],
    "rack": "CIAOXYZ",
    "bag": "",
    "turn": "me", 
    "limit_ms": 1000,
    "ruleset": "it",
    "top_n": 5
  }' | jq .
```

## Technical Details

### GADDAG Generation Pipeline
1. **Wordlist**: `lexica_src/enable1.txt` (172K+ words, uppercase)
2. **Build tools**: `makegaddag` compiled with same Quackle version as runtime
3. **Output**: `enable1.gaddag` (~17MB) with MD5 integrity checks
4. **Validation**: Build-time smoke test ensures GADDAG loads without segfault

### Quackle Integration
- **Version compatibility**: Builder and runtime use identical Quackle commit
- **Compilation flags**: `-fPIC`, `QUACKLE_NO_QT`, C++17 standard
- **Dependencies**: Qt5Core, ICU (Unicode), Boost (regex/filesystem/system)
- **Memory**: Static linking of libquackle (~5MB), persistent GADDAG in memory

### Error Handling
- **Segfault protection**: Wrapper validates GADDAG before loading
- **Timeout handling**: Cooperative cancellation with std::async/future
- **Health monitoring**: Continuous stderr logging and process monitoring
- **Graceful degradation**: Clear error messages instead of crashes

## Troubleshooting

### Build Issues
```bash
# Check Quackle submodule
git submodule update --init --recursive

# Verify build dependencies
docker build --target builder -t debug-builder -f engine/Dockerfile engine
docker run -it debug-builder bash
```

### Runtime Issues  
```bash
# Check wrapper directly
docker exec -it scarabeo-engine /app/scripts/exec_ping.sh

# Examine logs
docker logs scarabeo-engine | grep wrapper

# Validate GADDAG
docker run -e RUN_GADDAG_CHECK=1 scarabeo-engine:real
```

### Performance Tuning
- **GADDAG vs DAWG**: GADDAG is ~2x faster but ~5x larger than DAWG
- **Memory usage**: ~50MB runtime (20MB GADDAG + 30MB overhead)
- **Response times**: <100ms for simple moves, <1s for complex positions
- **Concurrency**: Single wrapper process, FastAPI handles multiple requests

## Deploy Railway

- Configure repo with `engine/` and enable Dockerfile deployment
- **No volumes required**: Lexicon baked into image  
- Set environment variables:
  - `RULESET=it` (or `en`)
  - `GADDAG_PATH=/app/lexica/enable1.gaddag`
  - `RUN_GADDAG_CHECK=1` (optional startup validation)

## Development Notes

### Build Invariants
- Quackle submodule must be initialized: `git submodule update --init --recursive`
- Same Quackle version used for makegaddag and libquackle compilation
- English alphabet file copied to `/app/alphabets/english.quackle_alphabet`
- Runtime libraries (Qt5, ICU, Boost) installed in both builder and runtime stages

### File Structure
```
engine/
├── Dockerfile              # Multi-stage build with Quackle integration
├── app/main.py             # FastAPI service with persistent wrapper
├── quackle_wrapper/        # C++ wrapper with error handling
├── lexica_src/enable1.txt  # Source wordlist for GADDAG generation
├── scripts/smoke.sh        # Comprehensive test suite
└── README.md               # This file
```

### Memory & Size Trade-offs
- **GADDAG**: Fast move generation (~2x DAWG speed), large memory (~5x DAWG size)
- **Static linking**: Eliminates runtime dependency issues, increases binary size
- **Persistent process**: Faster response times, higher memory usage
- **Alphabet files**: Required for proper character mapping, minimal size impact

For questions or issues, run the smoke test first: `./engine/scripts/smoke.sh`