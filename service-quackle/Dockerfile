# BASE Python + toolchain
FROM python:3.13-slim
ARG BUILD_FORCE="v104-debug-4"
ARG QUACKLE_REPO_URL="https://github.com/Jacopo888/quacklejacopo.git"
ARG QUACKLE_REPO_BRANCH="master"
ARG MAKE_JOBS=2
ENV BUILD_FORCE=${BUILD_FORCE}
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Dipendenze native per compilare Quackle e il bridge
RUN apt-get update && apt-get install -y \
    build-essential cmake git \
    libboost-all-dev libicu-dev python3-dev \
    nlohmann-json3-dev curl rsync \
    qt5-qmake qtbase5-dev \
    && rm -rf /var/lib/apt/lists/*

# Cartelle dati quackle (nota: lexica runtime via volume /data, non baked-in)
RUN mkdir -p /usr/share/quackle/lexica

# Clona e compila Quackle v1.0.4 (versione stabile) con tutti gli strumenti
# Cache buster for makegaddag compilation - v4
RUN git clone --depth=1 --branch ${QUACKLE_REPO_BRANCH} ${QUACKLE_REPO_URL} /tmp/quackle && \
    cd /tmp/quackle && mkdir -p build && cd build && \
    cmake -DCMAKE_BUILD_TYPE=Release .. && \
    make -j"${MAKE_JOBS}" && \
    # Prima compila quackleio separatamente
    cd /tmp/quackle && \
    echo "Compilando quackleio..." && \
    cd quackleio && \
    qmake quackleio.pro && \
    make && \
    echo "quackleio compilato con successo" && \
    # Crea link simbolici per le librerie nei percorsi che makegaddag si aspetta
    cd /tmp/quackle && \
    mkdir -p lib/release && \
    mkdir -p quackleio/lib/release && \
    # Debug: vediamo dove sono effettivamente le librerie
    echo "=== DEBUG: Cercando librerie ===" && \
    find . -name "*.a" -type f && \
    echo "=== Fine DEBUG ===" && \
    # Crea i link attesi dal progetto qmake (lib/release e quackleio/lib/release)
    ln -sf ../../build/liblibquackle.a lib/release/libquackle.a && \
    # Compila makegaddag con qmake (link corretto contro libquackle e quackleio)
    echo "Compilando makegaddag con qmake..." && \
    cd /tmp/quackle/makegaddag && \
    qmake makegaddag.pro && \
    make && \
    install -m 0755 ./makegaddag /usr/local/bin/makegaddag && \
    echo "makegaddag compilato con successo"

# Imposta la working directory per le istruzioni successive
WORKDIR /srv

# Compila il vero bridge C++ linkando la libquackle 
COPY bridge/quackle_bridge.cpp /srv/bridge/quackle_bridge.cpp
COPY bridge/include /srv/bridge/include
RUN LIBQ=$(find /tmp/quackle/build \( -name "libquackle.a" -o -name "liblibquackle.a" \) -print -quit) && \
    [ -n "$LIBQ" ] || { echo "libquackle library not found"; exit 1; } && \
    echo "Using libquackle at: $LIBQ" && \
        g++ -O2 -DNDEBUG -fno-omit-frame-pointer -std=c++17 -Wall -Wextra -Wpedantic \
      -I/tmp/quackle \
      -I/tmp/quackle/src/libquackle/include \
      -I/tmp/quackle/src/libquackle \
    -I/tmp/quackle/src \
    -I/srv/bridge \
      /srv/bridge/quackle_bridge.cpp \
      "$LIBQ" \
      -o /srv/bridge/engine_wrapper \
      -lboost_system -lboost_filesystem -lboost_regex \
      -licuuc -licui18n -lpthread && \
    chmod +x /srv/bridge/engine_wrapper && \
    echo "Bridge compiled successfully at /srv/bridge/engine_wrapper"

## Note: The bridge is built without ASan. If you want AddressSanitizer
## in a debug image, add -fsanitize=address at compile time AND install
## the matching libasan runtime in the image. We keep the runtime clean.

# Copia dati (alphabets, strategy) nell'immagine dalla build di Quackle
RUN mkdir -p /usr/share/quackle/data && \
    cp -r /tmp/quackle/data/* /usr/share/quackle/data/ && \
    # Non includere i lessici baked-in: volume-first o download runtime
    rm -rf /usr/share/quackle/data/lexica || true

# --- Strategia: garantire dati presenti in appdata ---
RUN set -eux; \
    mkdir -p /usr/share/quackle/data/strategy/default_english /usr/share/quackle/data/strategy/default; \
    # (i file dovrebbero essere già presenti da /tmp/quackle/data/* -> /usr/share/quackle/data)
    # Copia in appdata per runtime R/W:
    mkdir -p /data/appdata/strategy/default_english /data/appdata/strategy/default; \
    for f in syn2 vcplace superleaves worths; do \
        if [ -f "/usr/share/quackle/data/strategy/default_english/$f" ]; then \
            cp -f "/usr/share/quackle/data/strategy/default_english/$f" "/data/appdata/strategy/default_english/$f"; \
        fi; \
    done; \
    if [ -f "/usr/share/quackle/data/strategy/default/bogowin" ]; then \
        cp -f "/usr/share/quackle/data/strategy/default/bogowin" "/data/appdata/strategy/default/bogowin"; \
    fi; \
    # Permessi leggibili dal runtime non-root:
    chmod -R a+rX /usr/share/quackle/data /data/appdata/strategy

# Rimuovi i sorgenti temporanei
RUN rm -rf /tmp/quackle

# Installazione dipendenze Python e codice FastAPI
COPY requirements.txt /srv/requirements.txt
RUN pip install --no-cache-dir -r /srv/requirements.txt
COPY quackle_service /srv/quackle_service

# Variabili di default (modificabili in deploy)
ENV CORS_ORIGINS="https://tilesword.onrender.com,https://tilesword-quackle.onrender.com,http://localhost:5173,http://127.0.0.1:5173"
ENV QUACKLE_LEXICON="enable1.15"
ENV QUACKLE_LEXDIR="/data/lexica"
ENV QUACKLE_APPDATA_DIR="/data/appdata"
ENV LEXICON_NAME="enable1.15"

# Nota: Nessun lessico baked-in. I file saranno forniti via volume /data/lexica o
# scaricati a runtime tramite le variabili GADDAG_URL/DAWG_URL.

# Entrypoint
COPY entrypoint.sh /entrypoint.sh
COPY scripts /scripts
RUN sed -i 's/\r$//' /entrypoint.sh /scripts/*.sh && chmod +x /entrypoint.sh /scripts/*.sh

# Porta esposta e healthcheck
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD sh -c 'curl -fsS http://localhost:${PORT:-8080}/health || exit 1'

# Avvio del microservizio con best practice ENTRYPOINT/CMD
ENTRYPOINT ["/entrypoint.sh"]
