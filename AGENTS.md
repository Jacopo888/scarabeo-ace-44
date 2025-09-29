# Repository Guidelines

## Project Structure & Module Organization
- `src/` React + TypeScript app (Vite). Tests live next to code as `*.test.ts(x)`.
- `rating-api/` Express + Drizzle (TypeScript). Tests in `src/__tests__/`.
- `service-quackle/` FastAPI microservice that bridges Quackle. Python tests in `tests/`.
// engine/ was a legacy build pipeline for Quackle (wrapper + Docker). It has been removed in favor of `service-quackle/`.
- `public/`, `dist/` static and build output; `docs/` documentation; `scripts/` utilities; `data/` mounted volume for lexica.

## Build, Test, and Development Commands
- Frontend: `npm i`, `npm run dev`, `npm run build` (prod guard: `npm run build:prod`), `npm test`.
- Lint: `npm run lint`.
- Rating API: `npm --prefix rating-api run dev|build|start`, tests `npm --prefix rating-api test`.
- DB: `npm --prefix rating-api run db:generate` and `db:migrate`.
- Quackle service: `docker compose up -d quackle-service` (or `uvicorn quackle_service.main:app` with envs). Smoke: `QUACKLE_BASE=http://localhost:8080 npm run quackle:health`.
- Full stack (API + DBs): `docker-compose up --build`.

## Coding Style & Naming Conventions
- TypeScript, 2-space indent. React components: PascalCase files (e.g., `BoardTile.tsx`). Utilities/hooks: camelCase (e.g., `useGame.ts`).
- Tests: `*.test.ts` or `*.test.tsx` near source; rating-api uses `src/__tests__/`.
- ESLint (flat config) is authoritative: run `npm run lint` and address warnings. Tailwind for styling; keep JSX tidy and avoid stray `console` logs.

## Testing Guidelines
- Frontend: Vitest (`jsdom`). Run `npm test`.
- Rating API: Vitest. Run `npm --prefix rating-api test`.
- Quackle service: FastAPI tests via `pytest -q` in `service-quackle/` (create venv and install pytest if missing). Ensure `/health` is green and `/best-move` returns a non-"pass" move for basic boards.

## Commit & Pull Request Guidelines
- Commits: imperative present (“fix: normalize rack”), keep focused. History mixes languages; prefer English and conventional prefixes (`feat|fix|chore|docs(scope): msg`).
- PRs: include description, rationale, reproducible steps, linked issues, and screenshots for UI. Update docs and `.env.example` when adding config. Keep PRs small and testable.

## Security & Configuration Tips
- Do not commit secrets. Required envs include `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `VITE_QUACKLE_SERVICE_URL`, and for rating-api `DATABASE_URL`, `REDIS_URL`. Quackle: `QUACKLE_LEXDIR`, `QUACKLE_APPDATA_DIR`, `QUACKLE_LEXICON`, `CORS_ORIGINS`.
- Mount `./data:/data` locally for lexicon files and appdata.

## Agent-Specific Instructions
- Prefer minimal, targeted patches; keep existing structure and naming. Do not rename files without need. Add tests for new logic and keep all tests passing.

