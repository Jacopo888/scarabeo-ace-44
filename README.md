# Scarabeo-Ace-44

## How can I edit this code?

There are several ways of editing this application locally.

**Use your preferred IDE (local development)**

Clone the repository e lavora in locale. Assicurati di avere Node.js e npm installati (consigliato: gestirli con [nvm](https://github.com/nvm-sh/nvm#installing-and-updating)).

Questo progetto usa npm come package manager.

Passi rapidi:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

### Running tests

Unit tests are executed with [Vitest](https://vitest.dev/):

```sh
npm test
```

**Edit directly in GitHub**

- Apri il file da modificare
- Clicca l'icona matita (Edit) in alto a destra
- Esegui le modifiche e fai commit nella branch desiderata

**Usare GitHub Codespaces (opzionale)**

- Vai alla pagina principale del repository
- Clicca su "Code" → tab "Codespaces"
- Crea un nuovo Codespace e sviluppa direttamente nel browser

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## Environment variables

The Supabase client relies on two environment variables:

- `SUPABASE_URL` – URL of your Supabase instance
- `SUPABASE_PUBLISHABLE_KEY` – the project's public API key

Both variables must be available via Vite's `import.meta.env` system (for
example by placing them in a `.env` file). The application will throw an error
at startup if either one is missing.

An `.env.example` file is included in the repository. Copy it to `.env` and
add your Supabase credentials:

```sh
cp .env.example .env
# then edit .env and provide values for SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY
```

## Quackle Service – Runtime Setup (Zero‑Tolerance)

Il microservizio `service-quackle` usa Quackle reale con GADDAG completo. Non ci sono fallback a dizionari ridotti o "pass" silenziosi. Se il lessico non è pronto si risponde con errore esplicito (HTTP 500/502).

### Porte e URL
- La porta è configurabile via `PORT` (default 8080). L'app espone gli endpoint su `http://<host>:8080` in locale o su Railway.
- Frontend (Vite) usa `VITE_QUACKLE_SERVICE_URL` come base per le chiamate; impostalo al tuo URL pubblico o locale, ad es. `http://localhost:8080`.

### Variabili ambiente (servizio Quackle)
 `QUACKLE_LEXICON=enable1.15` (nome del lessico; i file corretti sono `enable1.15.gaddag` e `enable1.15.dawg`)
 `QUACKLE_LEXDIR=/data/lexica` (cartella su volume per i file lessico)
 Opzionali per download a runtime (se assenti, si usano i file già presenti nel volume):
  - `GADDAG_URL=https://.../enable1.15.gaddag`
  - `DAWG_URL=https://.../enable1.15.dawg`
 Verifica che `enable1.15.gaddag` e `enable1.15.dawg` esistano e abbiano dimensione > 0. In caso contrario, `engine_ready:false` e `/best-move` risponde 500 `lexicon_not_ready`.
  - `GADDAG_URL=https://.../enable1.15.gaddag`
  - `DAWG_URL=https://.../enable1.15.dawg`

All'avvio (lifespan FastAPI) il servizio:
1) Crea le directory `QUACKLE_LEXDIR` e `QUACKLE_APPDATA_DIR` in modo idempotente.
2) Scarica i file da `GADDAG_URL`/`DAWG_URL` se impostati, salvandoli in `QUACKLE_LEXDIR`.
3) Verifica che `enable1.15.gaddag` e `enable1.15.dawg` esistano e abbiano dimensione > 0. In caso contrario, `engine_ready:false` e `/best-move` risponde 500 `lexicon_not_ready`.

### Endpoint principali
- `GET /health` restituisce:
  - `engine_ready` (true solo se binario eseguibile + GADDAG/DAWG con size > 0)
  - `gaddag_exists`, `dawg_exists`, `gaddag_size`, `dawg_size`
  - `lexdir`, `lexicon`, `timeout_ms`, `word_count` (se `enable1.txt` presente)
- `POST /best-move` richiede:
  - `rack` stringa di 7 caratteri (A‑Z, `?` per blank)
  - `board` in uno dei due formati supportati:
    1) Formato A (ufficiale): mappa "r,c" (1‑based) → `{letter,isBlank}`
    2) Formato B (legacy): array di 15 stringhe ('.' = vuoto)
  - Errori di input → 400 con messaggio esplicito (mai 200 con `pass`).
  - Lessico non pronto → 500 `lexicon_not_ready`.

### Esempi rapidi (curl)
```bash
# Health
curl -s http://localhost:8080/health | jq

# Empty board + AEIRSTZ (legacy grid)
curl -s -X POST http://localhost:8080/best-move \
  -H 'content-type: application/json' \
  --data-binary '{"rack":"AEIRSTZ","board":["...............","...............","...............","...............","...............","...............","...............","...............","...............","...............","...............","...............","...............","...............","..............."]}' | jq

# Centro occupato + HELLO?? (grid con A al centro)
curl -s -X POST http://localhost:8080/best-move \
  -H 'content-type: application/json' \
  --data-binary '{"rack":"HELLO??","board":{"rows":15,"cols":15,"center_x":7,"center_y":7,"grid":["...............","...............","...............","...............","...............","...............","...............",".......A.......","...............","...............","...............","...............","...............","...............","..............."]}}' | jq
```

### Comportamento errori (Zero‑tolerance)
- Nessun fallback a "mini‑lexicon" o mosse simulate.
- In caso di errori del bridge/eseguibile: HTTP 502 con `engine_fallback:true`, `rc`, `stderr` e estratto `ldd` del binario.
- In caso di input non valido: HTTP 400 (mai trasformare in `pass`).

### Configurazione FE (Vite)
- `.env.development`: `VITE_QUACKLE_SERVICE_URL=http://localhost:8080`
- `.env.production`: `VITE_QUACKLE_SERVICE_URL=https://service-quackle-production.up.railway.app`

Test rapidi lato FE:
- `QUACKLE_BASE=http://localhost:8080 npm run quackle:health`
- `QUACKLE_BASE=https://<railway-app>.up.railway.app npm run quackle:test`

## How can I deploy this project?

Puoi distribuire i servizi dove preferisci (Railway, Render, VPS, Docker Swarm/K8s). In questo repo trovi:

- Dockerfile e docker-compose per avviare localmente il microservizio Quackle
- Workflow GitHub Actions per smoke test del servizio
- Variabili d’ambiente documentate nelle sezioni dedicate

## Blank tiles

When you drag a blank tile onto the board a dialog will appear allowing you to choose which letter it represents. The chosen letter is displayed on the tile but the tile still scores `0` points and remains a blank tile. Picking the tile back up lets you choose again on the next placement.

## Multiplayer end game

The multiplayer mode finishes once the tile bag is empty and a player has no tiles left. When this occurs the remaining tile values in each rack are subtracted from that player's score. See [docs/game_rules.md](docs/game_rules.md) for full details.

## Rating service

A small Express API is provided in `./rating-api`. It exposes a `/ping` endpoint for health checks.

A `docker-compose.yml` is available to start the API together with Postgres and Redis:

```sh
docker-compose up --build
```

The API will be accessible at `http://localhost:4000/ping` and proxied via `/api` from the frontend.

### Environment and migrations

`rating-api` requires the following environment variables:

```
DATABASE_URL=postgres://rating:example@localhost:5432/rating
REDIS_URL=redis://localhost:6379
PORT=4000
```

**Production deployment:** Set `VITE_RATING_API_URL` to your production API URL. If not set, the frontend will use local fallback puzzle generation.
## Railway – Setup Volume

## Quackle-Service: Strategia e Test integrazione

Al build e ad ogni avvio del container, i file strategia richiesti vengono sincronizzati in `/data/appdata/strategy` da `/usr/share/quackle/data/strategy`:
- default_english: `syn2`, `vcplace`, `superleaves`, `worths`
- default: `bogowin`

Endpoint diagnostici e health:
- `GET /debug/strategy` → per ciascun file: exists, path, size, sha256, mode
- `GET /health` → include `strategy_ready` e `strategy_files`; ritorna 503 se manca un file (a meno che `ALLOW_EMPTY_STRATEGY=1`)

Test di integrazione (dopo `docker compose up -d quackle-service`):

```bash
curl -s http://localhost:8080/debug/strategy | jq
curl -s -w "\nHTTP=%{http_code}\n" http://localhost:8080/health | jq

# Caso A: board vuota + AEIRSTZ
curl -sS -X POST http://localhost:8080/best-move \
  -H 'content-type: application/json' \
  --data-binary @- <<'JSON' | jq
{"rack":"AEIRSTZ","board":{"rows":15,"cols":15,"grid":
["...............","...............","...............","...............","...............",
 "...............","...............","...............","...............","...............",
 "...............","...............","...............","...............","..............."]}}
JSON

# Caso B: centro A + HELLO??
curl -sS -X POST http://localhost:8080/best-move \
  -H 'content-type: application/json' \
  --data-binary @- <<'JSON' | jq
{"rack":"HELLO??","board":{"rows":15,"cols":15,"grid":
["...............","...............","...............","...............","...............",
 "...............","...............",".......A.......","...............","...............",
 "...............","...............","...............","...............","..............."]}}
JSON
```

Nota: se rimuovi un file da `/data/appdata/strategy`, al riavvio l'entrypoint lo ricrea dai file di sistema.

### Bridge self-test (CLI)

Esecuzioni dirette del binario (nessun segfault, exit codes coerenti):

```bash
# A) Board vuota + rack AEIRSTZ (cattura RC con pipefail)
set -o pipefail
REQ='{"op":"compute","rack":"AEIRSTZ","ruleset":"en","board":{}}'
printf '%s' "$REQ" | /srv/bridge/engine_wrapper | tee /tmp/out.json
echo "RC=${PIPESTATUS[1]}"

# B) Centro con A e rack HELLO??
set -o pipefail
REQ='{"op":"compute","rack":"HELLO??","ruleset":"en","board":{"8,8":{"letter":"A","isBlank":false}}}'
printf '%s' "$REQ" | /srv/bridge/engine_wrapper | tee /tmp/out2.json
echo "RC=${PIPESTATUS[1]}"

# Se manca un file strategia oppure size==0 → exit code 72 con stderr contenente
# "Strategy candidate missing: <abs_path>"
```

### Smoke test CI (consigliato)

Per uno smoke affidabile in CI usa la stessa forma di payload inviata alla modalità "vs quackle" (mappa di coordinate 1-based) e rack robusti che tendono a produrre una mossa all'opening:

- Board vuota: `{}`
- Centro occupato: `{"8,8":{"letter":"A","isBlank":false}}`
- Rack suggeriti: `FALREI?`, `HELLO??`

Script già inclusi:

- `npm run smoke:ci` → Node script (`scripts/test-smoke-ci.mjs`)
- `npm run smoke:ci:curl` → Bash con curl (`scripts/smoketest-ci.sh`)

Entrambi verificano:

- HTTP 200
- `engine_fallback == false`
- `move_type != "pass"`
- `tiles` non vuote

Esempio esecuzione locale (dopo aver avviato `docker compose up -d quackle-service`):

```bash
QUACKLE_BASE=http://localhost:8080 npm run smoke:ci
QUACKLE_BASE=http://localhost:8080 npm run smoke:ci:curl
```

In GitHub Actions è disponibile il workflow `.github/workflows/ci-smoke.yml` che costruisce e avvia `quackle-service`, prepara i dizionari in `./data/lexica`, attende `/health` e lancia gli smoke.

### Fork Quackle (v1.0.4) e usare la nostra versione

Per eliminare crash interni della libreria (FixedLengthString/Generator), questo progetto supporta una fork remota di Quackle. Il Dockerfile accetta gli argomenti di build:

- `QUACKLE_REPO_URL` (default: `https://github.com/quackle/quackle.git`)
- `QUACKLE_REPO_BRANCH` (default: `v1.0.4`)

Passi consigliati:

1) Crea il fork sul tuo account Git e push delle patch correttive (consigliato: branch `scarabeo-v104`)
2) Esporta le variabili e ricostruisci:

```bash
export QUACKLE_REPO_URL=https://github.com/<tuo-account>/quackle.git
export QUACKLE_REPO_BRANCH=scarabeo-v104
docker compose build quackle-service
docker compose up -d quackle-service
```

Note tecniche:
- Durante il build, applichiamo anche patch di robustezza alla libreria: normalizzazione del conteggio lettere e indicizzazione sicura in `String::counts`. Inoltre, la funzione `Generator::setupCounts` usa una variante che non dipende da iteratori di FixedLengthString per il rack (assume rack a 7 tiles). Queste patch sono applicate inline per garantire build riproducibili; il fork remoto può includerle nativamente.


### Diagnostica strategia (probe)

Nuovo endpoint e op nel bridge per verificare senza inizializzare Quackle:

- `GET /debug/strategy-probe` → chiama il bridge con `op:"probe_strategy"` e restituisce per ciascun file:
  - `exists`, `size`, `head16`, `path`, e i path "risolti" via `DataManager::findDataFile`.

Variabili utili per debug runtime del bridge:

- `QUACKLE_INIT_MODE=none|default|english|both`
  - `none`: salta completamente `StrategyParameters::initialize(...)` e i check pre-generazione.
  - `default|english|both`: controlla quale sotto-set inizializzare e logga pre/post di ciascun passo.
- `QUACKLE_DISABLE_STRATEGY=1` → equivalente a `QUACKLE_INIT_MODE=none` (salta init e check strategia).
- `QUACKLE_USE_HIGHLEVEL=1` → abilita il percorso alternativo "high-level" (kibitz su `GamePosition`) anche a board vuota.

Nota: se il binario del bridge non è ricompilato con l'ultima patch, gli switch sopra potrebbero non avere effetto. Nell'immagine Docker standard vengono applicati durante il build.

API “happy path” su board vuota (HTTP 200 atteso):
```bash
curl -sS -X POST http://localhost:8080/best-move \
  -H 'content-type: application/json' \
  --data-binary @- <<'JSON'
{"rack":"AEIRSTZ","ruleset":"en","board":{"rows":15,"cols":15,"grid":[
"...............","...............","...............","...............","...............",
"...............","...............","...............","...............","...............",
"...............","...............","...............","...............","..............."]}}
JSON
```

- Monta un volume su `/data`.
- Imposta le variabili del servizio:
  - `QUACKLE_LEXICON=enable1`
  - `QUACKLE_LEXDIR=/data/lexica`
  - `QUACKLE_APPDATA_DIR=/data/appdata`
  - (opzionali) `GADDAG_URL`, `DAWG_URL` per auto‑download al primo avvio.
- Verifica `GET /health`: deve mostrare `engine_ready:true` e dimensioni > 0 per GADDAG/DAWG.

Comandi utili:
- Logs: `railway logs -d | egrep 'startup|Lexicon|GADDAG|DAWG|engine_fallback'`
- Diagnostica: `GET /debug/lexicon`, `GET /debug/quackle`, `GET /health/cors`


Drizzle is used for database migrations:

```sh
# generate a new migration after editing src/schema.ts
npm --prefix rating-api run db:generate

# apply all pending migrations
npm --prefix rating-api run db:migrate
```

### Cron

Generate tomorrow's daily puzzle:

```sh
npm --prefix rating-api run makeDaily
```

Schedule this with cron or GitHub Actions to run every day.

### Daily Challenge

The rating API exposes a daily Scrabble challenge.

Ensure the database is configured via `DATABASE_URL` and run migrations:

```
npm --prefix rating-api run db:migrate
```

Example usage:

```
curl http://localhost:4000/daily-challenge/today
curl -X POST http://localhost:4000/daily-challenge/submit \
  -H "Content-Type: application/json" \
  -d '{"yyyymmdd":20250101,"userId":"test","score":123}'
curl http://localhost:4000/daily-challenge/leaderboard?yyyymmdd=20250101&limit=10
```
