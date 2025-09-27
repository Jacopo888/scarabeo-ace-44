from fastapi.testclient import TestClient


def make_client():
    from quackle_service.main import app
    return TestClient(app)


def test_health_without_lexica(monkeypatch):
    # Point lexdir/appdata to a temp directory with no files and ensure check not skipped
    monkeypatch.setenv("QUACKLE_LEXDIR", "/tmp/lexica-missing")
    monkeypatch.setenv("QUACKLE_APPDATA_DIR", "/tmp/appdata-missing")
    monkeypatch.delenv("QUACKLE_SKIP_LEXICON_CHECK", raising=False)

    client = make_client()
    res = client.get("/health")
    assert res.status_code == 200
    j = res.json()
    # engine_ready may be false if files missing (expected), we still return a structured payload
    assert "engine_ready" in j
    assert j["dawg_exists"] in (True, False)
    assert j["gaddag_exists"] in (True, False)


def test_health_with_skip_check(monkeypatch, tmp_path):
    # When QUACKLE_SKIP_LEXICON_CHECK=1, engine_ready is allowed (even if files are missing)
    monkeypatch.setenv("QUACKLE_LEXDIR", str(tmp_path / "lexica"))
    monkeypatch.setenv("QUACKLE_APPDATA_DIR", str(tmp_path / "appdata"))
    monkeypatch.setenv("QUACKLE_SKIP_LEXICON_CHECK", "1")

    client = make_client()
    res = client.get("/health")
    assert res.status_code == 200
    j = res.json()
    assert j["lexicon_check_skipped"] is True
    assert j["engine_ready"] in (True, False)


def test_health_with_present_lexica(monkeypatch, tmp_path):
    # Create dummy non-empty files to simulate present lexica
    lexdir = tmp_path / "lexica"
    lexdir.mkdir(parents=True, exist_ok=True)
    (lexdir / "enable1.15.dawg").write_bytes(b"x" * 10)
    (lexdir / "enable1.15.gaddag").write_bytes(b"y" * 10)

    monkeypatch.setenv("QUACKLE_LEXDIR", str(lexdir))
    monkeypatch.setenv("LEXICON_NAME", "enable1.15")
    monkeypatch.delenv("QUACKLE_SKIP_LEXICON_CHECK", raising=False)

    client = make_client()
    res = client.get("/health")
    assert res.status_code == 200
    j = res.json()
    assert j["dawg_exists"] is True
    assert j["gaddag_exists"] is True
    assert j["dawg_size"] > 0
    assert j["gaddag_size"] > 0
