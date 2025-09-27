# Quickstart — Behavior-Preserving Refactor Waves

This quickstart outlines how to run the safety nets and validate no behavior changes while refactoring.

## Pre-wave snapshot
- Create annotated tag `pre-refactor-waveN` on main.

## Run tests
- Frontend: `npm test`
- Rating API: `npm --prefix rating-api test`
- Quackle service: `pytest -q` in `service-quackle/`
- Smoke: `npm run quackle:health` (requires QUACKLE_BASE)

## Golden fixtures
- Coordinate round-trip: A1, H8, O15
- Payload snapshot: `test_payload.json`
- Simulation: `fixtures/simulation/{simulation_empty_board_YYYYMMDD.json, simulation_mid_game_anchors_YYYYMMDD.json}`

## Perf smoke (SLO gates)
- /best-move: p95 ≤ 75 ms, p99 ≤ 150 ms
- UI round-trip: p95 ≤ 200 ms
- Measure via OTel histograms/percentiles; surface in CI

## Bootstrap lexica
- Ensure `${QUACKLE_LEXDIR}` contains `${LEXICON_BASENAME}.{gaddag,dawg}` >0B
- Or set `GADDAG_URL`, `DAWG_URL` for runtime download
- `/health` must report `engine_ready: true` with sizes
