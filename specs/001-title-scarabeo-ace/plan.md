
# Implementation Plan: Scarabeo-Ace-44 — Behavior-Preserving Complete Refactor (main-only)

**Branch**: `[001-title-scarabeo-ace]` | **Date**: 2025-09-27 | **Spec**: `/specs/001-title-scarabeo-ace/spec.md`
**Completion**: Macro change completed on 2025-09-30 (all waves delivered; behavior preserved)
**Input**: Feature specification from `/specs/001-title-scarabeo-ace/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from file system structure or context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Fill the Constitution Check section based on the content of the constitution document.
4. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
5. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (e.g., `CLAUDE.md` for Claude Code, `.github/copilot-instructions.md` for GitHub Copilot, `GEMINI.md` for Gemini CLI, `QWEN.md` for Qwen Code or `AGENTS.md` for opencode).
7. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
Primary requirement: refactor and debloat the repository while strictly preserving external behavior (APIs, payloads, error codes/messages, timeouts, UX, Quackle I/O). Technical approach: trunk-based, main-only, small reversible commits; add safety nets (golden fixtures, property-based tests), debloat heavy/derived artifacts (lexica, strategies, logs), simplify service boundaries (DTOs + single adapter), unify client, and enforce CI gates including performance SLOs (p95/p99).

## Technical Context
**Language/Version**: TypeScript (frontend + Node), Python 3.x (FastAPI), C++ (Quackle wrapper)  
**Primary Dependencies**: Vite/React/TS, FastAPI, Express + Drizzle, Vitest, Pytest, Docker  
**Storage**: Postgres (rating-api), Redis (rating-api), filesystem-mounted lexica  
**Testing**: Vitest (FE + rating-api), Pytest (service-quackle), smoke scripts in `scripts/`  
**Target Platform**: Linux (containers + local dev)
**Project Type**: web (frontend + backend services)  
**Performance Goals**: /best-move p95 ≤ 75 ms, p99 ≤ 150 ms; UI round-trip p95 ≤ 200 ms  
**Constraints**: Behavior-preserving only; no API/UX changes; repo size reduction ≥ 70%  
**Scale/Scope**: Multi-repo engine dependency; this repo includes FE, FastAPI microservice, Express rating-api, and wiring

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Alignment with Constitution:
- Correctness First: Golden fixtures for coordinates/payloads; deterministic Quackle integration preserved.
- Simplicity & Clean Architecture: Single adapter for Quackle; DTOs at service boundary; one HTTP client.
- Test-First: Wave 0 adds golden + property-based tests before code movement.
- Stability & Security: No behavior change; error taxonomy unchanged; idempotency/timeout handling explicit.
- Observability & Performance: Enforce SLOs (p95/p99) via OTel histograms in perf smoke.

Initial Constitution Check: PASS

## Project Structure

### Documentation (this feature)
```
specs/[###-feature]/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->
```
frontend/
└── src/
   ├── components/
   ├── pages/
   ├── lib/           # pure utilities (after split)
   ├── hooks/         # stateful logic
   └── services/      # unified HTTP client

service-quackle/
└── quackle_service/   # FastAPI app; add DTOs, single adapter

rating-api/
└── src/               # split router.ts, error.ts, config.ts; tests

specs/001-title-scarabeo-ace/
└── {plan.md, research.md, data-model.md, quickstart.md, contracts/}

fixtures/
└── simulation/{simulation_empty_board_YYYYMMDD.json, simulation_mid_game_anchors_YYYYMMDD.json}
```

**Structure Decision**: Web application (frontend + multiple backend services). Align to folders above; keep docs under `specs/001-title-scarabeo-ace/` and fixtures under `fixtures/`.

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context** above:
   - For each NEEDS CLARIFICATION → research task
   - For each dependency → best practices task
   - For each integration → patterns task

2. **Generate and dispatch research agents**:
   ```
   For each unknown in Technical Context:
     Task: "Research {unknown} for {feature context}"
   For each technology choice:
     Task: "Find best practices for {tech} in {domain}"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - Entity name, fields, relationships
   - Validation rules from requirements
   - State transitions if applicable

2. **Generate API contracts** from functional requirements:
   - For each user action → endpoint
   - Use standard REST/GraphQL patterns
   - Output OpenAPI/GraphQL schema to `/contracts/`

3. **Generate contract tests** from contracts:
   - One test file per endpoint
   - Assert request/response schemas
   - Tests must fail (no implementation yet)

4. **Extract test scenarios** from user stories:
   - Each story → integration test scenario
   - Quickstart test = story validation steps

5. **Update agent file incrementally** (O(1) operation):
   - Run `.specify/scripts/bash/update-agent-context.sh copilot`
     **IMPORTANT**: Execute it exactly as specified above. Do not add or remove any arguments.
   - If exists: Add only NEW tech from current plan
   - Preserve manual additions between markers
   - Update recent changes (keep last 3)
   - Keep under 150 lines for token efficiency
   - Output to repository root

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, agent-specific file

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `.specify/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs (contracts, data model, quickstart)
- Each contract → contract test task [P]
- Each entity → model creation task [P] 
- Each user story → integration test task
- Implementation tasks to make tests pass

**Ordering Strategy**:
- TDD order: Tests before implementation 
- Dependency order: Models before services before UI
- Mark [P] for parallel execution (independent files)

**Estimated Output**: 25-30 numbered, ordered tasks in tasks.md

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |


## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [x] Phase 3: Tasks generated (/tasks command)
- [x] Phase 4: Implementation complete
- [x] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (none)

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*
