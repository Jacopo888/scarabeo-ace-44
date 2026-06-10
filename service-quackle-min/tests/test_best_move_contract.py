from fastapi.testclient import TestClient
import app.main as main_module


client = TestClient(main_module.app)


def test_best_move_hoists_engine_metadata(monkeypatch):
    engine_payload = {
        "status": "ok",
        "move_type": "play",
        "score": 50,
        "equity": 50,
        "start_row": 7,
        "start_col": 3,
        "direction": "H",
        "word": "ZAIRES",
        "tiles": [
            {"row": 7, "col": 3, "letter": "Z", "isBlank": False, "points": 10},
            {"row": 7, "col": 4, "letter": "A", "isBlank": False, "points": 1},
        ],
        "engine_info": {
            "board": {"width": 15, "height": 15, "start_row": 7, "start_col": 7}
        },
        "strategy_ok": True,
    }
    monkeypatch.setattr(main_module, "lexicon_ready", lambda: True)
    monkeypatch.setattr(main_module, "best_move", lambda rack, board, top_n=1: engine_payload)

    response = client.post("/best-move", json={"rack": "AEIRSTZ", "board": {}})

    assert response.status_code == 200
    data = response.json()
    assert data["raw"] == engine_payload
    assert data["move_type"] == "play"
    assert data["score"] == 50
    assert data["equity"] == 50
    assert data["start_row"] == 7
    assert data["start_col"] == 3
    assert data["direction"] == "H"
    assert data["word"] == "ZAIRES"
    assert data["tiles"] == engine_payload["tiles"]
    assert data["engine_info"] == engine_payload["engine_info"]
    assert data["strategy_ok"] is True


def test_best_move_hoists_exchange_metadata(monkeypatch):
    engine_payload = {
        "status": "ok",
        "move_type": "exchange",
        "exchange_letters": ["A", "E"],
        "exchange_count": 2,
        "exchange_blind": False,
    }
    monkeypatch.setattr(main_module, "lexicon_ready", lambda: True)
    monkeypatch.setattr(main_module, "best_move", lambda rack, board, top_n=1: engine_payload)

    response = client.post("/best-move", json={"rack": "AEIRSTZ", "board": {}})

    assert response.status_code == 200
    data = response.json()
    assert data["raw"] == engine_payload
    assert data["move_type"] == "exchange"
    assert data["exchange_letters"] == ["A", "E"]
    assert data["exchange_count"] == 2
    assert data["exchange_blind"] is False


def test_best_move_hoists_top_moves_and_forwards_limit(monkeypatch):
    seen = {}
    engine_payload = {
        "status": "ok",
        "move_type": "play",
        "score": 10,
        "equity": 11,
        "word": "ARE",
        "tiles": [{"row": 7, "col": 7, "letter": "A", "isBlank": False, "points": 1}],
        "moves": [
            {"rank": 1, "move_type": "play", "score": 10, "equity": 11, "word": "ARE", "tiles": []},
            {"rank": 2, "move_type": "play", "score": 8, "equity": 8, "word": "EAR", "tiles": []},
        ],
    }

    def fake_best_move(rack, board, top_n=1):
        seen["rack"] = rack
        seen["top_n"] = top_n
        return engine_payload

    monkeypatch.setattr(main_module, "lexicon_ready", lambda: True)
    monkeypatch.setattr(main_module, "best_move", fake_best_move)

    response = client.post("/best-move", json={"rack": "AEIRSTZ", "board": {}, "top_n": 2})

    assert response.status_code == 200
    data = response.json()
    assert seen == {"rack": "AEIRSTZ", "top_n": 2}
    assert data["moves"] == engine_payload["moves"]


def test_best_move_rejects_top_n_above_ten(monkeypatch):
    monkeypatch.setattr(main_module, "lexicon_ready", lambda: True)

    response = client.post("/best-move", json={"rack": "AEIRSTZ", "board": {}, "top_n": 11})

    assert response.status_code == 400
