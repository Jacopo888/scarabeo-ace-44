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

# ==== genera GADDAG compatibile con tool custom ====
# copia il tool custom
COPY tools/makegaddag/ /tmp/mkgtool/
# compila il tool contro liblibquackle.a già costruita
RUN cmake -S /tmp/mkgtool -B /tmp/mkg \
 -DQUACKLE_ROOT=/src/third_party/quackle \
 -DQUACKLE_BUILD_DIR=/src/third_party/quackle/build \
 && cmake --build /tmp/mkg -j
# genera il gaddag
COPY lexica_src/enable1.txt /tmp/enable1.txt
RUN /tmp/mkg/makegaddag /tmp/enable1.txt /tmp/enable1.gaddag \
 && test -s /tmp/enable1.gaddag
# esponi il gaddag generato allo stage runtime
RUN mkdir -p /out_lexica && cp /tmp/enable1.gaddag /out_lexica/enable1.gaddag

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

# copia wrapper e lexicon generato baked-in
RUN mkdir -p /app/bin /app/lexica
COPY --from=builder /build/engine_wrapper /app/bin/engine_wrapper
COPY --from=builder /out_lexica/enable1.gaddag /app/lexica/enable1.gaddag

ENV GADDAG_PATH=/app/lexica/enable1.gaddag

# Sanity check: il wrapper deve rispondere (fail-fast se crasha)
RUN /app/bin/engine_wrapper --gaddag /app/lexica/enable1.gaddag --ruleset it <<<'{"op":"ping"}' >/dev/null \
 && /app/bin/engine_wrapper --gaddag /app/lexica/enable1.gaddag --ruleset it <<<'{"op":"probe_lexicon"}' >/dev/null

COPY scripts/init_lexicon.sh /app/scripts/init_lexicon.sh
COPY scripts/verify_runtime.sh /app/scripts/verify_runtime.sh
RUN chmod +x /app/scripts/init_lexicon.sh /app/scripts/verify_runtime.sh \
 && /app/scripts/init_lexicon.sh \
 && /app/scripts/verify_runtime.sh

EXPOSE 8080
ENTRYPOINT ["/usr/bin/tini","--"]
CMD ["uvicorn","app.main:app","--host","0.0.0.0","--port","8080","--workers","1","--timeout-keep-alive","5"]


