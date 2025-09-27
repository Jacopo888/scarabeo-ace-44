# Tasks: Scarabeo-Ace-44 — Behavior-Preserving Complete Refactor (main-only)

**Input**: Design documents from `/specs/001-title-scarabeo-ace/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

## Execution Flow (main)
```
1. Load plan.md, research.md, data-model.md, contracts/
2. Generate TDD-first tasks grouped by waves; mark [P] when parallelizable
3. Ensure each task has exact file paths; tests before implementation
4. Order: Setup → Tests → Models → Services → Endpoints → Polish
5. Return: tasks ready for execution
```

## Phase 0 — Preconditions (run once on main)
- [ ] T000 Tag snapshot main (annotated): create tag `pre-refactor-wave1` and push tags
  - Path: repo root
  - Command: git tag -a pre-refactor-wave1 -m "snapshot before wave 1" && git push --tags
  - Acceptance: `git show pre-refactor-wave1` shows message & metadata
- [ ] T000b Ensure CI is green (lint/unit/integration/e2e)
  - Path: CI pipeline

## Wave 0 — Safety Nets & Mapping
- [x] T001 Create coords golden fixture file
  - Path: `fixtures/coords/test_payload.json`
  - Content: A1, H8, O15 cases; shared by FE + service tests
- [x] T002 [P] FE test: coordinates round-trip encoding/decoding
  - Path: `src/__tests__/coords.roundtrip.test.ts`
  - Dep: T001
- [x] T003 [P] Service test (pytest): coordinates round-trip
  - Path: `service-quackle/tests/test_coords_roundtrip.py`
  - Dep: T001
- [x] T004 Create quackle payload golden fixture
  - Path: `fixtures/quackle/test_payload.json`
- [x] T005 [P] Service test: payload shape snapshot
  - Path: `service-quackle/tests/test_quackle_payload_snapshot.py`
  - Dep: T004
- [x] T006 Create health readiness golden fixture
  - Path: `fixtures/health/expected.json`
- [x] T007 [P] Service integration test: /health matches fixture (engine_ready and sizes>0)
  - Path: `service-quackle/tests/test_health_golden.py`
  - Dep: T006
- [x] T008 Property-based tests: placements & anchors
  - Path: `service-quackle/tests/test_property_placements.py`
  - Notes: low count, deterministic seed
- [x] T009 [P] Inventory report: big files
  - Path: `docs/inventory/big-files.md`
- [x] T010 [P] Inventory report: long files
  - Path: `docs/inventory/long-files.md`
- [x] T011 [P] "Map before move" docs for top 5 long/complex files
  - Path: `docs/readme_<path-with-dots>.md`

## Wave 1 — Debloat & Bootstrap
- [x] T012 Update .gitignore with heavy/derived patterns
  - Path: `.gitignore`
- [x] T013 Stop tracking lexica binaries
  - Path: `lexica/` and others; use `git rm --cached`
- [x] T014 Remove strategy artifacts and add STRATEGY.md
  - Path: `data/appdata/strategy/**` and `STRATEGY.md`
- [x] T015 Clean logs/tmp/venv and duplicated samples
  - Path: `.venv/`, `logs/`, `*.log`, `*.tmp`, duplicates
- [x] T016 Canonicalize fixture name to test_payload.json
  - Path: `fixtures/` and tests referencing old name
- [x] T017 CI job: repo size report (git count-objects + git-sizer)
  - Path: CI config

## Wave 2 — Lexica Runtime Bootstrap (no API shape change)
- [x] T018 Script `bootstrap_lexica`
  - Path: `service-quackle/scripts/bootstrap_lexica.sh` (or .py)
  - Behavior: read QUACKLE_LEXDIR, LEXICON_BASENAME=enable1, GADDAG_URL/DAWG_URL; download if missing; verify sizes>0; print sizes
- [x] T019 Wire bootstrap into startup
  - Path: `service-quackle/entrypoint.sh` or app startup
- [x] T020 Tests for missing/present lexica (health engine_ready)
  - Path: `service-quackle/tests/test_health_lexica_presence.py`

## Wave 3 — Service Boundary Simplification (FastAPI)
- [x] T021 Create single adapter for Quackle
  - Path: `service-quackle/quackle_service/adapters/quackle.py`
- [x] T022 DTOs + validation (Pydantic models)
  - Path: `service-quackle/quackle_service/models.py`
- [x] T023 Extract pure helpers (encoding, rack, timeouts) + tests
  - Path: `service-quackle/quackle_service/lib/{encoding.py,rack.py,timeouts.py}`; tests in `service-quackle/tests/`

## Wave 4 — Frontend Simplification (Vite/React/TS)
- [ ] T024 [P] Split long files (>400 LOC) and move utils to `src/lib/`
  - Path: `src/**/*.{ts,tsx}`
- [ ] T025 Unify HTTP client with timeouts + optional idempotency key
  - Path: `src/services/httpClient.ts`
- [ ] T026 UI smokes with React Testing Library
  - Path: `src/__tests__/ui.smoke.test.tsx`

## Wave 5 — rating-api tidy (Express)
- [ ] T027 Split router, error middleware, config
  - Path: `rating-api/src/{router.ts,error.ts,config.ts}`
- [ ] T028 `/ping` test via Supertest and trim deps
  - Path: `rating-api/src/__tests__/ping.test.ts`

## Wave 6 — Dependency Diet & Hygiene
- [ ] T029 [P] FE deps trim (move tooling to devDependencies)
  - Path: `package.json`, `frontend deps`
- [ ] T030 [P] Service deps trim (prefer stdlib/helpers)
  - Path: `service-quackle/requirements.txt`
- [ ] T031 Consolidate sample data; keep two golden sims
  - Path: `fixtures/simulation/` (+ archive excluded from CI)

## Wave 7 — Observability & SLO smoke (non-functional)
- [ ] T032 Add/verify OTel histograms for /best-move
  - Path: `service-quackle/` (metrics integration)
- [ ] T033 CI step extracting p95/p99
  - Path: CI config

## Parallel Execution Examples
```
# Parallel (independent files)
Run together: T002, T003, T005, T007, T009, T010, T011

# Then
Run: T012 → T013 → T014 → T015 → T016 → T017
```

## Dependencies
- T001 before T002/T003
- T004 before T005
- T006 before T007
- T018 before T019/T020
- DTOs/helpers (T022/T023) can proceed after Wave 2 health tests are stable

## Validation Checklist
- [ ] All contracts have corresponding tests (health, best-move)
- [ ] All entities have model tasks (Lexicon Assets, Health Probe, Golden Fixtures, Client Requests)
- [ ] All tests come before implementation
- [ ] Parallel tasks truly independent
- [ ] Each task specifies exact file path
- [ ] No task modifies same file as another [P] task
