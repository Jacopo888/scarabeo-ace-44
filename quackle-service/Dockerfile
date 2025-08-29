FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080

WORKDIR /app

# Dipendenze di sistema per compilare Quackle + ICU + Boost
RUN apt-get update && apt-get install -y \
    build-essential cmake git \
    libboost-all-dev libicu-dev python3-dev \
    && rm -rf /var/lib/apt/lists/*

# (Opzionale ma consigliato) directory per dizionari/lessici
RUN mkdir -p /usr/share/quackle/lexica

# Clona e compila Quackle (solo engine e python; niente GUI)
RUN git clone --depth=1 https://github.com/quackle/quackle.git /tmp/quackle && \
    cd /tmp/quackle && \
    mkdir -p build && cd build && \
    cmake -DCMAKE_BUILD_TYPE=Release \
          -DBUILD_GUI=OFF \
          -DBUILD_TESTS=OFF \
          -DBUILD_PYTHON=ON \
          -DQUACKLE_INSTALL_LEXICA=ON \
          .. && \
    make -j"$(nproc)" && make install && \
    ldconfig && \
    rm -rf /tmp/quackle

# Requisiti Python dell'app FastAPI
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Codice dell'app
COPY . .

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD \
  python -c "import urllib.request,os; urllib.request.urlopen(f'http://127.0.0.1:{os.getenv(\"PORT\",\"8080\")}/health').read()" || exit 1

CMD ["sh","-c","uvicorn app:app --host 0.0.0.0 --port ${PORT} --workers 2"]
