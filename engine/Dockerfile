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
RUN cmake -S /src/third_party/quackle -B /src/third_party/quackle/build -DCMAKE_BUILD_TYPE=RelWithDebInfo \
 && cmake --build /src/third_party/quackle/build -j

# ==== costruisci SOLO makegaddag_tool (stile Colab) e genera GADDAG ====
# Copia la wordlist sorgente (testo, uppercase)
COPY lexica_src/enable1.txt /src/enable1.txt

# Manually build makegaddag_tool (no CMake target provided upstream)
RUN set -euo pipefail; \
  cd /src/third_party/quackle; \
  LIB="$(find /src/third_party/quackle/build -type f -name 'liblibquackle.a' | head -n1)"; \
  test -n "$LIB"; echo "Using lib: $LIB"; \
  INCS="-I/src/third_party/quackle -I/src/third_party/quackle/include -I/src/third_party/quackle/libquackle -I/src/third_party/quackle/quackleio -I/src/third_party/quackle/makegaddag -I/src/third_party/quackle/src -I/src/third_party/quackle/src/libquackle -I/src/third_party/quackle/src/libquackle/include"; \
  ICU_CFLAGS="$(pkg-config --cflags icu-uc icu-i18n 2>/dev/null || true)"; \
  ICU_LIBS="$(pkg-config --libs   icu-uc icu-i18n 2>/dev/null || echo '-licuuc -licui18n')"; \
  QT_CFLAGS="$(pkg-config --cflags Qt5Core 2>/dev/null || true)"; \
  QT_LIBS="$(pkg-config --libs   Qt5Core   2>/dev/null || echo '-lQt5Core')"; \
  CXXFLAGS="-O3 -std=c++17 -fPIC"; \
  LATE_LIBS="-lpthread -lboost_regex -lboost_filesystem -lboost_system $ICU_LIBS $QT_LIBS"; \
  mkdir -p /tmp/quackle_bin /tmp/quackle_obj; \
  QIO_SRCS="quackleio/dawgfactory.cpp quackleio/dict.cpp quackleio/dictfactory.cpp quackleio/dictimplementation.cpp quackleio/flexiblealphabet.cpp quackleio/froggetopt.cpp quackleio/gaddagfactory.cpp quackleio/gcgio.cpp quackleio/queenie.cpp quackleio/streamingreporter.cpp quackleio/util.cpp alphabetparameters.cpp"; \
  for f in $QIO_SRCS; do \
    base="$(basename "$f" .cpp)"; \
    g++ $CXXFLAGS $INCS $ICU_CFLAGS $QT_CFLAGS -c "$f" -o "/tmp/quackle_obj/${base}.o"; \
  done; \
  g++ $CXXFLAGS $INCS $ICU_CFLAGS $QT_CFLAGS -c makegaddag/makegaddag.cpp -o /tmp/quackle_obj/makegaddag_main.o; \
  OBJS=$(ls /tmp/quackle_obj/*.o | grep -v 'makegaddag_main.o' || true); \
  g++ /tmp/quackle_obj/makegaddag_main.o $OBJS "$LIB" -o /tmp/quackle_bin/makegaddag_tool $LATE_LIBS; \
  ls -lh /tmp/quackle_bin/makegaddag_tool; \
  # Generate the GADDAG
  mkdir -p /tmp/lexicon_build; \
  cp -f /src/enable1.txt /tmp/lexicon_build/wordlist.txt; \
  cd /src/third_party/quackle/makegaddag; \
  ln -sf /tmp/lexicon_build/wordlist.txt gaddaginput.raw; \
  /tmp/quackle_bin/makegaddag_tool 1>/tmp/gadd.stdout 2>/tmp/gadd.stderr || true; \
  echo "=== GADDAG Generation Output ==="; \
  echo "stdout:"; tail -n +1 /tmp/gadd.stdout || true; \
  echo "stderr:"; tail -n +1 /tmp/gadd.stderr || true; \
  if [ -f "output.gaddag" ] && [ -s "output.gaddag" ]; then \
    echo "GADDAG generated successfully"; \
    ls -lh output.gaddag; \
    mkdir -p /out_lexica && cp -f output.gaddag /out_lexica/enable1.gaddag; \
  else \
    echo "FATAL: GADDAG generation failed (manual tool)"; \
    exit 1; \
  fi; \
  echo "Final GADDAG:"; ls -lh /out_lexica/enable1.gaddag;

  # DAWG generation removed to enforce GADDAG-only per constraints

# Sanity check: esistenza di liblibquackle.a e struttura file (niente /src richiesto)
RUN test -f /src/third_party/quackle/build/liblibquackle.a
RUN ls -la /src/third_party/quackle | head -n 50

# Ora build del wrapper
COPY quackle_wrapper/ /src/quackle_wrapper/
RUN cmake -S /src/quackle_wrapper -B /build \
      -DQUACKLE_ROOT=/src/third_party/quackle \
      -DQUACKLE_BUILD_DIR=/src/third_party/quackle/build \
      -DCMAKE_BUILD_TYPE=RelWithDebInfo \
      -DCMAKE_CXX_FLAGS="-g -O2 -DNDEBUG" \
 && cmake --build /build -j \
 && echo "Wrapper built with debug symbols for diagnostics"

# Build-time smoke test disabled: will test in runtime stage
# RUN echo '{"op":"ping"}' | timeout 10s /build/engine_wrapper --gaddag /out_lexica/enable1.gaddag --ruleset it
# Risultato atteso: /build/engine_wrapper

# ---------- STAGE 2: runtime ----------
FROM ubuntu:22.04 AS runtime
SHELL ["/bin/bash","-lc"]

# Install Python 3.10 (default on Ubuntu 22.04) and minimal dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    tini \
    libstdc++6 \
    ca-certificates \
 && rm -rf /var/lib/apt/lists/*
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080 \
    RULESET=it \
    GADDAG_PATH=/app/lexica/enable1.gaddag

# Essential runtime libs for Quackle (exact Ubuntu 22.04 packages)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libqt5core5a \
    libicu70 \
    libstdc++6 \
    libgcc-s1 \
    libboost-regex1.74.0 \
    libboost-filesystem1.74.0 \
    libboost-system1.74.0 \
    util-linux \
    gdb \
    file \
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
# No DAWG runtime copy (GADDAG-only)

# bring the alphabet file to runtime (many loaders expect it around)
RUN mkdir -p /app/alphabets
COPY --from=builder /src/third_party/quackle/data/alphabets/english.quackle_alphabet /app/alphabets/english.quackle_alphabet
ENV QUACKLE_ALPHABET=/app/alphabets/english.quackle_alphabet
COPY --from=builder /src/third_party/quackle/data /usr/share/quackle/data
ENV QUACKLE_APPDATA_DIR=/usr/share/quackle/data

ENV GADDAG_PATH=/app/lexica/enable1.gaddag

# Sanity check: verifica solo che il file GADDAG esista e non sia vuoto
RUN test -s /app/lexica/enable1.gaddag && ls -lh /app/lexica/enable1.gaddag

COPY scripts/init_lexicon.sh /app/scripts/init_lexicon.sh
COPY scripts/verify_runtime.sh /app/scripts/verify_runtime.sh
COPY scripts/route_discovery.sh /app/scripts/route_discovery.sh
COPY scripts/exec_ping.sh       /app/scripts/exec_ping.sh
COPY scripts/debug_gaddag.sh    /app/scripts/debug_gaddag.sh
COPY scripts/smoke_test.sh      /app/scripts/smoke_test.sh

# Critical smoke test: must load GADDAG and answer ping; fail build otherwise
RUN chmod +x /app/scripts/*.sh \
 && /app/scripts/init_lexicon.sh \
 && /app/scripts/verify_runtime.sh \
 && echo "=== CRITICAL SMOKE TEST: GADDAG must load and respond to ping ===" \
 && timeout 30s bash -c 'echo '\''{"op":"ping"}'\'' | /app/bin/engine_wrapper --gaddag /app/lexica/enable1.gaddag --ruleset it' \
 && echo "✓ GADDAG SMOKE TEST PASSED"

EXPOSE 8080
ENTRYPOINT ["/usr/bin/tini","--"]
CMD ["python3", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1", "--timeout-keep-alive", "5"]


