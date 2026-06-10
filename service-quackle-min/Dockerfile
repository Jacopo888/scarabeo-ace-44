# Multi-stage Dockerfile (semplice) per service-quackle-min
# Stage 1: build quackle_json_wrapper
FROM debian:stable-slim AS builder
# Copiamo il wrapper custom nel contesto prima del clone così possiamo sovrascrivere quello upstream
COPY json_wrapper_main.cpp /build/json_wrapper_main.cpp
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential cmake ca-certificates git && rm -rf /var/lib/apt/lists/*
WORKDIR /build
ARG QUACKLE_REPO_URL=https://github.com/Jacopo888/quacklejacopo.git
ARG QUACKLE_REPO_REF=d280e6760f06b52dd8b8baf18c9bf152492c230d
ARG QUACKLE_REPO_FETCH_REF=master
RUN set -eux; \
    echo "[builder] Clono $QUACKLE_REPO_URL (ref=$QUACKLE_REPO_REF, fetch_ref=$QUACKLE_REPO_FETCH_REF)"; \
    git init quackle; \
    cd quackle; \
    git remote add origin "$QUACKLE_REPO_URL"; \
    if git fetch --depth=1 origin "$QUACKLE_REPO_REF"; then \
        git checkout --detach FETCH_HEAD; \
    else \
        echo "[builder][warn] fetch diretto del ref fallito; scarico $QUACKLE_REPO_FETCH_REF e checkout del ref richiesto"; \
        git fetch --depth=1 origin "$QUACKLE_REPO_FETCH_REF"; \
        git checkout --detach "$QUACKLE_REPO_REF"; \
    fi; \
    echo "[builder] Quackle checkout $(git rev-parse HEAD)"; \
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
    QUACKLE_STRATEGY_DIR=/data/appdata/strategy \
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

# Strategia: bake nello slug
RUN mkdir -p /data/appdata/strategy
COPY ./data/appdata/strategy /data/appdata/strategy
RUN chmod -R a+r /data/appdata/strategy

# Lessici: cartella scrivibile a runtime
RUN mkdir -p /data/lexica
COPY scripts/bootstrap_lexicon.sh /usr/local/bin/bootstrap_lexicon.sh
RUN chmod +x /usr/local/bin/bootstrap_lexicon.sh

# Percorsi target nello slug
# (copia già effettuata sopra in /data/appdata/strategy; qui solo ENV coerenti)
ENV QUACKLE_APPDATA_DIR=/data/appdata \
    QUACKLE_STRATEGY_DIR=/data/appdata/strategy \
    QUACKLE_LEXDIR=/data/lexica \
    QUACKLE_LEXICON=enable1.15

# Entrypoint: script con logging + exec uvicorn (aiuta il debug su Heroku "realloc(): invalid pointer")
ENV PYTHONFAULTHANDLER=1
COPY scripts/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD curl -fsS http://localhost:8000/health || exit 1
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
