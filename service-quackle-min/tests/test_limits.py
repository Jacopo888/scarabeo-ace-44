import os
import json
import pytest
from fastapi.testclient import TestClient
from app.main import app
import app.engine as eng

client = TestClient(app)


def test_board_too_large():
    # 226 entries (invalid)
    board = {f"1,{i}": {"letter": "A", "isBlank": False} for i in range(1,227)}
    r = client.post("/best-move", json={"rack": "AEIRSTZ", "board": board})
    if r.status_code == 500 and r.json().get("detail") == "lexicon_not_ready":
        pytest.skip("lexicon not ready in env")
    assert r.status_code == 400
    assert r.json()["detail"] == "invalid_input"


def test_body_too_large(monkeypatch):
    # Genera un JSON volutamente grande oltre limite
    big_str = "A" * 40000
    payload = {"rack": "AEIRSTZ", "board": {}, "pad": big_str}
    r = client.post("/best-move", json=payload)
    assert r.status_code == 400
    assert r.json()["detail"] == "invalid_input"


def test_engine_error_stderr_in_dev(monkeypatch):
    # Forziamo ENGINE_BIN costante a qualcosa di inesistente per generare engine_error
    monkeypatch.setenv("ENV", "dev")
    eng.ENGINE_BIN = "/non/esiste/binario_quackle"
    r = client.post("/best-move", json={"rack": "AEIRSTZ", "board": {}})
    # Se lexicon non pronto resta comunque 500 lexicon_not_ready, skip
    if r.status_code == 500 and r.json().get("detail") == "lexicon_not_ready":
        pytest.skip("lexicon not ready -> skip stderr test")
    # FileNotFoundError genera engine_error (senza stderr, ma con suffix possibile)
    assert r.status_code == 500
    assert r.json()["detail"].startswith("engine_error")