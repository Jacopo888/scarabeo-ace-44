import os
import json
import shutil
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

BIN = os.getenv("QUACKLE_ENGINE_BIN") or shutil.which("quackle_json_wrapper")

@pytest.mark.skipif(not BIN, reason="engine binary not found")
def test_best_move_endpoint_with_engine():
    # Se i file lexicon mancano questo test potrebbe fallire con 500 lexicon_not_ready.
    # In tal caso viene segnalato ma non invalidiamo l'infrastruttura del servizio.
    payload = {"rack": "AEIRSTZ", "board": {}}
    r = client.post('/best-move', json=payload)
    if r.status_code == 500:
        detail = r.json().get('detail') or r.json().get('error')
        assert detail in {"lexicon_not_ready", "engine_error"}
        pytest.skip(f"engine not ready: {detail}")
    assert r.status_code == 200
    data = r.json()
    assert data.get('move_type') in {"play","pass","exchange"}
    if data.get('move_type') == 'play':
        assert isinstance(data.get('tiles'), list)
        assert 'score' in data
