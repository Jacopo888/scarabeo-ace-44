import os
from pathlib import Path
from fastapi.testclient import TestClient


def have_real_engine():
    bin_path = os.environ.get('QUACKLE_BRIDGE_BIN')
    if not bin_path:
        here = Path(__file__).resolve().parents[1]
        bin_path = str(here / 'bridge' / 'engine_wrapper')
    return Path(bin_path).exists() and os.access(bin_path, os.X_OK)


def have_gaddag():
    lexdir = os.environ.get('QUACKLE_LEXDIR', '/data/lexica')
    lexicon = os.environ.get('QUACKLE_LEXICON', 'enable1.15')
    p = Path(lexdir) / f'{lexicon}.gaddag'
    return p.exists() and p.stat().st_size > 0


def _fresh_client_with_prod_env():
    # Ensure we do NOT skip lexicon check and we pick up env vars
    os.environ['ENV'] = 'prod'
    os.environ.pop('QUACKLE_SKIP_LEXICON_CHECK', None)
    import importlib
    mod = importlib.import_module('quackle_service.main')
    importlib.reload(mod)
    return TestClient(mod.app)


def test_endgame_empty_bag_finishing_play_possible():
    if not (have_real_engine() and have_gaddag()):
        import pytest
        pytest.skip('Real engine or GADDAG not available in this environment')

    client = _fresh_client_with_prod_env()
    body = {
        "rack": "A",  # single tile, valid word on its own in English
        "board": {},
        "difficulty": "hard",
        # Endgame: empty bag (bag_count derived from bag_pool length)
        "bag_pool": [],
    }
    r = client.post('/best-move', json=body)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j.get('engine_fallback') is False, j
    assert j.get('move_type') == 'play', j
    tiles = j.get('tiles') or []
    assert isinstance(tiles, list) and len(tiles) > 0, j
    # Sanity: the play should be centered on first move
    assert any(t.get('row') == 7 and t.get('col') == 7 for t in tiles), j
    # Endgame solver should have been used in hard with empty bag
    eng = j.get('engine_info') or {}
    assert eng.get('used_endgame_solver') is True, j


def test_endgame_empty_bag_no_play_then_pass():
    if not (have_real_engine() and have_gaddag()):
        import pytest
        pytest.skip('Real engine or GADDAG not available in this environment')

    client = _fresh_client_with_prod_env()
    body = {
        "rack": "Q",  # single tile, not a valid standalone word
        "board": {},
        "difficulty": "hard",
        # Endgame: empty bag (bag_count derived from bag_pool length)
        "bag_pool": [],
    }
    r = client.post('/best-move', json=body)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j.get('engine_fallback') is False, j
    # With bag empty, Exchange MUST NOT be selected; expect pass when no legal play exists
    assert j.get('move_type') == 'pass', j
    tiles = j.get('tiles') or []
    assert isinstance(tiles, list) and len(tiles) == 0, j
    # Endgame solver should have been used in hard with empty bag
    eng = j.get('engine_info') or {}
    assert eng.get('used_endgame_solver') is True, j
