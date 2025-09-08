# ---------- STAGE 1: build wrapper + quackle ----------
FROM ubuntu:22.04 AS builder
SHELL ["/bin/bash", "-lc"]
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential cmake git ca-certificates pkg-config \
    # Qt5 + ICU + Boost per tool di build stile Colab (Piano C)
    qtbase5-dev qtchooser qtbase5-dev-tools \
    libicu-dev libboost-all-dev \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /src

# Porta dentro il submodule e compila la static lib
COPY third_party/quackle/ /src/third_party/quackle/
# Build della static lib del submodule in /src/third_party/quackle/build
RUN cmake -S /src/third_party/quackle -B /src/third_party/quackle/build \
 && cmake --build /src/third_party/quackle/build -j

# ==== costruisci SOLO makegaddag_tool (stile Colab) e genera GADDAG ====
# Copia la wordlist sorgente (testo, uppercase)
COPY lexica_src/enable1.txt /src/enable1.txt

# Step 8 — build e usa solo makegaddag
RUN set -euo pipefail; \
  cd /src/third_party/quackle; \
  LIB="$(find build -type f -name 'liblibquackle.a' | head -n1)"; \
  test -n "$LIB"; echo "Using lib: $LIB"; \
  INCS="-I/src/third_party/quackle \
        -I/src/third_party/quackle/include \
        -I/src/third_party/quackle/libquackle \
        -I/src/third_party/quackle/quackleio \
        -I/src/third_party/quackle/makegaddag \
        -I/src/third_party/quackle/src \
        -I/src/third_party/quackle/src/libquackle \
        -I/src/third_party/quackle/src/libquackle/include"; \
  ICU_CFLAGS="$(pkg-config --cflags icu-uc icu-i18n 2>/dev/null || true)"; \
  ICU_LIBS="$(pkg-config --libs   icu-uc icu-i18n 2>/dev/null || echo '-licuuc -licui18n')"; \
  QT_CFLAGS="$(pkg-config --cflags Qt5Core 2>/dev/null || true)"; \
  QT_LIBS="$(pkg-config --libs   Qt5Core   2>/dev/null || echo '-lQt5Core')"; \
  CXXFLAGS="-O3 -std=c++17 -fPIC"; \
  LATE_LIBS="-lpthread -lboost_regex -lboost_filesystem -lboost_system $ICU_LIBS $QT_LIBS"; \
  \
  mkdir -p /tmp/quackle_bin /tmp/quackle_obj; \
  mapfile -t QIO_CPP < <(find quackleio -maxdepth 1 -type f -name '*.cpp' | sort -u || true); \
  for must in gcgio.cpp dictfactory.cpp flexiblealphabetparameters.cpp alphabetparameters.cpp; do \
    [ -f "quackleio/$must" ] && QIO_CPP+=("quackleio/$must"); \
  done; \
  # De-dup
  readarray -t QIO_CPP < <(printf '%s\n' "${QIO_CPP[@]}" | awk 'NF && !x[$0]++'); \
  \
  # Compila mantenendo le sottocartelle e prepara lista OBJS
  OBJS=(); \
  for f in "${QIO_CPP[@]}"; do \
    out="/tmp/quackle_obj/${f%.cpp}.o"; \
    mkdir -p "$(dirname "$out")"; \
    g++ $CXXFLAGS $INCS $ICU_CFLAGS $QT_CFLAGS -c "$f" -o "$out"; \
    OBJS+=("$out"); \
  done; \
  # Main di makegaddag
  g++ $CXXFLAGS $INCS $ICU_CFLAGS $QT_CFLAGS -c makegaddag/makegaddag.cpp -o /tmp/quackle_obj/makegaddag_main.o; \
  \
  # Link finale (solo makegaddag)
  g++ /tmp/quackle_obj/makegaddag_main.o "${OBJS[@]}" "$LIB" -o /tmp/quackle_bin/makegaddag_tool $LATE_LIBS; \
  ls -lh /tmp/quackle_bin/makegaddag_tool; \
  \
  # Esecuzione: il tool vuole essere lanciato da makegaddag/ e usa nomi fissi
  cp -f /src/enable1.txt ./enable1.txt; \
  cd makegaddag; \
  ln -sf ../enable1.txt gaddaginput.raw; \
  /tmp/quackle_bin/makegaddag_tool 1>/tmp/gadd.stdout 2>/tmp/gadd.stderr || true; \
  echo '--- makegaddag stderr (tail) ---'; tail -n 60 /tmp/gadd.stderr || true; \
  test -s output.gaddag; \
  mkdir -p /out_lexica && cp -f output.gaddag /out_lexica/enable1.gaddag && ls -lh /out_lexica/enable1.gaddag

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


