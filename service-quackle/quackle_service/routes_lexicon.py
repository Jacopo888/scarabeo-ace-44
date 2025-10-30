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
                # Read as text with universal newlines so any of \r, \n, or \r\n
                # are normalized to \n. This prevents client-side "single line"
                # issues when a lexicon uses legacy Mac line endings (\r).
                with open(p, "r", encoding="utf-8", newline=None) as f:
                    text = f.read()
                # Ensure final EOL and strip potential BOM
                if text.startswith("\ufeff"):
                    text = text.lstrip("\ufeff")
                if not text.endswith("\n"):
                    text = text + "\n"
                return Response(content=text.encode("utf-8"), media_type="text/plain; charset=utf-8")
        except Exception:
            # Try next candidate path on any error
            continue
    return Response(status_code=404)

