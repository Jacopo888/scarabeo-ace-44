import json
from fastapi.testclient import TestClient

from quackle_service.main import app


def make_client():
    return TestClient(app)


def patch_bridge(monkeypatch, tiles):
    # tiles: list of dicts with row/col/letter
    def _fake_best_move(payload):
        return {
            "tiles": tiles,
            "score": 10,
            "words": ["FAKE"],
            "move_type": "play",
            "engine_fallback": False,
        }
    import quackle_service.routes_best_move as rb
    monkeypatch.setattr(rb, "_adapter_best_move", _fake_best_move)
    monkeypatch.setattr(rb, "ensure_lexicon_ready", lambda: (True, "", ""))


def test_opening_rows_forced_to_center(monkeypatch):
    client = make_client()
    # Engine returns off-center placement (e.g., rows 5)
    patch_bridge(monkeypatch, [
        {"row": 5, "col": 6, "letter": "A", "points": 1, "isBlank": False},
        {"row": 5, "col": 7, "letter": "B", "points": 3, "isBlank": False},
    ])
    body = {"rack": "AEIRSTZ", "board": {}}  # empty coord map => opening
    r = client.post("/best-move", json=body)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("move_type") == "play"
    rows = {t["row"] for t in data.get("tiles", [])}
    assert rows == {7}, f"Expected all rows forced to 7, got {rows}"  # forced


def test_opening_vertical_forced_to_col_center(monkeypatch):
    client = make_client()
    # Vertical play originally spanning rows 4-6 same column 9
    patch_bridge(monkeypatch, [
        {"row": 4, "col": 9, "letter": "C", "points": 3, "isBlank": False},
        {"row": 5, "col": 9, "letter": "A", "points": 1, "isBlank": False},
        {"row": 6, "col": 9, "letter": "T", "points": 1, "isBlank": False},
    ])
    r = client.post("/best-move", json={"rack": "AEIRSTZ", "board": {}})
    assert r.status_code == 200, r.text
    data = r.json()
    cols = {t["col"] for t in data.get("tiles", [])}
    assert cols == {7}, f"Expected all cols forced to 7 for vertical opening, got {cols}"


def test_opening_single_letter_forced_to_center(monkeypatch):
    client = make_client()
    patch_bridge(monkeypatch, [
        {"row": 3, "col": 11, "letter": "Q", "points": 10, "isBlank": False},
    ])
    r = client.post("/best-move", json={"rack": "AEIRSTZ", "board": {}})
    assert r.status_code == 200, r.text
    data = r.json()
    tile = data.get("tiles", [])[0]
    assert tile["row"] == 7 and tile["col"] == 7, f"Single-letter opening should be centered, got {(tile['row'], tile['col'])}"


def test_non_opening_rows_not_forced(monkeypatch):
    client = make_client()
    # Engine returns off-center placement at row 5; since board not empty, keep it
    patch_bridge(monkeypatch, [
        {"row": 5, "col": 6, "letter": "C", "points": 3, "isBlank": False},
        {"row": 5, "col": 7, "letter": "D", "points": 2, "isBlank": False},
    ])
    # Board has an existing center tile => not opening
    board = {"7,7": {"letter": "X", "isBlank": False}}
    body = {"rack": "AEIRSTZ", "board": board}
    r = client.post("/best-move", json=body)
    assert r.status_code == 200, r.text
    data = r.json()
    rows = {t["row"] for t in data.get("tiles", [])}
    assert rows == {5}, f"Rows should remain unmodified (expected 5), got {rows}"  # unchanged
