# Map before move — service-quackle/quackle_service/main.py

This file hosts FastAPI endpoints and board/rack normalization logic. It's a key refactor target.

- Responsibilities:
  - `/health`, `/healthz`, `/health/lexicon`, debug endpoints
  - `/best-move` normalization and bridge payload assembly
  - Helpers for grid/coordmap conversions, rack normalization, tiles reconstruction

- Risks:
  - Large size makes changes error-prone
  - Multiple concerns in a single module

- Safe refactor ideas (behavior-preserving):
  - Extract adapters (`quackle_service/adapters/quackle.py`)
  - Extract DTOs/models (`quackle_service/models.py`)
  - Extract helpers (`quackle_service/lib/encoding.py`, `rack.py`, `timeouts.py`)

- Guardrails:
  - Keep tests in `service-quackle/tests/` green
  - Use golden fixtures in `fixtures/`
  - Maintain 0-based coordinates end-to-end (requests and responses)
