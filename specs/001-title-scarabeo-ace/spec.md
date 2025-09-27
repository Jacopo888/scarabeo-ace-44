
# Feature Specification: Scarabeo-Ace-44 — Complete Refactor & Debloat (behavior-preserving)

**Workflow**: Main-only (no feature branches). Use **annotated tags** as pre-wave snapshots and **revert-based rollback** for any regression.  
**Created**: 2025-09-27  
**Status**: Draft  
**Input** (summary): "Refactor and debloat the repository to make it simpler, smaller, and easier to maintain while strictly preserving external behavior (APIs, payloads, UX, Quackle I/O). Remove large/derived assets from VCS (lexica, strategy artifacts, logs), reduce dependency surface, and keep flows linear and readable. Maintain invariants: endpoints, JSON schemas, error codes/messages, timeouts, board/rack formats and Quackle request/response semantics, deterministic/idempotent Quackle integration, and performance SLOs. Scope spans Frontend UI/model/client, service-quackle validation/bridge/health/bootstrap, rating-api module boundaries/tests, and repo housekeeping. Deliver in **small waves of atomic commits to main**, guarded by golden fixtures and a CI size report; optional history rewrite after completion."

## Execution Flow (main)
```

1. Parse user description from Input
   → If empty: ERROR "No feature description provided"
2. Extract key concepts from description
   → Identify: actors, actions, data, constraints
3. For each unclear aspect:
   → Mark with [NEEDS CLARIFICATION: specific question]
4. Fill User Scenarios & Testing section
   → If no clear user flow: ERROR "Cannot determine user scenarios"
5. Generate Functional Requirements
   → Each requirement must be testable
   → Mark ambiguous requirements
6. Identify Key Entities (if data involved)
7. Run Review Checklist
   → If any [NEEDS CLARIFICATION]: WARN "Spec has uncertainties"
   → If implementation details found: ERROR "Remove tech details"
8. Return: SUCCESS (spec ready for planning)

Main-only safety notes:

* Before each wave: create an **annotated tag** snapshot (e.g., `pre-refactor-wave1`).
* If a regression occurs: **revert** the offending commit(s) on main (no history rewrite).

```

---

## ⚡ Quick Guidelines
- ✅ Focus on WHAT users need and WHY
- ❌ Avoid HOW to implement (no tech stack, APIs, code structure)
- 👥 Written for business stakeholders, not developers

### Section Requirements
- **Mandatory sections**: Must be completed for every feature
- **Optional sections**: Include only when relevant to the feature
- When a section doesn't apply, remove it entirely (don't leave as "N/A")

### For AI Generation
When creating this spec from a user prompt:
1. **Mark all ambiguities**: Use [NEEDS CLARIFICATION: specific question] for any assumption you'd need to make
2. **Don't guess**: If the prompt doesn't specify something (e.g., "login system" without auth method), mark it
3. **Think like a tester**: Every vague requirement should fail the "testable and unambiguous" checklist item
4. **Common underspecified areas**:
   - User types and permissions
   - Data retention/deletion policies  
   - Performance targets and scale
   - Error handling behaviors
   - Integration requirements
   - Security/compliance needs

---

## User Scenarios & Testing *(mandatory)*

### Primary User Story
As a maintainer of Scarabeo-Ace-44, I want the codebase to be lean and easy to understand without changing what users and integrators experience, so that maintenance is faster, risk is lower, and the system remains reliable and performant.

### Acceptance Scenarios
1. **Given** the current behavior on main, **When** the refactored system is built and deployed, **Then** all public endpoints, payload schemas, error codes/messages, timeouts, and side-effects are unchanged and existing clients continue to work without modification.
2. **Given** lexicon assets are present and readable at runtime, **When** `/health` is called, **Then** it reports `engine_ready: true` and includes non-zero sizes for required lexica.
3. **Given** standard golden fixtures (empty board + known rack; mid-game board with anchors), **When** `/best-move` is invoked, **Then** the top move and ranking are identical to baseline on main.
4. **Given** lexicon assets are missing or unreadable at startup, **When** the service starts, **Then** the system fails fast and `/health` reflects not ready; no silent fallback occurs.
5. **Given** the repository with debloated assets, **When** a fresh clone is built, **Then** runtime bootstrap ensures lexica/strategy runtime assets are mounted/fetched as configured, or the system fails fast with clear diagnostics.
6. **Given** the UI is used by an end user, **When** they navigate and play, **Then** there are no visible UI changes or regressions in interaction patterns.

### Edge Cases
- Service starts with missing environment configuration (e.g., `QUACKLE_LEXDIR`, remote sources). System must fail fast and explain what is missing.
- Lexicon files exist but have zero size or cannot be read. Health must report not ready and indicate sizes/validation failure.
- Large or complex mid-game boards with anchors still produce identical best-move decisions within the established timeouts.
- Timeouts or degraded performance: p95/p99 must remain within the existing SLOs from the Constitution. [NEEDS CLARIFICATION: list exact numeric SLO thresholds referenced by "Constitution"].
- Coordinate encoding/decoding errors are rejected with clear errors; malformed input is a hard failure with unchanged error taxonomy.

## Requirements *(mandatory)*

### Functional Requirements
- **FR-001 (Behavior Stability)**: External behavior MUST remain unchanged across APIs, payload schemas, error codes/messages, timeouts, side-effects, board/rack formats, and Quackle request/response semantics.
- **FR-002 (Determinism & Isolation)**: Quackle integration MUST remain deterministic, idempotent, and process-isolated.
- **FR-003 (Performance SLOs)**: Performance at p95/p99 MUST meet existing SLOs; performance smoke in CI MUST enforce gates. [NEEDS CLARIFICATION: exact SLO numbers].
- **FR-004 (Debloat — Lexica)**: Lexicon binaries MUST NOT be tracked in VCS. Repository MUST add ignore rules for `*.gaddag`, `*.dawg`, `*.dawg.gz`.
- **FR-005 (Runtime Lexica Sourcing)**: At runtime, the system MUST source lexica from a configured location; if missing/unreadable, startup MUST hard-fail and `/health` MUST reflect not ready.
- **FR-006 (Health Reporting)**: `/health` MUST expose readiness including non-zero lexicon sizes and an `engine_ready` flag.
- **FR-007 (Strategies Location)**: Strategy source/tuning MUST live in the engine repository; this repo MUST only reference runtime assets and MAY fetch/generate them at startup per configuration.
- **FR-008 (Remove Derived/Heavy Artifacts)**: Committed virtual environments, logs, and generated strategy data MUST be removed from VCS and ignored going forward.
- **FR-009 (Samples Consolidation)**: Oversized/duplicated samples MUST be consolidated (e.g., keep one of `test-payload.json` vs `test_payload.json`; unify `simulation_*.json` policy). [NEEDS CLARIFICATION: which filenames to keep].
- **FR-010 (Simplify Logic)**: Replace complex/indirect flows with straightforward, readable logic; collapse dead code/feature flags; extract small pure functions per responsibility.
- **FR-011 (Boundary Validation)**: Replace ad-hoc parsing with explicit request validation at boundaries (clear error taxonomy preserved).
- **FR-012 (Client Layer Unification)**: There MUST be a single typed client layer with explicit timeouts and idempotency handling.
- **FR-013 (File Size Budget)**: Any file > 400 LOC MUST be split; target 200–300 LOC per file by responsibility.
- **FR-014 (Dependency Diet)**: Remove unused dependencies; avoid overlapping utility/UI libraries; minimize runtime deps and move tooling to development scope.
- **FR-015 (Golden Fixtures — Coordinates)**: Add a golden fixture to verify coordinate serialization/round-trip consistency between client and service.
- **FR-016 (Golden Fixtures — Payloads)**: Add a golden fixture for Quackle request payload encodings (board/rack).
- **FR-017 (Health Fixture)**: Add a golden fixture validating `/health` response including lexicon sizes.
- **FR-018 (Property-based Tests)**: Add property-based tests for placement coherence and anchors.
- **FR-019 (E2E Smokes)**: Provide e2e smokes for empty board + known rack, and a mid-game board with anchors.
- **FR-020 (Acceptance Gates)**: Build, lint, and test MUST be green; golden fixtures MUST remain unchanged unless accompanied by an ADR.
- **FR-021 (Repo Size Target)**: Repo size reduction MUST be reported in CI; target reduction ≥ the stated goal when lexica are removed. [NEEDS CLARIFICATION: exact target percentage].
- **FR-022 (Coordinate Encoding Errors)**: Malformed coordinates MUST result in a hard-fail test and clear error, with no silent coercion.

### Key Entities *(include if feature involves data)*
- **Lexicon Assets**: Runtime GADDAG/DAWG files required for move generation; must be present, non-zero size, and readable at runtime; not stored in VCS.
- **Health Probe**: Public readiness endpoint reporting engine readiness and lexicon sizes; acts as gate when assets are missing/invalid.
- **Golden Fixtures**: Canonical inputs/outputs used to ensure behavior stability for coordinates, payloads, and health reporting.
- **Strategy Artifacts**: Derived assets produced/maintained in the engine repository; referenced here only as runtime assets per strategy selection.
- **Client Requests**: Typed requests from UI or consumers with explicit timeouts and idempotency keys; schemas validated at boundaries.

---

## Clarifications

### Session 2025-09-27
- Performance SLOs:
   - /best-move server-side validation/compute: p95 ≤ 75 ms, p99 ≤ 150 ms.
   - UI round-trip (click → rendered): p95 ≤ 200 ms.
   - Measurement: OTel histograms on http.server.duration and/or custom metrics; compute p95/p99 via percentiles.
- Fixtures consolidation:
   - Canonical file: keep `test_payload.json` (snake_case).
   - Simulation golden fixtures live under `fixtures/simulation/`:
      - `simulation_empty_board_YYYYMMDD.json`
      - `simulation_mid_game_anchors_YYYYMMDD.json`
      - Update date only when baseline content changes; move other simulations to `fixtures/archive/` excluded from CI.
- Repo size target (CI report): ≥ 70% reduction vs main before cleanup; measure via `git count-objects -vH` (pack size) and `git-sizer` for history/bottlenecks.
- Workflow: main-only implementation; planning artifacts (`specs/001-title-scarabeo-ace/*`) live on main; before each wave create annotated tag (e.g., `pre-refactor-wave1`); rollback via `git revert` (no history rewrite).
- Lexica bootstrap & readiness:
   - Preferred sources: mounted volume at `${QUACKLE_LEXDIR}` or runtime download via `GADDAG_URL`/`DAWG_URL`.
   - Env variables: `QUACKLE_LEXDIR`, `LEXICON_BASENAME` (default `enable1`), `GADDAG_URL`, `DAWG_URL`.
   - Startup hard-fail if assets missing/unreadable; `/health` shows `engine_ready: false` with details.
   - `engine_ready: true` only if both `${LEXICON_BASENAME}.gaddag` and `${LEXICON_BASENAME}.dawg` exist in `${QUACKLE_LEXDIR}` and have size > 0.

---

## Review & Acceptance Checklist
*GATE: Automated checks run on main*

### Content Quality
- [ ] No implementation details (languages, frameworks, APIs)
- [ ] Focused on user value and business needs
- [ ] Written for non-technical stakeholders
- [ ] All mandatory sections completed

### Requirement Completeness
- [ ] No [NEEDS CLARIFICATION] markers remain
- [ ] Requirements are testable and unambiguous  
- [ ] Success criteria are measurable
- [ ] Scope is clearly bounded
- [ ] Dependencies and assumptions identified

---

## Execution Status
*Updated by main() during processing*

- [ ] User description parsed
- [ ] Key concepts extracted
- [ ] Ambiguities marked
- [ ] User scenarios defined
- [ ] Requirements generated
- [ ] Entities identified
- [ ] Review checklist passed
```
"
