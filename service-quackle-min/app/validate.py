from __future__ import annotations
from fastapi import HTTPException

def normalize_rack(rack: str) -> str:
    if rack is None:
        raise HTTPException(status_code=400, detail="invalid_input")
    r = str(rack).strip().upper()
    if not r:
        return r  # rack vuota -> lasciamo al motore decidere pass
    if len(r) > 7:
        raise HTTPException(status_code=400, detail="invalid_input")
    for ch in r:
        if not (ch == '?' or ('A' <= ch <= 'Z')):
            raise HTTPException(status_code=400, detail="invalid_input")
    return r

def validate_board_coord_map(board: dict) -> dict:
    if board is None:
        return {}
    if not isinstance(board, dict):
        raise HTTPException(status_code=400, detail="invalid_input")
    if len(board) > 225:
        raise HTTPException(status_code=400, detail="invalid_input")
    out = {}
    for k, v in board.items():
        if not isinstance(k, str) or ',' not in k:
            raise HTTPException(status_code=400, detail="invalid_input")
        parts = k.split(',')
        if len(parts) != 2:
            raise HTTPException(status_code=400, detail="invalid_input")
        try:
            r = int(parts[0]); c = int(parts[1])
        except ValueError:
            raise HTTPException(status_code=400, detail="invalid_input")
        if not (0 <= r < 15 and 0 <= c < 15):
            raise HTTPException(status_code=400, detail="invalid_input")
        if not isinstance(v, dict):
            raise HTTPException(status_code=400, detail="invalid_input")
        letter = v.get("letter")
        if not (isinstance(letter, str) and len(letter) >= 1):
            raise HTTPException(status_code=400, detail="invalid_input")
        letter_up = letter.upper()[0]
        is_blank = bool(v.get("isBlank"))
        out[f"{r},{c}"] = {"letter": letter_up, "isBlank": is_blank}
    return out
