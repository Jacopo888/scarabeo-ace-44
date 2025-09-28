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

## Architettura (moduli)
Struttura attuale dei moduli principali in `quackle_service/`:
- `main.py` – bootstrap FastAPI: include router, CORS da env, lifespan che verifica/inizializza i lessici.
- `config.py` – lettura env e costanti (es. `QUACKLE_LEXDIR`, `QUACKLE_LEXICON`, `CORS_ORIGINS`, `QUACKLE_TIMEOUT_MS`).
- `runtime.py` – check e bootstrap dei file lessicali/strategy; util per readiness.
- `normalization.py` – normalizzazione rack/board e conversioni (grid ⇆ coord_map, placements, squares).
- `bridge_client.py` – invocazione del bridge native (subprocess), timeouts ed envelope errori.
- `routes_best_move.py`, `routes_health.py`, `routes_debug.py` – router FastAPI separati per feature.
- `adapters/quackle.py` – boundary di chiamata al motore; mantiene compatibilità coi test che monkeypatchano `main._call_bridge`.

Nota: gli CORS origins sono risolti dinamicamente da `CORS_ORIGINS` e visibili anche in `GET /health/cors`.

## Configuration (env)
- `CORS_ORIGINS` – comma-separated origins
- `QUACKLE_LEXDIR` – where lexica (DAWG/GADDAG) live (default `/data/lexica`)
- `QUACKLE_APPDATA_DIR` – strategy/data dir (default `/data/appdata`)
- `LEXICON_NAME` or `QUACKLE_LEXICON` – base name of lexicon (default `enable1.15`)
- `DAWG_URL`, `GADDAG_URL` – optional URLs to download lexica at startup
- `QUACKLE_SKIP_LEXICON_CHECK` – if `1|true`, skip strict lexicon presence check (useful in tests)
- `QUACKLE_TIMEOUT_MS` – timeout chiamata al bridge (default 8000 ms)
- `QUACKLE_BRIDGE_BIN` – path binario bridge nativo (override)
- `DEBUG_ENABLE_LDD` – abilita endpoint `GET /debug/ldd` per ispezionare le dipendenze del binario

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

### Debug veloce
- `GET /debug/config` e `GET /health/cors` per verificare configurazione e CORS.
- `POST /debug/bridge-payload` per vedere il payload normalizzato che va al bridge.
- `GET /debug/sample-moves` per un paio di casi base (richiede bridge disponibile).

### Test
- Test Python del servizio: `pytest -q service-quackle/tests`.

## Note d'integrazione
- In endgame, rack con meno di 7 lettere sono accettate; rack vuota => risposta `pass` senza chiamare il bridge.
- `/health` riporta `engine_ready` in base all’eseguibile del bridge e alla presenza/skip dei lessici.

## Railway: env di produzione e smoketest

Principali variabili in produzione (Railway):

- `CORS_ORIGINS`: `https://scarabeo-ace-44.lovable.app, https://preview--scarabeo-ace-44.lovable.app, https://scarabeo-ace-44-production.up.railway.app`
- `QUACKLE_APPDATA_DIR`: `/data/appdata`
- `QUACKLE_LEXDIR`: `/data/lexica`
- `LEXICON_NAME` / `QUACKLE_LEXICON`: `enable1.15`
- `DAWG_URL` / `GADDAG_URL`: URL pubblici ai file del lessico (DAWG/GADDAG)

Smoketest (produzione):

```bash
# opzionale: BASE_URL override
BASE_URL="https://service-quackle-production.up.railway.app" bash ./scripts/smoketest-railway.sh
```
