from __future__ import annotations
import os
from .config import LEXDIR, LEXICON

def lexicon_files() -> tuple[str, str]:
    dawg = f"{LEXDIR}/{LEXICON}.dawg"
    gaddag = f"{LEXDIR}/{LEXICON}.gaddag"
    return dawg, gaddag

def lexicon_ready() -> bool:
    dawg, gaddag = lexicon_files()
    try:
        return (os.path.isfile(dawg) and os.path.getsize(dawg) > 0 and
                os.path.isfile(gaddag) and os.path.getsize(gaddag) > 0)
    except Exception:
        return False
