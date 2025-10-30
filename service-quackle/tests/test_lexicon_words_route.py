import os
from pathlib import Path
from fastapi.testclient import TestClient

# Import the FastAPI app
from quackle_service.main import app


def test_lexicon_words_normalizes_newlines(tmp_path: Path, monkeypatch):
    # Prepare a fake lexdir with CR-only line endings
    lexdir = tmp_path / "lexica"
    lexdir.mkdir(parents=True, exist_ok=True)
    name = "enable1.15"
    # Two words separated by old-Mac CR newlines
    (lexdir / f"{name}.txt").write_bytes(b"HELLO\rWORLD\r")

    # Point service to our temp lexicon
    monkeypatch.setenv("QUACKLE_LEXDIR", str(lexdir))
    monkeypatch.setenv("LEXICON_NAME", name)

    client = TestClient(app)
    r = client.get("/lexicon/words")
    assert r.status_code == 200
    # Service should normalize to \n newlines
    body = r.text
    lines = [w for w in body.split("\n") if w]
    assert lines == ["HELLO", "WORLD"]


def test_lexicon_words_fallback_candidates(tmp_path: Path, monkeypatch):
    # When named file is missing, endpoint should try enable.txt as fallback
    lexdir = tmp_path / "lexica"
    lexdir.mkdir(parents=True, exist_ok=True)
    (lexdir / "enable.txt").write_text("AA\nAB\n", encoding="utf-8")

    monkeypatch.setenv("QUACKLE_LEXDIR", str(lexdir))
    monkeypatch.setenv("LEXICON_NAME", "nonexistent")

    client = TestClient(app)
    r = client.get("/lexicon/words")
    assert r.status_code == 200
    assert "AA\nAB\n" == r.text
