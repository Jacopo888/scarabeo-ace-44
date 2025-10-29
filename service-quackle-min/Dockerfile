# Multi-stage Dockerfile (semplice) per service-quackle-min
# Stage 1: build quackle_json_wrapper
FROM debian:stable-slim AS builder
# Copiamo il wrapper custom nel contesto prima del clone così possiamo sovrascrivere quello upstream
COPY json_wrapper_main.cpp /build/json_wrapper_main.cpp
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential cmake ca-certificates git && rm -rf /var/lib/apt/lists/*
WORKDIR /build
ARG QUACKLE_REPO_URL=https://github.com/Jacopo888/quacklejacopo.git
ARG QUACKLE_REPO_REF=master
RUN set -eux; \
    echo "[builder] Clono $QUACKLE_REPO_URL (ref=$QUACKLE_REPO_REF)"; \
    git clone --depth=1 --branch "$QUACKLE_REPO_REF" "$QUACKLE_REPO_URL" quackle || (echo "[builder][warn] clone shallow fallito, provo full clone" && git clone "$QUACKLE_REPO_URL" quackle); \
    cd quackle; \
    echo "[builder] Sovrascrivo json_wrapper_main.cpp con versione custom se presente nello stage build context"; \
    if [ -f /build/json_wrapper_main.cpp ]; then cp /build/json_wrapper_main.cpp ./json_wrapper_main.cpp; fi; \
    test -f CMakeLists.txt; \
    # Patch wrapper per namespace (se manca) – aggiunge 'using namespace Quackle;' dopo l'ultimo include
    if grep -q 'json_wrapper_main.cpp' CMakeLists.txt && grep -q 'alphabetparameters.h' json_wrapper_main.cpp; then \
        grep -q 'using namespace Quackle;' json_wrapper_main.cpp || sed -i '/#include "strategyparameters.h"/a using namespace Quackle;' json_wrapper_main.cpp; \
    fi; \
    echo "[builder] Eseguo cmake"; \
    cmake -S . -B build -DCMAKE_BUILD_TYPE=Release; \
    echo "[builder] Compilo wrapper"; \
    cmake --build build -j"$(nproc)" --target quackle_json_wrapper; \
    ls -lh build/quackle_json_wrapper; \
    cp build/quackle_json_wrapper /build/

# Stage 2: prepare lexicon/strategy (optional download handled in runtime script)
FROM python:3.12-slim AS runtime
ENV PYTHONUNBUFFERED=1 \
    QUACKLE_LEXICON=enable1.15 \
    QUACKLE_LEXDIR=/data/lexica \
    QUACKLE_STRATEGY_DIR=/data/strategy \
    QUACKLE_ENGINE_BIN=/usr/local/bin/quackle_json_wrapper \
    CORS_ORIGINS=

RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copia codice servizio
COPY app ./app
COPY tests ./tests
COPY README.md ./
COPY TODO.md ./

# Copia binario dal builder
COPY --from=builder /build/quackle_json_wrapper /usr/local/bin/quackle_json_wrapper

# Directory dati e strategie: includiamo le strategie di Quackle nello strato runtime
RUN mkdir -p /usr/share/quackle/data/strategy
COPY --from=builder /build/quackle/data/strategy /usr/share/quackle/data/strategy
RUN mkdir -p /data/lexica /data/strategy && \
    cp -r /usr/share/quackle/data/strategy/* /data/strategy/
COPY scripts/bootstrap_lexicon.sh /usr/local/bin/bootstrap_lexicon.sh
RUN chmod +x /usr/local/bin/bootstrap_lexicon.sh

# Appdata strategies baked into image for subfolder builds
RUN mkdir -p /app/data/appdata/strategy
# Use repo-provided strategies when building from service-quackle-min context
COPY data/appdata/strategy /app/data/appdata/strategy
RUN chmod -R a+r /app/data/appdata/strategy

# Point runtime to appdata paths expected by BE
ENV QUACKLE_APPDATA_DIR=/app/data/appdata \
    QUACKLE_STRATEGY_DIR=/app/data/appdata/strategy

# Entrypoint: script con logging + exec uvicorn (aiuta il debug su Heroku "realloc(): invalid pointer")
ENV PYTHONFAULTHANDLER=1
COPY scripts/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD curl -fsS http://localhost:8000/health || exit 1
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
