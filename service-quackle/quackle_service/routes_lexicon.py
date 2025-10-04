from __future__ import annotations
import os
from fastapi import APIRouter, Response


router = APIRouter()


@router.get("/lexicon/words")
def lexicon_words():
    """Serve the active lexicon word list as plain text, if available.

    Looks for a text file in QUACKLE_LEXDIR matching the active lexicon name
    with common suffixes: .txt, .wordlist, .words. If found, returns it as
    text/plain. Otherwise returns 404 so clients can fall back locally.
    """
    name = os.getenv("LEXICON_NAME", os.getenv("QUACKLE_LEXICON", "enable1.15").strip()).strip()
    lexdir = os.getenv("QUACKLE_LEXDIR", "/data/lexica").strip()
    candidates = [
        os.path.join(lexdir, f"{name}.txt"),
        os.path.join(lexdir, f"{name}.wordlist"),
        os.path.join(lexdir, f"{name}.words"),
        os.path.join(lexdir, "enable.txt"),
    ]
    for p in candidates:
        try:
            if os.path.isfile(p) and os.path.getsize(p) > 0:
                with open(p, "rb") as f:
                    data = f.read()
                return Response(content=data, media_type="text/plain")
        except Exception:
            continue
    return Response(status_code=404)

