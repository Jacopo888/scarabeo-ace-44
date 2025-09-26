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
- Architecture & Technology Standards
- Development & Quality Standards

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

# Scarabeo-Ace-44 Constitution
<!-- Web-based Scrabble platform with vs AI, multiplayer, puzzles, and advanced analytics -->

## Core Principles

### I. Correctness First (NON-NEGOTIABLE)
Move validation is the single source of truth for all Scrabble game logic. No degradation of official Scrabble rules is permitted. The Quackle engine integration MUST be deterministic (fixed seeds), idempotent, and isolated via process boundaries. Engine failures MUST NOT block server operations.

**Rationale**: Game integrity is fundamental to user trust and competitive play. Any compromise in rule enforcement undermines the entire platform's value proposition.

### II. Simplicity & Clean Architecture
Prefer simple, cohesive designs with clear responsibilities. APIs must be clean and intuitive. No workarounds, placeholder code, or fragile solutions. All code must be readable, idiomatic, and maintainable.

**Rationale**: Complex systems are harder to debug, test, and extend. Simple designs reduce cognitive load and technical debt, enabling faster feature development.

### III. Test-First Development (NON-NEGOTIABLE)
Every PR MUST add or update comprehensive tests: unit (≥90% critical paths), integration (API + Quackle), end-to-end (complete games), property-based (moves/board), and load tests (WebSocket fan-in/fan-out). Tests MUST be written before implementation using strict Red-Green-Refactor cycles.

**Rationale**: Testing first ensures requirements are clear and implementation meets specifications. High test coverage prevents regressions in critical game logic.

### IV. Stability & Security by Default
No new feature may break existing functionality. Security measures are mandatory: OWASP top-10 mitigations, CSP headers, input sanitization, CSRF protection where relevant. Anti-cheat systems MUST detect suspicious patterns (latency anomalies, rapid client/AI switching). GDPR compliance is required.

**Rationale**: User trust depends on platform reliability and data protection. Security vulnerabilities can compromise competitive integrity and user data.

### V. Observability & Performance
Structured logging, metrics, and tracing are required for all services. Performance SLOs are non-negotiable: p95 move validation ≤75ms, p99 ≤150ms, p95 round-trip ≤200ms, support for 10k concurrent WebSocket connections with horizontal scaling.

**Rationale**: Real-time multiplayer games require consistent performance monitoring and quick issue resolution. Performance degradation directly impacts user experience.

## Architecture & Technology Standards

**Stack Requirements**: Respect existing backend + C++ bridge to Quackle engine. Expose versioned AI service APIs (v1, v2) with clear contracts. Real-time multiplayer via WebSocket/SSE with stateless workers behind load balancers, ephemeral state on Redis/Pub/Sub, and transactional DB persistence.

**Scaling Requirements**: Session affinity via load balancer or consistent hashing routing. Back-pressure and rate limiting per user/connection. Idempotency keys for all commands. Circuit breakers and bulkheads for service isolation.

**Data Management**: Event sourcing light pattern for move history. Board state snapshots for replay and analysis. Mandatory DB migrations with backfill capabilities. No schema breaking changes without proper migration paths.

## Development & Quality Standards

**Code Quality**: Static analysis, auto-formatting, strict linting, strong typing mandatory. Every bug must be reproduced → test written that fails → fix implemented → test passes. Golden tests for format stability and known regression prevention.

**Review Process**: Trunk-based development with short-lived branches. PR review mandatory. No merges on failed builds. Pipeline: lint+unit → integration → e2e → security (SCA/SAST) → performance smoke → canary deploy with feature flags and automatic rollback.

**Documentation**: All code and documentation in English. ADRs for architectural decisions. Semantic versioning for APIs. Human-readable changelogs. README/docs always current.

## Governance

This constitution supersedes all other development practices and policies. All PRs and code reviews MUST verify compliance with these principles. Any deviation from simplicity principles MUST be explicitly justified with documented rationale.

**Amendment Process**: Constitution changes require full team approval and migration plan for existing code. Breaking changes to principles require MAJOR version increment. New principle additions require MINOR version increment. Clarifications and wording improvements require PATCH version increment.

**Compliance Review**: Regular audits of codebase adherence to principles. Performance SLOs measured in CI/CD pipeline. Security reviews mandatory for all user-facing features.

**Version**: 1.0.0 | **Ratified**: 2025-09-26 | **Last Amended**: 2025-09-26