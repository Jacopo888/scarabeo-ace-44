from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_contains_sizes():
    r = client.get('/health')
    assert r.status_code == 200
    data = r.json()
    # Sizes may be zero in dev if lexicon assente
    assert 'dawg_size' in data and 'gaddag_size' in data
    assert 'binary_path' in data
    # engine_ready deve essere False se i file non ci sono
    if data['dawg_size'] == 0 or data['gaddag_size'] == 0:
        assert data['engine_ready'] is False