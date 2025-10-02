import json
from fastapi.testclient import TestClient

def make_client():
    from quackle_service.main import app
    return TestClient(app)

def test_engine_info_passthrough(monkeypatch):
    client = make_client()

    # Patch adapter to return a minimal valid response with engine_info
    import quackle_service.routes_best_move as rb

    def fake_call_bridge(payload):
        return {
            "tiles": [],
            "score": 0,
            "words": [],
            "move_type": "play",
            "engine_fallback": False,
            "engine_info": {"hl_strict": True, "path": "hl", "kibitz_len": 20, "search_width": 20, "used_endgame_solver": False, "used_simulator": False, "strategy_set": "default_english"},
        }

    monkeypatch.setattr(rb, "_adapter_best_move", fake_call_bridge)
    monkeypatch.setattr(rb, "ensure_lexicon_ready", lambda: (True, "/tmp/dawg", "/tmp/gaddag"))

    body = {
        "rack": "AEIRST?",
        "board": {"rows": 15, "cols": 15, "grid": ["." * 15 for _ in range(15)]},
    }
    r = client.post("/best-move", json=body)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("engine_fallback") is False
    # engine_info must be present and contain expected keys
    assert isinstance(data.get("engine_info"), dict)
    assert set(data["engine_info"].keys()) == {"hl_strict", "path", "kibitz_len", "search_width", "used_endgame_solver", "used_simulator", "strategy_set"}
