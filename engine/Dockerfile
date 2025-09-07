# ---------- STAGE 1: build wrapper + quackle ----------
FROM ubuntu:22.04 AS builder
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential cmake git ca-certificates pkg-config \
    # dipendenze spesso richieste da quackle core
    libicu-dev libboost-all-dev \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /src

# Porta dentro il submodule e compila la static lib
COPY third_party/quackle/ /src/third_party/quackle/
# Build della static lib del submodule in /src/third_party/quackle/build
RUN cmake -S /src/third_party/quackle -B /src/third_party/quackle/build \
 && cmake --build /src/third_party/quackle/build -j

# Sanity check: esistenza di liblibquackle.a e struttura file (niente /src richiesto)
RUN test -f /src/third_party/quackle/build/liblibquackle.a
RUN ls -la /src/third_party/quackle | head -n 50

# Ora build del wrapper
COPY quackle_wrapper/ /src/quackle_wrapper/
RUN cmake -S /src/quackle_wrapper -B /build \
      -DQUACKLE_ROOT=/src/third_party/quackle \
      -DQUACKLE_BUILD_DIR=/src/third_party/quackle/build \
 && cmake --build /build -j
# Risultato atteso: /build/engine_wrapper

# ---------- STAGE 2: runtime ----------
FROM python:3.11-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080 \
    RULESET=it \
    GADDAG_PATH=/app/lexica/enable1.gaddag

RUN apt-get update && apt-get install -y --no-install-recommends \
    tini \
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
COPY scripts/verify_runtime.sh /app/scripts/verify_runtime.sh
RUN chmod +x /app/scripts/init_lexicon.sh /app/scripts/verify_runtime.sh \
 && /app/scripts/init_lexicon.sh \
 && /app/scripts/verify_runtime.sh

EXPOSE 8080
ENTRYPOINT ["/usr/bin/tini","--"]
CMD ["uvicorn","app.main:app","--host","0.0.0.0","--port","8080","--workers","1","--timeout-keep-alive","5"]


