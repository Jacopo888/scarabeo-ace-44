# service-quackle

FastAPI microservice that bridges the Quackle engine.

## Runtime overview
- Endpoint base: `/` (FastAPI)
- Key endpoints:
  - `GET /health` – status, engine readiness, lexicon sizes, strategy inventory
  - `POST /best-move` – compute best move; accepts partial racks (0..7) for endgame; returns `pass` if rack is empty
  - `POST /bag/summary` – remaining tiles based on board/rack (supports distribution override)
  - `POST /debug/probe` – normalize payload and run a lightweight analysis
- Board normalization: accepts multiple shapes (grid/squares/coord_map/placements), normalizes internally to 15x15.
- Coordinates: service returns 0-based row/col for tiles.

## Configuration (env)
- `CORS_ORIGINS` – comma-separated origins
- `QUACKLE_LEXDIR` – where lexica (DAWG/GADDAG) live (default `/data/lexica`)
- `QUACKLE_APPDATA_DIR` – strategy/data dir (default `/data/appdata`)
- `LEXICON_NAME` or `QUACKLE_LEXICON` – base name of lexicon (default `enable1.15`)
- `DAWG_URL`, `GADDAG_URL` – optional URLs to download lexica at startup
- `QUACKLE_SKIP_LEXICON_CHECK` – if `1|true`, skip strict lexicon presence check (useful in tests)

These values sono compatibili con Railway; esempio dalla produzione:
```
QUACKLE_LEXDIR=/data/lexica
QUACKLE_APPDATA_DIR=/data/appdata
LEXICON_NAME=enable1.15
QUACKLE_LEXICON=enable1.15
DAWG_URL=https://raw.githubusercontent.com/Jacopo888/quackle/master/data/lexica/enable1.15.dawg
GADDAG_URL=https://raw.githubusercontent.com/Jacopo888/quackle/master/data/lexica/enable1.15.gaddag
```

## Bootstrap dei lessici
- All'avvio, `entrypoint.sh` invoca `scripts/bootstrap_lexica.sh` (idempotente):
  - Se i file `${LEXICON_NAME}.dawg/.gaddag` esistono e hanno size > 0, non fa nulla.
  - Se mancano e sono definiti `DAWG_URL`/`GADDAG_URL`, li scarica e verifica.
  - In alternativa, puoi montare un volume su `/data/lexica`.

## Strategy files
- I file di strategia sono derivati e non versionati nel repo; vengono sincronizzati da `/usr/share/quackle/data/strategy` verso `/data/appdata/strategy` all'avvio (se mancanti).

## Sviluppo locale (rapido)
- Requisiti: Python 3.x, `pip install -r requirements.txt` (se servi FastAPI direttamente), oppure Docker.
- Avvio locale semplice (senza engine nativo):
  - Imposta `QUACKLE_SKIP_LEXICON_CHECK=1` per evitare il gate dei file.
  - Esegui `uvicorn quackle_service.main:app --reload`.
- Con Docker/Compose: vedi `Dockerfile` e `docker-compose.yml` nella root del progetto.

## Note d'integrazione
- In endgame, rack con meno di 7 lettere sono accettate; rack vuota => risposta `pass` senza chiamare il bridge.
- `/health` riporta `engine_ready` in base all’eseguibile del bridge e alla presenza/skip dei lessici.
