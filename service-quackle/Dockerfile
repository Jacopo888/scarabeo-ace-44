# BASE Python + toolchain
FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Build deps e librerie necessarie
RUN apt-get update && apt-get install -y \
    build-essential cmake git \
    libboost-all-dev libicu-dev python3-dev \
    nlohmann-json3-dev curl \
    && rm -rf /var/lib/apt/lists/*

# Lessici Quackle (path standard)
RUN mkdir -p /usr/share/quackle/lexica

# Compila Quackle (solo libreria; niente install)
RUN git clone --depth=1 https://github.com/quackle/quackle.git /tmp/quackle && \
    cd /tmp/quackle && mkdir -p build && cd build && \
    cmake -DCMAKE_BUILD_TYPE=Release .. && \
    make -j"$(nproc)" && \
    cp -r /tmp/quackle/lexica/* /usr/share/quackle/lexica/ 2>/dev/null || true

# Compila il bridge C++
WORKDIR /srv
COPY bridge/quackle_bridge.cpp /srv/bridge/quackle_bridge.cpp
RUN g++ -O3 -std=c++17 \
    -I/tmp/quackle/src/libquackle \
    /srv/bridge/quackle_bridge.cpp \
    /tmp/quackle/build/liblibquackle.a \
    -o /usr/local/bin/quackle_bridge \
    -lboost_system -lboost_filesystem -lboost_regex \
    -licuuc -licui18n -lpthread

# Pulizia sorgenti
RUN rm -rf /tmp/quackle

# App FastAPI
COPY requirements.txt /srv/requirements.txt
RUN pip install --no-cache-dir -r /srv/requirements.txt
COPY app /srv/app

# Env di default (modificabili in deploy)
ENV CORS_ORIGINS="https://preview--scarabeo-ace-44.lovable.app,https://scarabeo-ace-44.lovable.app"
ENV QUACKLE_LEXICON="en-enable"
ENV QUACKLE_LEXDIR="/usr/share/quackle/lexica"

EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=3s CMD curl -fsS http://localhost:5000/health || exit 1
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "5000"]
