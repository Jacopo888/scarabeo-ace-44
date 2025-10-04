# ADR: Board Matrix Migration Completion

Date: 2025-10-04
Status: Accepted
Authors: Engineering Team

## Context
Originally the game board was represented in multiple forms (Map<string, PlacedTile>, sparse records, transient adapters). This duplication increased cognitive load, risked divergence in validation/scoring, and complicated integration with Quackle. A migration plan (Steps 1–11) introduced a single canonical structure: a 15×15 matrix `(PlacedTile | null)[][]` stored in `GameState.boardMatrix`. All core algorithms (validation, word scanning, scoring, move application) were re-written as pure functions over this structure.

## Decision
Adopt `boardMatrix` as the ONLY internal runtime representation of the board. Remove legacy wrappers (`wordFinder`, `newWordFinder` wrapper, Map-based validation helpers) and update all call sites. Persisted DB state (record of `"r,c" -> tile`) is converted immediately to `boardMatrix` on load; outbound payloads for Quackle are synthesized from `boardMatrix` (1-based coords). All scoring routes funnel through `scoreMove` / `calculateScore` referencing the unified multipliers in `boardConstants`.

## Rationale
- Eliminates duplicated logic & drift between Map and matrix paths.
- Improves performance (direct index access vs Map lookups) and determinism.
- Simplifies tests & enables invariant/property-based testing.
- Ensures future features (analysis, hints, endgame solvers) rely on a single, auditable representation.

## Alternatives Considered
1. Keep dual representation (Map for sparse operations, matrix for rendering): rejected—added complexity and sync cost.
2. Compressed bitboard / packed array: postponed; premature optimization without a performance bottleneck confirmed.
3. On-demand projection (compute matrix from Map per request): increased GC churn, unnecessary.

## Consequences
Positive:
- Reduced surface for bugs in move validation & scoring.
- Faster developer onboarding (one mental model).
- Easier introduction of property-based tests (now added for `scoreMove`).

Neutral/Negative:
- Some operations on very sparse early boards may allocate more memory (15×15 fixed) but negligible (225 cells).
- Removal of Map compatibility test may hide regressions if Map reintroduced—intentional enforcement.

## Invariants Added
- `board.invariants.test.ts`: immutability, scoring/word formation consistency.
- `scoreMove.property.test.ts`: probabilistic monotonicity & bingo bonus checks.

## Rollout & Migration Steps (Summary)
1. Introduce `boardMatrix` alongside legacy Map.
2. Convert core scoring & validation to matrix.
3. Migrate tests incrementally (17→8→0 failures path).
4. Add invariants; remove Map usage in multiplayer submit.
5. Delete legacy word finder & validation wrappers.
6. Remove residual Map compatibility test.

## Monitoring / Observability
No runtime regression observed in test suite. Future: add timing metrics around `scoreMove` and `canPlace` to confirm SLO adherence (p95 ≤ 75 ms) under load scenarios.

## Follow-Up Tasks
- (Optional) Introduce a performance benchmark harness.
- Add property-based tests for cross words & multiplier edge cases.
- Document quackle payload schema in a formal OpenAPI component.

## Decision Record
This ADR closes the migration initiative and establishes the matrix board as a stable contract for internal logic.
