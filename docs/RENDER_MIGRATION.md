# Render Migration

Status: completed and live for frontend and Quackle.

Target services:

- Frontend Static Site: `tilesword`
- Frontend URL: `https://tilesword.onrender.com`
- Quackle Web Service: `tilesword-quackle`
- Quackle URL: `https://tilesword-quackle.onrender.com`
- Plan: free for both services
- Quackle region: frankfurt
- Quackle health check: `/health`

## Why Render

`service-quackle` is a container workload: it compiles Quackle C++, builds a native bridge, and serves FastAPI with runtime lexica and strategy files. Render supports Docker web services from Git-backed repos, so it replaces the Heroku container service.

The frontend is a Vite static build. Render Static Site hosting can publish `dist` and apply rewrites, so it now replaces Vercel too.

## Repo Files

- `render.yaml` defines both Render services.
- `service-quackle/Dockerfile` builds the strong Quackle bridge.
- The frontend Render route rewrites `/api/quackle/*` to `https://tilesword-quackle.onrender.com/*`.

## Required Render Env

The Blueprint sets:

- `ENV=prod`
- `DEBUG_ROUTES=false`
- `CORS_ORIGINS=https://tilesword.onrender.com,https://tilesword-quackle.onrender.com,http://localhost:5173,http://127.0.0.1:5173`
- `QUACKLE_LEXICON=enable1.15`
- `LEXICON_NAME=enable1.15`
- `QUACKLE_LEXDIR=/data/lexica`
- `QUACKLE_APPDATA_DIR=/data/appdata`
- `QUACKLE_TIMEOUT_MS=8000`
- `QUACKLE_REPO_URL=https://github.com/Jacopo888/quacklejacopo.git`
- `QUACKLE_REPO_BRANCH=master`
- `MAKE_JOBS=2`
- `DAWG_URL=https://raw.githubusercontent.com/Jacopo888/quackle/master/data/lexica/enable1.15.dawg`
- `GADDAG_URL=https://raw.githubusercontent.com/Jacopo888/quackle/master/data/lexica/enable1.15.gaddag`

Render passes Docker service env vars as build args too, so `MAKE_JOBS=2` limits the native build parallelism.

## Deploy Checklist

Completed:

- Render frontend service created: `srv-d8lubuu7r5hc739nt8lg`
- Render frontend deploy: `dep-d8lubv67r5hc739nt9gg`
- Render Quackle service created: `srv-d8ltrc4m0tmc73are1bg`
- Render Quackle deploy: `dep-d8lunbvlk1mc73bls9gg`
- Render frontend root: HTTP 200, title `Tilesword`
- Render frontend browser smoke: root rendered, main navigation visible, no blank page, no console errors, no 4xx responses
- Render proxy health: `https://tilesword.onrender.com/api/quackle/health`
- Render proxy best move: rack `AEIRSTZ`, `word=ERSATZ`, `score=50`, `moves=3`, `engine_fallback=false`
- Render health: `engine=quackle-bridge`, `engine_ready=true`, `strategy_ready=true`
- Render best move: rack `AEIRSTZ`, `word=ERSATZ`, `score=50`, `moves=3`, `engine_fallback=false`
- Vercel runtime files removed from the active repo.

Reference commands:

1. Set the API key only in the current terminal:

   ```powershell
   $env:RENDER_API_KEY = "rnd_..."
   ```

2. Validate the Blueprint:

   ```powershell
   C:\work\tools\render\cli_v2.20.0.exe blueprints validate render.yaml --confirm
   ```

3. Create the service:

   ```powershell
   C:\work\tools\render\cli_v2.20.0.exe services create `
     --name tilesword-quackle `
     --type web_service `
     --runtime docker `
     --repo https://github.com/Jacopo888/scarabeo-ace-44.git `
     --branch main `
     --root-directory service-quackle `
     --plan free `
     --region frankfurt `
     --health-check-path /health `
     --env-var ENV=prod `
     --env-var DEBUG_ROUTES=false `
     --env-var CORS_ORIGINS=https://tilesword.onrender.com,https://tilesword-quackle.onrender.com,http://localhost:5173,http://127.0.0.1:5173 `
     --env-var QUACKLE_LEXICON=enable1.15 `
     --env-var LEXICON_NAME=enable1.15 `
     --env-var QUACKLE_LEXDIR=/data/lexica `
     --env-var QUACKLE_APPDATA_DIR=/data/appdata `
     --env-var QUACKLE_TIMEOUT_MS=8000 `
     --env-var QUACKLE_REPO_URL=https://github.com/Jacopo888/quacklejacopo.git `
     --env-var QUACKLE_REPO_BRANCH=master `
     --env-var MAKE_JOBS=2 `
     --env-var DAWG_URL=https://raw.githubusercontent.com/Jacopo888/quackle/master/data/lexica/enable1.15.dawg `
     --env-var GADDAG_URL=https://raw.githubusercontent.com/Jacopo888/quackle/master/data/lexica/enable1.15.gaddag `
     --confirm `
     --output json
   ```

4. Smoke:

   ```powershell
   curl.exe -sS https://tilesword.onrender.com/
   curl.exe -sS https://tilesword.onrender.com/api/quackle/health
   curl.exe -sS https://tilesword-quackle.onrender.com/health
   ```

## Heroku Decommission

Completed:

- local Git Heroku remotes removed.
- active frontend and backend no longer target Heroku.

Not done automatically:

- physical Heroku app deletion. Destroying Heroku apps is irreversible and should be confirmed explicitly before running `heroku apps:destroy`.
