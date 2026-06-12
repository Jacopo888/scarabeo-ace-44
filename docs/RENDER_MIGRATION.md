# Render Migration

Status: completed and live.

Target service:

- Render service name: `tilesword-quackle`
- Expected public URL: `https://tilesword-quackle.onrender.com`
- Plan: free
- Region: frankfurt
- Health check: `/health`

## Why Render

`service-quackle` is a container workload: it compiles Quackle C++, builds a native bridge, and serves FastAPI with runtime lexica and strategy files. Render supports Docker web services from Git-backed repos, so it can replace the Heroku container service.

## Repo Files

- `render.yaml` defines the Render web service.
- `service-quackle/Dockerfile` builds the strong Quackle bridge.
- `api/quackle/[...path].js` defaults to the Render service URL.

## Required Render Env

The Blueprint sets:

- `ENV=prod`
- `DEBUG_ROUTES=false`
- `CORS_ORIGINS=https://tilesword.vercel.app,https://tilesword-quackle.onrender.com,http://localhost:5173,http://127.0.0.1:5173`
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

- Render service created: `srv-d8ltrc4m0tmc73are1bg`
- Render deploy: `dep-d8ltrd4m0tmc73are22g`
- Render health: `engine=quackle-bridge`, `engine_ready=true`, `strategy_ready=true`
- Render best move: rack `AEIRSTZ`, `word=ERSATZ`, `score=50`, `moves=3`, `engine_fallback=false`
- Vercel production env `QUACKLE_PROXY_TARGET` now points to `https://tilesword-quackle.onrender.com`
- Vercel redeployed and aliased to `https://tilesword.vercel.app`
- Vercel proxy health and best-move smoke pass through Render (`Rndr-Id` / `X-Render-Origin-Server` headers present)

Reference commands:

1. Set the API key only in the current terminal:

   ```powershell
   $env:RENDER_API_KEY = "rnd_..."
   ```

2. Validate the Blueprint:

   ```powershell
   C:\work\tools\render\cli_v2.20.0.exe blueprint validate render.yaml --confirm
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
     --env-var CORS_ORIGINS=https://tilesword.vercel.app,https://tilesword-quackle.onrender.com,http://localhost:5173,http://127.0.0.1:5173 `
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

4. Point Vercel proxy to Render:

   ```powershell
   vercel env add QUACKLE_PROXY_TARGET production --value "https://tilesword-quackle.onrender.com" --yes --force
   vercel --prod --yes
   ```

5. Smoke:

   ```powershell
   curl.exe -sS https://tilesword-quackle.onrender.com/health
   curl.exe -sS https://tilesword.vercel.app/api/quackle/health
   ```

## Heroku Decommission

Completed:

- local Git Heroku remotes removed.
- Vercel proxy no longer targets Heroku.

Not done automatically:

- physical Heroku app deletion. Destroying Heroku apps is irreversible and should be confirmed explicitly before running `heroku apps:destroy`.
