# BASE Python + toolchain
FROM python:3.13-slim
ARG BUILD_FORCE="v104-debug-2"
ENV BUILD_FORCE=${BUILD_FORCE}
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Dipendenze native per compilare Quackle e il bridge
RUN apt-get update && apt-get install -y \
    build-essential cmake git \
    libboost-all-dev libicu-dev python3-dev \
    nlohmann-json3-dev curl \
    qt5-qmake qtbase5-dev \
    && rm -rf /var/lib/apt/lists/*

# Cartella dizionari (ENABLE incluso)
RUN mkdir -p /usr/share/quackle/lexica

# Clona e compila Quackle v1.0.4 (versione stabile) con tutti gli strumenti
# Cache buster for makegaddag compilation - v4
RUN git clone --depth=1 --branch v1.0.4 https://github.com/quackle/quackle.git /tmp/quackle && \
    cd /tmp/quackle && mkdir -p build && cd build && \
    cmake -DCMAKE_BUILD_TYPE=Release .. && \
    make -j"$(nproc)" && \
    cp -r /tmp/quackle/data/lexica/* /usr/share/quackle/lexica/ 2>/dev/null || true && \
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

# Copia il bridge C++ e compila
COPY bridge/quackle_bridge.cpp /srv/bridge/quackle_bridge.cpp
RUN g++ -O3 -std=c++17 \
    -I/tmp/quackle \
    -I/tmp/quackle/src/libquackle/include \
    -I/tmp/quackle/src/libquackle \
    -I/tmp/quackle/src \
    /srv/bridge/quackle_bridge.cpp \
    /tmp/quackle/build/liblibquackle.a \
    -o /usr/local/bin/quackle_bridge \
    -lboost_system -lboost_filesystem -lboost_regex \
    -licuuc -licui18n -lpthread

# Rimuovi i sorgenti temporanei
# Copia dati (alphabets, strategy, lexica) nell'immagine dalla build di Quackle
RUN mkdir -p /usr/share/quackle/data && \
    cp -r /tmp/quackle/data/* /usr/share/quackle/data/

# Rimuovi i sorgenti temporanei
RUN rm -rf /tmp/quackle

# Installazione dipendenze Python e codice FastAPI
COPY requirements.txt /srv/requirements.txt
RUN pip install --no-cache-dir -r /srv/requirements.txt
COPY app /srv/app
COPY quackle_service /srv/quackle_service

# Variabili di default (modificabili in deploy)
ENV CORS_ORIGINS="https://preview--scarabeo-ace-44.lovable.app,https://scarabeo-ace-44.lovable.app"
ENV QUACKLE_LEXICON="enable1"
ENV QUACKLE_LEXDIR="/data/quackle/lexica/enable1"
ENV QUACKLE_APPDATA_DIR="/usr/share/quackle/data"
ENV LEXICON_NAME="enable1"
ENV LEX_DIR="/data/quackle/lexica/enable1"

# Setup script and entrypoint for lexicon generation on Volume
COPY ops/setup_enable_lexicon.sh /usr/local/bin/setup_enable_lexicon.sh
RUN chmod +x /usr/local/bin/setup_enable_lexicon.sh
COPY ops/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Porta esposta e healthcheck
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=3s CMD sh -c 'curl -fsS http://localhost:${PORT:-5000}/health || exit 1'

# Avvio del microservizio (PORT espanso via shell)
ENTRYPOINT ["/entrypoint.sh"]
CMD ["sh", "-c", "uvicorn quackle_service.main:app --host 0.0.0.0 --port ${PORT:-5000}"]