from fastapi.testclient import TestClient

def make_client():
    from quackle_service.main import app
    return TestClient(app)

def test_engine_config_defaults(monkeypatch):
    client = make_client()
    monkeypatch.delenv('QUACKLE_STRICT_HL', raising=False)

    r = client.get('/debug/engine-config')
    assert r.status_code == 200
    j = r.json()
    assert j['difficulty'] == 'medium'
    assert j['kibitz_len'] in (20, 50)
    assert j['env_strict'] is False
    assert j['strict_default_medium_hard'] is True
    assert j['hl_strict_computed'] is True  # medium implies strict by default

    r2 = client.get('/debug/engine-config?difficulty=easy')
    assert r2.status_code == 200
    j2 = r2.json()
    assert j2['difficulty'] == 'easy'
    assert j2['kibitz_len'] == 5
    assert j2['hl_strict_computed'] is False  # easy does not imply strict when env var is absent
