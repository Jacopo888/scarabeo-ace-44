# scarabeo-ace-44 · Istruzioni per agenti AI

Ultimo aggiornamento: 2025-09-29

## Architettura in breve
- `src/` Frontend Vite + React + TypeScript. Test Vitest vicino al codice (`*.test.ts(x)`).
- `service-quackle/` FastAPI che fa da bridge a Quackle (binario C++). Endpoint chiave: `GET /health`, `POST /best-move`.
- `rating-api/` Express + Drizzle (TypeScript) con Postgres/Redis; test in `src/__tests__/`.
- `data/` volume locale per lessici e appdata (`/data/lexica`, `/data/appdata`).

## Flussi di lavoro essenziali
- Frontend: `npm i`, `npm run dev`, `npm test`, `npm run build` (lint: `npm run lint`).
- Quackle service: `docker compose up -d quackle-service` oppure `uvicorn quackle_service.main:app` con env. Smoke rapido: `QUACKLE_BASE=http://localhost:8080 npm run quackle:health` o `npm run smoke:ci`.
- Rating API: `npm --prefix rating-api run dev|build|start`; migrazioni: `npm --prefix rating-api run db:generate` e `db:migrate`.
- Test: FE con Vitest; servizio Quackle con `pytest -q` in `service-quackle/tests`.

## Integrazione Quackle (zero‑tolerance)
- Nessun fallback a mosse finte o mini-lessici: input invalido → 400, lessico non pronto → 500 `lexicon_not_ready` (mai 200 con `pass`).
- Env principali: `QUACKLE_LEXDIR=/data/lexica`, `QUACKLE_APPDATA_DIR=/data/appdata`, `QUACKLE_LEXICON=enable1.15` (+ opzionali `GADDAG_URL`, `DAWG_URL`).
- Frontend: configurare `VITE_QUACKLE_SERVICE_URL` (es. `http://localhost:8080`).
- `/best-move` accetta board in più forme; preferita: mappa 1‑based "r,c" → `{letter,isBlank}`.
- Coordinate in uscita: le `row/col` dei tiles sono 0‑based e coincidono con la griglia visuale del frontend (stella al centro riga=7,col=7). Nessun aggiustamento necessario lato client.

## Pattern e convenzioni del repo
- TypeScript: indentazione 2 spazi. Componenti React in PascalCase (es. `BoardTile.tsx`); util/hook in camelCase (es. `useGame.ts`).
- Test vicino ai file (FE) e in `service-quackle/tests` (Python). Aggiungi test per nuova logica e mantieni il verde.
- Scoring Scrabble: usa sempre `calculateScore()` da `src/utils/scoring.ts`. I moltiplicatori e le caselle speciali provengono solo da `src/config/boardConstants.ts` (niente duplicazioni). Evita qualsiasi calcolo alternativo.
- Commit: stile convenzionale (`feat|fix|chore|docs(scope): msg`). Aggiorna `.env.example` se aggiungi variabili.
- Sicurezza: non committare segreti. Env richieste: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `VITE_QUACKLE_SERVICE_URL`; per rating‑api `DATABASE_URL`, `REDIS_URL`.

## Vincoli della Constitution (da rispettare)
- Correctness First: la validazione mosse Quackle è fonte di verità. Rispetto determinismo/idempotenza; niente scorciatoie.
- Test‑First (non negoziabile): ogni modifica deve introdurre/aggiornare test; ciclo Red→Green→Refactor. Non indebolire test esistenti.
- Micro‑steps: PR piccole (≤ 5 file, ≤ 300 LOC netti), reversibili. Splitte cambi grandi in più PR.
- Contratti & Golden: non cambiare schemi/coordinate/errori senza ADR; aggiorna fixture/golden solo con motivazione.
- Refactoring ≠ feature: cambi comportamentali richiedono spec/ADR; il refactor non deve alterare API o semantica.

## Esempi rapidi utili
- Verifica health Quackle: `GET /health` deve mostrare `engine_ready:true` e dimensioni GADDAG/DAWG > 0.
- Chiamata base `/best-move` con board vuota (legacy grid 15x15 di punti) e rack `AEIRSTZ` → deve produrre una mossa non `pass`.
- Debug strategia: `GET /debug/strategy` e `GET /debug/strategy-probe` (se esposti) per verificare file in `/data/appdata/strategy`.
- Punteggio mosse: per qualsiasi validazione in FE o ricalcolo mosse Quackle, utilizzare `calculateScore({ tiles, existingBoard })`.

## Dove guardare per esempi
- Integrazione servizio: `service-quackle/README.md` (payload, normalizzazione, errori, env).
- Multiplayer FE: `src/services/multiplayer/README.md` (contratti e helper endgame).
- Comandi e convenzioni riassunti: `AGENTS.md`.

Nota per agenti: preferisci patch mirate senza rinominare file. Non introdurre fallback di comodo nel percorso Quackle: i test e gli smoke si aspettano errori espliciti o mosse reali. Mantieni ESLint/Vitest/Pytest verdi prima di concludere.