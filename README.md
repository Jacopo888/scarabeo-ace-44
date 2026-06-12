# Tilesword

Tilesword is a Vite + React word-tile game with a Quackle-backed bot.

Production:

- Frontend and Quackle proxy: `https://tilesword.vercel.app`
- Strong Quackle service: `https://service-quackle-6773ae98281f.herokuapp.com`

The current ruleset is English Scrabble-compatible:

- tile bag and points come from `src/types/game.ts`
- frontend dictionary and Quackle use ENABLE / `enable1.15`
- board size is 15x15 with the standard premium-square layout

This is not an Italian Scarabeo ruleset yet. Migrating to Italian Scarabeo requires coordinated changes to tile distribution, scoring, dictionary, Quackle lexica, strategy data, tests, and product copy.

## Local Development

Install dependencies:

```sh
npm i
```

Start the frontend:

```sh
npm run dev
```

Run frontend checks:

```sh
npm run lint
npm run typecheck
npm test
npm run build:prod
```

## Environment

Frontend env values are read through Vite:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_QUACKLE_SERVICE_URL`
- `VITE_RATING_API_URL` optional

Use `.env.example` as the local template. Local `.env*` files are ignored by Git.

For Vercel production, `VITE_QUACKLE_SERVICE_URL=/api/quackle` and `QUACKLE_PROXY_TARGET=https://service-quackle-6773ae98281f.herokuapp.com`.

## Quackle Service

The active backend is `service-quackle/`. It is a FastAPI service that compiles and runs the strong C++ Quackle bridge (`/srv/bridge/engine_wrapper`) inside a container.

Main endpoints:

- `GET /health`
- `GET /health/cors`
- `POST /best-move`
- `POST /bag/summary`
- `POST /debug/bridge-payload`

Runtime env:

- `QUACKLE_LEXICON=enable1.15`
- `LEXICON_NAME=enable1.15`
- `QUACKLE_LEXDIR=/data/lexica`
- `QUACKLE_APPDATA_DIR=/data/appdata`
- `DAWG_URL=https://raw.githubusercontent.com/Jacopo888/quackle/master/data/lexica/enable1.15.dawg`
- `GADDAG_URL=https://raw.githubusercontent.com/Jacopo888/quackle/master/data/lexica/enable1.15.gaddag`
- `QUACKLE_TIMEOUT_MS=8000`

The repository does not version Quackle lexica, generated strategy data, native binaries, or copied Quackle source data. They are downloaded, built, or copied at runtime/build time.

Run locally with Docker:

```sh
docker compose up -d --build quackle-service
```

Smoke test:

```sh
QUACKLE_BASE=http://localhost:8080 npm run quackle:health
QUACKLE_BASE=http://localhost:8080 npm run smoke:ci
```

Python tests:

```sh
python -m pytest service-quackle/tests -q
```

## Deployment

Frontend deployment is Vercel free tier. The repo includes:

- `vercel.json`
- `api/quackle/[...path].js`

The Vercel function proxies `/api/quackle/*` to the strong Quackle service. Details are in `docs/VERCEL_MIGRATION.md`.

The Quackle service still needs a container host because it builds native C++ code and ships runtime strategy files. The current container host is Heroku.

## Rating API

`rating-api/` is a small Express API with Postgres/Redis support.

Local stack:

```sh
docker compose up --build postgres redis rating-api
```

Rating API tests:

```sh
npm --prefix rating-api test
```

Database env:

```sh
DATABASE_URL=postgres://rating:example@localhost:5432/rating
REDIS_URL=redis://localhost:6379
PORT=4000
```

Migrations:

```sh
npm --prefix rating-api run db:generate
npm --prefix rating-api run db:migrate
```

## Documentation

Useful entry points:

- `DOCS_INDEX.md`
- `docs/WORKSPACE_FIX_PLAN.md`
- `docs/VERCEL_MIGRATION.md`
- `docs/BESTBOT_OPTIONAL_ENGINE.md`
- `service-quackle/README.md`
- `docs/game_rules.md`

Old deployment artifacts, generated Quackle data, compiled bridge outputs, and the historical minimal service have been removed from the active workspace.
