# Migrazione Vercel

Stato: completato per frontend e proxy; service Quackle forte ancora su host container

## Obiettivo

Migrare il frontend Tilesword su Vercel piano gratuito e usare Vercel come punto di ingresso del sito.

URL production:

- `https://tilesword.vercel.app`

## Decisione tecnica

Il frontend Vite puo girare su Vercel senza container.

`service-quackle`, invece, oggi e un servizio containerizzato Python + C++:

- compila Quackle e il bridge nativo;
- avvia FastAPI con `uvicorn`;
- usa file lessico e strategy a runtime;
- viene deployato come container Heroku.

Vercel non esegue Docker image direttamente. Per questo la migrazione immediata e:

- frontend su Vercel;
- proxy Vercel `/api/quackle/*` verso il `service-quackle` forte esistente;
- `service-quackle` resta su Heroku finche non scegliamo un host container compatibile, oppure finche non progettiamo un porting serverless dedicato.

Questa soluzione sposta l'esperienza utente su Vercel e rimuove i problemi CORS, ma non finge che il motore C++ sia gia serverless.

## File aggiunti

- `vercel.json`: build Vite, output `dist`, fallback SPA.
- `api/quackle/[...path].js`: proxy serverless verso `service-quackle`.

## Variabili Vercel frontend

Produzione configurata:

- `VITE_QUACKLE_SERVICE_URL=/api/quackle`
- `QUACKLE_PROXY_TARGET=https://service-quackle-6773ae98281f.herokuapp.com`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID` opzionale
- `VITE_RATING_API_URL` opzionale
- `VITE_DEBUG_QUACKLE=false`

## Verifiche richieste

Frontend:

- `npm run build:prod`
- smoke HTTP `https://tilesword.vercel.app/`
- caricamento bundle con `id="root"`

Proxy Quackle:

- `GET https://tilesword.vercel.app/api/quackle/health`
- `POST https://tilesword.vercel.app/api/quackle/best-move`

Verifiche completate:

- `npm run build:prod`
- `vercel --prod --yes`
- root Vercel: HTTP 200
- proxy health: `engine=quackle-bridge`, `engine_ready=true`, `bridge_path=/srv/bridge/engine_wrapper`, `strategy_ready=true`
- proxy best move: rack `AEIRSTZ`, `word=ERSATZ`, `score=50`, `moves=3`, `engine_fallback=false`

Service forte:

- `GET https://service-quackle-6773ae98281f.herokuapp.com/health`
- verificare `engine=quackle-bridge`
- verificare `bridge_path=/srv/bridge/engine_wrapper`
- verificare `engine_ready=true`

## Opzioni future per migrare davvero il service

Per spostare anche `service-quackle` fuori da Heroku servono piattaforme container:

- Fly.io
- Render
- Google Cloud Run
- AWS App Runner/ECS

Un porting Vercel serverless del motore e teorico, ma non e il percorso consigliato per il bridge forte: richiederebbe binari precompilati compatibili, bundle size sotto limite, bootstrap lessici adatto a function runtime e timeout compatibili con simulazioni/endgame.
