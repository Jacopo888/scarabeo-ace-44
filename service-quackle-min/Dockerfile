# Multi-stage Dockerfile (semplice) per service-quackle-min
# Stage 1: build quackle_json_wrapper
FROM debian:stable-slim AS builder
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential cmake git ca-certificates curl && rm -rf /var/lib/apt/lists/*
WORKDIR /build
COPY ../../quacklejacopo /build/quackle
WORKDIR /build/quackle
RUN cmake . -DCMAKE_BUILD_TYPE=Release && make -j$(nproc) quackle_json_wrapper

# Stage 2: prepare lexicon/strategy (optional download handled in runtime script)
FROM python:3.12-slim AS runtime
ENV PYTHONUNBUFFERED=1 \
    QUACKLE_LEXICON=enable1.15 \
    QUACKLE_LEXDIR=/data/lexica \
    QUACKLE_STRATEGY_DIR=/data/strategy \
    QUACKLE_ENGINE_BIN=/usr/local/bin/quackle_json_wrapper

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
COPY --from=builder /build/quackle/quackle_json_wrapper /usr/local/bin/quackle_json_wrapper

# Directory dati
RUN mkdir -p /data/lexica /data/strategy
COPY scripts/bootstrap_lexicon.sh /usr/local/bin/bootstrap_lexicon.sh
RUN chmod +x /usr/local/bin/bootstrap_lexicon.sh

# Entrypoint: bootstrap lessico poi avvia uvicorn
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD curl -fsS http://localhost:8000/health || exit 1
ENTRYPOINT ["/bin/sh","-c","/usr/local/bin/bootstrap_lexicon.sh && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
