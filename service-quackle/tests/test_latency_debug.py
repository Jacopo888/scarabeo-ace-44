import os
import importlib
from fastapi.testclient import TestClient


def fresh_app():
    os.environ['ENV'] = 'test'
    os.environ['CORS_ORIGINS'] = 'http://localhost'
    mod = importlib.import_module('quackle_service.main')
    importlib.reload(mod)
    return mod.app


def test_latency_snapshot_shape():
    app = fresh_app()
    client = TestClient(app)
    r = client.get('/debug/latency')
    assert r.status_code == 200
    data = r.json()
    # Keys present and numeric
    for k in ['count', 'p50', 'p95', 'p99', 'min', 'max']:
        assert k in data
        assert isinstance(data[k], (int, float))


def test_best_move_empty_rack_records_latency():
    app = fresh_app()
    client = TestClient(app)
    before = client.get('/debug/latency').json()['count']
    payload = {"rack": "", "board": {}}
    r = client.post('/best-move', json=payload)
    assert r.status_code == 200
    body = r.json()
    assert body.get('engine_fallback') is False
    assert body.get('move_type') == 'pass'
    after = client.get('/debug/latency').json()['count']
    assert after >= before + 1
