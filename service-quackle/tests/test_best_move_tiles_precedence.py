import json
from fastapi.testclient import TestClient
from quackle_service.main import app


client = TestClient(app)


def test_best_move_prefers_tiles_over_raw_move(monkeypatch):
    # Simula l'adapter che ritorna sia tiles (0-based corretti) sia raw_move (ipoteticamente 1-based)
    def fake_best_move(payload):
        return {
            "tiles": [
                {"row": 7, "col": 7, "letter": "A", "points": 1, "isBlank": False}
            ],
            "words": ["A"],
            "score": 1,
            "move_type": "play",
            "raw_move": {"row": 8, "col": 8, "dir": "H", "word": "A", "positions": [[8, 8]]}
        }

    import quackle_service.routes_best_move as rbm
    monkeypatch.setattr(rbm, "_adapter_best_move", lambda payload: fake_best_move(payload))

    payload = {
        "board": {},
        "rack": "AEIRSTZ",
    }
    r = client.post("/best-move", data=json.dumps(payload))
    assert r.status_code == 200
    data = r.json()
    assert data["move_type"] == "play"
    tiles = data.get("tiles", [])
    # Verifica che vengano usati i tiles originali (0-based 7,7) e non i ricostruiti
    assert tiles and tiles[0]["row"] == 7 and tiles[0]["col"] == 7