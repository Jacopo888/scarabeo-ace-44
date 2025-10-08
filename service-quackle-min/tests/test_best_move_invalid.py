from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_best_move_invalid_board():
    r = client.post('/best-move', json={"rack": "AEIRSTZ", "board": 123})
    assert r.status_code == 400
    assert r.json().get('error') == 'invalid_input' or r.json().get('detail') == 'invalid_input'
