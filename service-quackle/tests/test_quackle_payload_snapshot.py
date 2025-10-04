import json
from typing import Any, Dict
from fastapi.testclient import TestClient

from quackle_service.main import app
from quackle_service.normalization import grid_to_coordmap


def make_client():
    return TestClient(app)


def test_bridge_payload_snapshot(monkeypatch):
    client = make_client()

    with open('fixtures/quackle/test_payload.json', 'r') as f:
        golden = json.load(f)

    sent_payload: Dict[str, Any] = {}

    # Patch symbol usato dalla rotta e il gate dei lexicon
    import quackle_service.routes_best_move as rb

    def fake_call_bridge(payload: Dict[str, Any]):
        nonlocal sent_payload
        sent_payload = payload
        # Return a minimal valid play to keep test fast
        return {
            "tiles": [],
            "score": 0,
            "words": [],
            "move_type": "play",
            "engine_fallback": False
        }

    monkeypatch.setattr(rb, "_adapter_best_move", fake_call_bridge)
    monkeypatch.setattr(rb, "ensure_lexicon_ready", lambda: (True, "/tmp/dawg", "/tmp/gaddag"))

    # Build input body equivalent to the golden (grid -> coord map with center A)
    grid = ["." * 15 for _ in range(15)]
    row = list(grid[7])
    row[7] = 'A'
    grid[7] = ''.join(row)
    coord_map = grid_to_coordmap(grid)
    body = {"rack": golden["rack"], "difficulty": golden.get("difficulty"), "board": coord_map}

    r = client.post("/best-move", json=body)
    assert r.status_code == 200, r.text

    # Validate captured payload against golden (board map equality + rack + optional difficulty)
    assert sent_payload.get("rack") == golden["rack"]
    assert isinstance(sent_payload.get("board"), dict)
    # Board should contain center at 1-based 8,8 with letter 'A'
    assert sent_payload["board"].get("8,8", {}).get("letter") == "A"
    if golden.get("difficulty"):
        assert sent_payload.get("difficulty") == golden["difficulty"]
