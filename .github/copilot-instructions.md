# scarabeo-ace-44 - AI Agent Instructions

Last updated: 2026-06-12

## Architecture

- `src/` is the Vite + React + TypeScript frontend. Vitest tests live near the code as `*.test.ts(x)`.
- `service-quackle/` is the active FastAPI service for the strong Quackle C++ bridge. Key endpoints: `GET /health`, `POST /best-move`.
- `rating-api/` is an Express + Drizzle TypeScript service with tests in `src/__tests__/`.
- `data/` is a local runtime volume for lexica and appdata; generated data is not committed.
- `api/quackle/[...path].js` is the Vercel proxy to the Quackle service.

## Essential Workflows

- Frontend: `npm i`, `npm run dev`, `npm test`, `npm run lint`, `npm run typecheck`, `npm run build:prod`.
- Quackle service: `docker compose up -d --build quackle-service`; smoke with `QUACKLE_BASE=http://localhost:8080 npm run smoke:ci`.
- Python tests: `python -m pytest service-quackle/tests -q`.
- Rating API: `npm --prefix rating-api run dev|build|start`; migrations with `db:generate` and `db:migrate`.

## Quackle Contract

- No fake moves, mini-lexicon fallback, or silent pass fallback.
- Invalid input returns 400.
- Missing lexicon returns explicit readiness/error responses.
- Board coordinates are 0-based end to end. Center is `row=7`, `col=7`.
- `top_n` is limited to 1..10.
- Hard mode may use simulation with a small bag; empty bag can use the endgame solver.
- Use `service-quackle/` as the canonical backend. The historical minimal service has been removed.

## Product Ruleset

Tilesword currently uses English Scrabble-compatible rules:

- English tile distribution and values in `src/types/game.ts`
- ENABLE / `enable1.15` dictionary and Quackle lexicon
- Standard 15x15 premium-square layout

Do not assume Italian Scarabeo rules without a dedicated migration.

## Coding Patterns

- TypeScript: 2-space indentation.
- React components use PascalCase filenames.
- Hooks and utility modules use camelCase.
- Use `calculateScore()` from `src/utils/scoring.ts` for frontend scoring.
- Premium squares come from `src/config/boardConstants.ts`; avoid duplicated board constants.
- Keep tests close to changed behavior.

## Deployment Notes

- Frontend production is Vercel: `https://tilesword.vercel.app`.
- Vercel calls Quackle via `/api/quackle`.
- The strong Quackle service is a container workload and targets Render via `render.yaml`.

## Hygiene

- Do not commit secrets, `.env*`, build output, lexica, generated strategy data, native binaries, or copied Quackle data.
- Update `.env.example` when adding config.
- Prefer focused patches and keep lint/typecheck/tests green.
