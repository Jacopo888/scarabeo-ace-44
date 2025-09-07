# ---------- STAGE 1: build wrapper ----------
FROM ubuntu:22.04 AS builder
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential cmake git ca-certificates \
    libboost-all-dev libicu-dev \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /src

# Copy Quackle submodule and build it (core, no Qt UI)
COPY third_party/quackle/ /src/third_party/quackle/
RUN mkdir -p /src/third_party/quackle/build && \
    cd /src/third_party/quackle/build && \
    cmake -DCMAKE_BUILD_TYPE=Release .. && \
    cmake --build . -j

# Build wrapper linking static libquackle
COPY quackle_wrapper/ ./quackle_wrapper/
RUN cmake -S quackle_wrapper -B /build -DQUACKLE_ROOT=/src/third_party/quackle -DQUACKLE_BUILD_DIR=/src/third_party/quackle/build && \
    cmake --build /build -j
# wrapper risultante: /build/engine_wrapper

# ---------- STAGE 2: runtime ----------
FROM python:3.11-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080 \
    RULESET=it \
    GADDAG_PATH=/app/lexica/enable1.gaddag

# dipendenze base
RUN apt-get update && apt-get install -y --no-install-recommends \
    tini libicu67 libboost-system1.74.0 libboost-filesystem1.74.0 libboost-regex1.74.0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# app python
COPY pyproject.toml /app/pyproject.toml
RUN pip install --no-cache-dir -e .
COPY app/ /app/app/

# copia wrapper e lexicon baked-in
RUN mkdir -p /app/bin /app/lexica
COPY --from=builder /build/engine_wrapper /app/bin/engine_wrapper
# >>> IMPORTANTISSIMO: copia qui il tuo .gaddag prima del build della image
# Per esempio, se hai engine/lexica/enable1.gaddag nel repo:
COPY lexica/ /app/lexica/

COPY scripts/init_lexicon.sh /app/scripts/init_lexicon.sh
RUN chmod +x /app/scripts/init_lexicon.sh && /app/scripts/init_lexicon.sh

EXPOSE 8080
ENTRYPOINT ["/usr/bin/tini","--"]
CMD ["uvicorn","app.main:app","--host","0.0.0.0","--port","8080","--workers","1","--timeout-keep-alive","5"]


