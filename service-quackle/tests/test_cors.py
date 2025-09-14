import os
import importlib
from fastapi.testclient import TestClient


def fresh_app(origins: str, env: str):
    os.environ['CORS_ORIGINS'] = origins
    os.environ['ENV'] = env
    mod = importlib.import_module('quackle_service.main')
    importlib.reload(mod)
    return mod.app


def test_preflight_allows_configured_origin():
    app = fresh_app('https://example.com', 'prod')
    client = TestClient(app)
    resp = client.options('/best-move', headers={
        'Origin': 'https://example.com',
        'Access-Control-Request-Method': 'POST'
    })
    # Starlette returns 200 for preflight
    assert resp.status_code in (200, 204)
    assert resp.headers.get('access-control-allow-origin') == 'https://example.com'


def test_health_cors_reports_allow_origins():
    app = fresh_app('https://example.com', 'prod')
    client = TestClient(app)
    resp = client.get('/health/cors')
    assert resp.status_code == 200
    data = resp.json()
    assert data.get('allow_origins') == ['https://example.com']

