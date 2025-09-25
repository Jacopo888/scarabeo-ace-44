import os
import importlib
from pathlib import Path
from fastapi.testclient import TestClient


def fresh_app():
    # Reload module to pick up env vars
    mod = importlib.import_module('quackle_service.main')
    importlib.reload(mod)
    return mod.app


def have_real_engine():
    bin_path = os.environ.get('QUACKLE_BRIDGE_BIN')
    if not bin_path:
        # default path used by service
        here = Path(__file__).resolve().parents[1]
        bin_path = str(here / 'bridge' / 'engine_wrapper')
    return Path(bin_path).exists() and os.access(bin_path, os.X_OK)


def have_gaddag():
    lexdir = os.environ.get('QUACKLE_LEXDIR', '/data/lexica')
    lexicon = os.environ.get('QUACKLE_LEXICON', 'enable1')
    p = Path(lexdir) / f'{lexicon}.gaddag'
    return p.exists() and p.stat().st_size > 0


def test_real_engine_opening_move_nonpass():
    if not (have_real_engine() and have_gaddag()):
        import pytest
        pytest.skip('Real engine or GADDAG not available in this environment')

    # Ensure we do NOT skip lexicon check
    os.environ['ENV'] = 'prod'
    os.environ.pop('QUACKLE_SKIP_LEXICON_CHECK', None)

    app = fresh_app()
    client = TestClient(app)

    body = {
        "rack": "FALREI?",  # robust rack with known opening word using one blank
        "board": {
            "rows": 15,
            "cols": 15,
            "grid": ["."*15 for _ in range(15)]
        }
    }
    resp = client.post('/best-move', json=body)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data.get('engine_fallback') is False, data
    assert data.get('move_type') != 'pass', data
    tiles = data.get('tiles') or []
    assert isinstance(tiles, list) and len(tiles) > 0, data

