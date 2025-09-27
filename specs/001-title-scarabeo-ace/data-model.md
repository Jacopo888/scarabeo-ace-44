# Phase 1 — Data Model

This document identifies key entities and validation rules preserved during the refactor.

## Entities

### Lexicon Assets
- Attributes: path (QUACKLE_LEXDIR), basename (LEXICON_BASENAME=enable1), files: `.gaddag`, `.dawg`, sizes (>0 bytes).
- Rules: Both files must exist and be readable; sizes reported in `/health`.

### Health Probe
- Attributes: engine_ready (bool), gaddag_size, dawg_size, details (optional errors).
- Rules: engine_ready=true iff both assets present and >0 bytes.

### Golden Fixtures
- Attributes: coordinate cases (A1, H8, O15), payload fixture (`test_payload.json`), simulation fixtures (dated under fixtures/simulation).
- Rules: Immutable snapshots — any change requires ADR.

### Client Request
- Attributes: endpoint, payload (board/rack encodings), timeout, idempotency key (optional).
- Rules: DTO validation at service boundary; error taxonomy unchanged.

## Invariants
- API contracts, error codes/messages, timeouts, board/rack formats, Quackle I/O semantics unchanged.
- Deterministic, idempotent, process-isolated Quackle integration.
