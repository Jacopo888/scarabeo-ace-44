from __future__ import annotations
import re
from typing import Any, List


def normalize_rack_flexible(raw: Any) -> str:
    """Normalize rack to uppercase string allowing length 0..7.

    Accepts:
      - string (letters, '?' or '*', spaces ignored)
      - list of letters
      - list of tile dicts that may contain a 'letter' field

    Raises ValueError on invalid format.
    """
    if raw is None:
        return ""
    if isinstance(raw, list):
        parts: List[str] = []
        for el in raw:
            if isinstance(el, dict) and "letter" in el:
                parts.append(str(el["letter"]))
            else:
                parts.append(str(el))
        raw = ''.join(parts)
    s = str(raw).replace(" ", "").upper()
    if re.fullmatch(r"[A-Z\?\*]{0,7}", s or "") is None:
        raise ValueError("invalid_rack_format")
    return s
