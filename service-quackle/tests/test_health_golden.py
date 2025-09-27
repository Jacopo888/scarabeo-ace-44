import json
from fastapi.testclient import TestClient

from quackle_service.main import app


def make_client():
    return TestClient(app)


def test_health_golden(monkeypatch):
    client = make_client()

    # Skip heavy lexicon checks to keep test hermetic
    monkeypatch.setenv("QUACKLE_SKIP_LEXICON_CHECK", "1")
    monkeypatch.setenv("ENV_MODE", "test")

    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()

    with open('fixtures/health/expected.json', 'r') as f:
        expected = json.load(f)

    # Invariants
    assert body.get("status") == expected["status"]
    assert body.get("engine") == expected["engine"]
    assert body.get("bridge_ruleset") == expected["bridge_ruleset"]
    assert body.get("board_schema") == expected["board_schema"]
    assert body.get("payload_sanitize") == expected["payload_sanitize"]

    # Engine readiness (can be true even if lexicon check skipped)
    assert isinstance(body.get("engine_ready"), bool)

    # Sizes should be numbers (>= 0), existence flags booleans
    for key in ("dawg_size", "gaddag_size"):
        assert isinstance(body.get(key), int)
        assert body.get(key) >= 0
    for key in ("dawg_exists", "gaddag_exists"):
        assert isinstance(body.get(key), bool)

    # Strategy shape
    strat = body.get("strategy", {}) or {}
    keys = expected.get("strategy_keys", [])
    for k in keys:
        assert k in strat
        assert isinstance(strat[k], bool)
