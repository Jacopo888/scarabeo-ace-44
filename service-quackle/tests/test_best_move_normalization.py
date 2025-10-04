import re
import json
from typing import Any
from fastapi.testclient import TestClient

from quackle_service.main import app
from quackle_service.normalization import grid_to_coordmap


def make_client():
    return TestClient(app)


def fake_play_response():
    return {
        "tiles": [{"row": 7, "col": 7, "letter": "A", "points": 1, "isBlank": False}],
        "score": 10,
        "words": ["A"],
        "move_type": "play",
        "engine_fallback": False,
    }


def patch_bridge(monkeypatch, assert_fn=None):
    import quackle_service.routes_best_move as rb

    def _fake_best_move(payload):
        # Payload to bridge should be normalized
        assert isinstance(payload.get("rack"), str)
        assert re.fullmatch(r"[A-Z\?\*]{7}", payload["rack"]) is not None
        assert isinstance(payload.get("board"), dict)
        # Optional custom assertions per-test
        if assert_fn:
            assert_fn(payload)
        return fake_play_response()

    monkeypatch.setattr(rb, "_adapter_best_move", _fake_best_move)
    # Evita check lexicon durante i test
    monkeypatch.setattr(rb, "ensure_lexicon_ready", lambda: (True, "", ""))


def test_A_board_empty_coord_map(monkeypatch):
    client = make_client()
    def check(payload):
        assert payload["board"] == {}  # empty map
    patch_bridge(monkeypatch, check)
    empty = ["."*15 for _ in range(15)]
    coord_map = grid_to_coordmap(empty)
    # coord_map sarà vuota per griglia vuota → corpo deve passare {}
    body = {"rack": "AEIRSTZ", "board": coord_map}
    r = client.post("/best-move", json=body)
    assert r.status_code == 200, r.text


def test_B_board_with_center_letter_coord_map(monkeypatch):
    client = make_client()
    def check(payload):
        assert "8,8" in payload["board"] and payload["board"]["8,8"]["letter"] == "A"
    patch_bridge(monkeypatch, check)
    grid = ["."*15 for _ in range(15)]
    row = list(grid[7]); row[7] = 'A'; grid[7] = ''.join(row)
    coord_map = grid_to_coordmap(grid)
    body = {"rack": "AEIRST?", "board": coord_map}
    r = client.post("/best-move", json=body)
    assert r.status_code == 200, r.text


def test_C_rejects_legacy_squares(monkeypatch):
    client = make_client()
    r = client.post("/best-move", json={"rack": "HELLO??", "board": {"rows":15, "cols":15, "squares": [[None]*15 for _ in range(15)]}})
    assert r.status_code == 400
    assert r.json().get("error") == "unsupported_board_format"


def test_D_rejects_legacy_placements(monkeypatch):
    client = make_client()
    r = client.post("/best-move", json={"rack": "AEIRST?", "board": {"rows":15, "cols":15, "placements": [{"x":7, "y":7, "letter":"A", "is_blank": False}]}})
    assert r.status_code == 400
    assert r.json().get("error") == "unsupported_board_format"


def test_F_errors():
    client = make_client()
    # Rack less than 7: now accepted and returns a deterministic pass
    r1 = client.post("/best-move", json={"rack": "HELLO?", "board": {}})  # empty coord map
    assert r1.status_code == 200, r1.text
    j1 = r1.json()
    assert j1.get("engine_fallback") is False
    assert j1.get("move_type") == "pass"

    # Invalid characters
    r2 = client.post("/best-move", json={"rack": "HELLO1?", "board": {}})
    assert r2.status_code == 400
    assert r2.json().get("error") == "invalid_rack_format"

    # Invalid center coordinates
    # Legacy center_x/center_y path non più supportato → unsupported_board_format
    r3 = client.post("/best-move", json={"rack": "AEIRSTZ", "board": {"rows":15, "cols":15, "center_x":20, "center_y":7, "grid": ["."*15 for _ in range(15)]}})
    assert r3.status_code == 400 and r3.json().get("error") == "unsupported_board_format"


def test_G_crossword_letters_from_raw_move(monkeypatch):
    client = make_client()

    def fake_bridge(_: Any):
        return {
            "tiles": [],
            "score": 24,
            "words": ["JOY"],
            "move_type": "play",
            "engine_fallback": False,
            "raw_move": {
                "word": "J.Y",
                "row": 7,
                "col": 7,
                "dir": "V",
                "positions": [[7, 7], [9, 7]]
            }
        }

    import quackle_service.routes_best_move as rb
    monkeypatch.setattr(rb, "_adapter_best_move", fake_bridge)
    monkeypatch.setattr(rb, "ensure_lexicon_ready", lambda: (True, "", ""))

    body = {"rack": "AEIRSTZ", "board": {}}

    r = client.post("/best-move", json=body)
    assert r.status_code == 200, r.text
    tiles = r.json().get("tiles", [])
    assert [t.get("letter") for t in tiles] == ["J", "Y"]
    # After fix: Service preserves raw_move positions as-is (assuming they're already 0-based from Quackle)
    coords = [[t.get("row"), t.get("col")] for t in tiles]
    assert coords == [[7, 7], [9, 7]]


def test_H_blank_tiles_preserve_letter(monkeypatch):
    client = make_client()

    def fake_bridge_blank(_: Any):
        return {
            "tiles": [],
            "score": 16,
            "words": ["AX"],
            "move_type": "play",
            "engine_fallback": False,
            "raw_move": {
                "word": "aX",
                "row": 7,
                "col": 7,
                "dir": "H",
                "positions": [[7, 7], [7, 8]]
            }
        }

    import quackle_service.routes_best_move as rb
    monkeypatch.setattr(rb, "_adapter_best_move", fake_bridge_blank)
    monkeypatch.setattr(rb, "ensure_lexicon_ready", lambda: (True, "", ""))

    body = {"rack": "AEIRSTZ", "board": {}}

    r = client.post("/best-move", json=body)
    assert r.status_code == 200, r.text
    tiles = r.json().get("tiles", [])
    assert len(tiles) == 2
    assert tiles[0]["letter"] == "A"
    assert tiles[0]["isBlank"] is True
    assert tiles[1]["letter"] == "X"
    assert tiles[1]["isBlank"] is False
