# Phase 0 — Research

This document consolidates decisions, rationale, and alternatives for the behavior-preserving refactor & debloat.

## Decisions

1) Safety Nets First (Golden + Property Tests)
- Decision: Add golden fixtures for coordinates (A1,H8,O15), Quackle payload encodings, and `/health` lexicon sizes; add minimal property-based tests for placement/anchors.
- Rationale: Prevents regressions on format-sensitive areas; enables fast revert-friendly steps.
- Alternatives: Rely on existing tests only — rejected due to insufficient guard on coordinate/payload invariants.

2) Debloat Strategy
- Decision: Remove lexica/strategies/logs from VCS; ignore via .gitignore; provide runtime bootstrap (mount or fetch).
- Rationale: Reduce repo size ≥70%, avoid derived artifacts in history.
- Alternatives: Keep binaries in repo — rejected due to weight and maintenance cost.

3) Service Boundary Simplification
- Decision: Introduce DTOs (Pydantic) for requests/responses; single Quackle adapter; extract pure helpers.
- Rationale: Improves readability and testability without changing behavior.
- Alternatives: Leave as-is — rejected to meet simplicity/maintainability goals.

4) Frontend Unification
- Decision: Single typed HTTP client with explicit timeouts and optional idempotency key; split long files (>400 LOC) by responsibility; extract pure utils to `src/lib`.
- Rationale: Cut duplication and complexity; keep UX identical.

5) Performance SLOs & Observability
- Decision: Enforce /best-move p95 ≤ 75 ms, p99 ≤ 150 ms; UI round-trip p95 ≤ 200 ms; measure via OTel histograms/percentiles.
- Rationale: Align with Constitution; maintain user-perceived performance.

## Clarifications Resolved
- SLO numbers, fixture consolidation policy (canonical `test_payload.json`, two dated simulation fixtures under `fixtures/simulation/`), repo size target ≥70%, main-only workflow with annotated tags and revert, lexica bootstrap envs and readiness gates.

## Open Questions
- None at this time.

## References
- Constitution v2.1.1 (Observability & Performance, Test-First, Simplicity)
- Quackle integration notes
