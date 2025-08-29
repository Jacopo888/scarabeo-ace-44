# BASE Python + toolchain
FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Dipendenze native per compilare Quackle e il bridge
RUN apt-get update && apt-get install -y \
    build-essential cmake git \
    libboost-all-dev libicu-dev python3-dev \
    nlohmann-json3-dev curl \
    && rm -rf /var/lib/apt/lists/*

# Cartella dizionari (ENABLE incluso)
RUN mkdir -p /usr/share/quackle/lexica

# Clona e compila Quackle (solo libreria; niente 'make install')
RUN git clone --depth=1 https://github.com/quackle/quackle.git /tmp/quackle && \
    cd /tmp/quackle && mkdir -p build && cd build && \
    cmake -DCMAKE_BUILD_TYPE=Release .. && \
    make -j"$(nproc)" && \
    cp -r /tmp/quackle/lexica/* /usr/share/quackle/lexica/ 2>/dev/null || true

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
RUN rm -rf /tmp/quackle

# Installazione dipendenze Python e codice FastAPI
COPY requirements.txt /srv/requirements.txt
RUN pip install --no-cache-dir -r /srv/requirements.txt
COPY app /srv/app

# Variabili di default (modificabili in deploy)
ENV CORS_ORIGINS="https://preview--scarabeo-ace-44.lovable.app,https://scarabeo-ace-44.lovable.app"
ENV QUACKLE_LEXICON="en-enable"
ENV QUACKLE_LEXDIR="/usr/share/quackle/lexica"

# Porta esposta e healthcheck
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=3s CMD curl -fsS http://localhost:5000/health || exit 1

# Avvio del microservizio
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "5000"]
