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
    monkeypatch.setattr(main_module, "best_move", lambda rack, board: engine_payload)

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
    monkeypatch.setattr(main_module, "best_move", lambda rack, board: engine_payload)

    response = client.post("/best-move", json={"rack": "AEIRSTZ", "board": {}})

    assert response.status_code == 200
    data = response.json()
    assert data["raw"] == engine_payload
    assert data["move_type"] == "exchange"
    assert data["exchange_letters"] == ["A", "E"]
    assert data["exchange_count"] == 2
    assert data["exchange_blind"] is False
