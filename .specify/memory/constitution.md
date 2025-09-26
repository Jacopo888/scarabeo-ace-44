<!--
SYNC IMPACT REPORT
===================
Version Change: Template → 1.0.0 (Initial ratification)
Modified Principles:
- PRINCIPLE_1: Template → I. Correctness First (NON-NEGOTIABLE)
- PRINCIPLE_2: Template → II. Simplicity & Clean Architecture
- PRINCIPLE_3: Template → III. Test-First Development (NON-NEGOTIABLE)
- PRINCIPLE_4: Template → IV. Stability & Security by Default
- PRINCIPLE_5: Template → V. Observability & Performance

Added Sections:
- 0. Definition of Refactoring (NON-NEGOTIABLE)
- VI. Micro-steps & Patch Size Limits
- Contracts & Golden Tests
- Spec Kit Integration Gates
- Observability Standard (OpenTelemetry)

Removed Sections:
- Generic template sections replaced with domain-specific content

Templates Status:
✅ plan-template.md - Constitution Check gates align with new principles
✅ spec-template.md - Review checklist compatible with quality standards
✅ tasks-template.md - TDD approach matches Test-First principle
✅ agent-file-template.md - Structure compatible with project organization

Follow-up TODOs:
- None - all placeholders resolved with concrete values
-->

# Scarabeo-Ace-44 — Engineering Constitution
<!-- Web-based Scrabble platform with vs AI, multiplayer, puzzles, and advanced analytics -->

## 0. Definition of Refactoring (NON-NEGOTIABLE)
**Refactoring** means changing the **internal structure** of the code **without changing** its observable behavior (APIs, payloads, status codes, UX). It is performed via a series of small, behavior-preserving transformations. Anything that **alters behavior** is a feature and must follow the feature process (new spec/ADR/review). :contentReference[oaicite:0]{index=0}

---

## Core Principles

### I. Correctness First (NON-NEGOTIABLE)
Move validation is the single source of truth for all Scrabble game logic. The Quackle engine integration MUST be deterministic (fixed seeds), idempotent, and isolated via process boundaries. Engine failures MUST NOT block server operations (circuit breaker and controlled fallbacks).

**Rationale:** Game integrity drives user trust and fair competitive play.

### II. Simplicity & Clean Architecture
Prefer simple, cohesive designs with clear responsibilities (SRP). APIs must be clean and intuitive. No workarounds, placeholder code, or fragile solutions. All code must be readable, idiomatic, and maintainable.

**Rationale:** Complexity raises debugging cost and technical debt; simplicity speeds safe change.

### III. Test-First Development (NON-NEGOTIABLE)
Every PR MUST add or update tests. Strict **Red → Green → Refactor** cycles. Strong coverage on critical paths:
- **Unit**, **Integration** (API + Quackle), **End-to-End** (full games/patterns), **Property-based** (board/moves), and **Load/Soak** (WebSocket fan-in/fan-out).
Existing tests MUST NOT be weakened.

### IV. Stability & Security by Default
No new feature may break existing functionality. Mandatory security posture: **OWASP Top 10** mitigations, CSP headers, input sanitization, CSRF where relevant. Anti-cheat MUST detect suspicious patterns (latency anomalies, rapid client/AI switching). **GDPR** compliance required. :contentReference[oaicite:1]{index=1}

### V. Observability & Performance
Structured logging, metrics, and tracing are required across all services. Non-negotiable SLOs: **p95 move validation ≤ 75 ms**, **p99 ≤ 150 ms**, **p95 round-trip ≤ 200 ms**; support for **10k** concurrent WebSocket connections via horizontal scaling.

---

## VI. Micro-steps & Patch Size Limits
- Only **small, reversible** steps; **no big-bang** refactors.
- Per PR guideline: **≤ 5 files** and **≤ 300 LOC** net diff. Larger efforts must be split into safe sequences.
- PRs must be **revert-friendly** and justified; each step recorded in a **Refactor Journal**.
- Development workflow: **Red → Green → Refactor**; tests drive design.

---

## Contracts & Golden Tests
- **Contract invariants**: endpoints, JSON schemas, error codes/semantics, timeouts, and side-effects remain unchanged.
- **Format-sensitive** areas (e.g., **board coordinates**) must have **golden fixtures/snapshots**; the build fails if these change without an ADR.
- Each PR must include: unit + integration + **golden** updates; “fixing the golden” without rationale is forbidden.

---

## Architecture & Technology Standards
**Stack requirements:** Respect the existing backend and the C++ bridge to the Quackle engine. Expose versioned AI service APIs (v1, v2) with explicit contracts. Real-time multiplayer via **WebSocket/SSE** with stateless workers behind load balancers; ephemeral state on **Redis/Pub/Sub**; transactional DB persistence.

**Scaling requirements:** Session affinity or consistent-hash routing; **back-pressure** and **rate limiting** per user/connection; **idempotency keys** for commands; **circuit breakers** and **bulkheads** for isolation.

**Data management:** Light event-sourcing for move history; board state snapshots for replay/analysis; mandatory DB migrations with backfill paths; no schema-breaking changes without proper migrations.

---

## Development & Quality Standards
**Code quality:** Static analysis, auto-formatting, strict linting, and strong typing are mandatory. Every bug must be reproduced → failing test → fix → passing test. **Golden tests** for protocol/format stability (coordinates, notation).

**Review process / CI:** Trunk-based development with short-lived branches. PR review mandatory. No merges on failed builds. Pipeline: **lint+unit → integration → e2e → security (SCA/SAST) → performance smoke → canary deploy** with feature flags and automatic rollback.  
**Documentation:** English-only. **ADRs** for architectural decisions; **SemVer** for API versioning; human-readable changelogs; README/docs always current. :contentReference[oaicite:2]{index=2}

---

## Spec Kit Integration Gates
This Constitution is **binding** for the Spec-Driven flow:
- **/specify** — refactor scope, invariants, risks, acceptance.
- **/plan** — detailed technical plan, milestones, PR/LOC limits.
- **/tasks** — executable, test-first task list.
- **/analyze** — **gate** that checks alignment with the Constitution and that invariants/tests are intact before implementation.
- **/implement** — step-by-step execution, with **Refactor Journal** and `MEMORY.md` updates.

Any request that **changes behavior** → **STOP**, open an ADR + new spec.

---

## Observability Standard (OpenTelemetry)
Instrument all services with **OpenTelemetry** for **traces, metrics, and logs**; use a centralized **OTel Collector**; enable cross-signal correlation (trace-id ⇄ logs). SLOs (p95/p99) must be server-side measured and surfaced in CI as **performance smoke**. :contentReference[oaicite:3]{index=3}

---

## Governance
This Constitution supersedes prior development practices and policies. PRs and reviews MUST verify compliance. Any deviation from simplicity must be **explicitly justified** and documented.

**Amendment Process:** Constitution changes require full team approval and a migration plan. Breaking changes to principles → **MAJOR**; new principles → **MINOR**; clarifications/wording → **PATCH**.

**Compliance Review:** Periodic audits of adherence; SLOs measured in CI/CD; security reviews required for all user-facing features.

**Version:** 1.0.0 | **Ratified:** 2025-09-27 | **Last Amended:** 2025-09-27
