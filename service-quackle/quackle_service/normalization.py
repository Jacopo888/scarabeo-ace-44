from __future__ import annotations
import re
from typing import Any, Dict, List, Optional, Tuple
from fastapi import HTTPException

from .lib.rack import normalize_rack_flexible as _rack_pure_normalize
from .lib.encoding import (
    is_coord_map as _is_coord_map_pure,
    squares_from_coord_map as _squares_from_coord_map_pure,
    coord_map_from_grid as _coord_map_from_grid_pure,
)

def sanitize_none(obj):
    if isinstance(obj, dict):
        return {k: sanitize_none(v) for k, v in obj.items() if v is not None}
    if isinstance(obj, list):
        return [sanitize_none(v) for v in obj]
    return obj

# Pure helper: map a cell value to the normalized grid character.
# Rules preserved from inline comprehensions:
# - None/''/'.' -> '.'
# - '?' or '*' (string) -> '?'
# - otherwise first uppercase char of the string
def _cell_to_char(v: object) -> str:
    if v is None:
        return '.'
    s = str(v)
    if s == '' or s == '.':
        return '.'
    if s in ('?', '*'):
        return '?'
    return s.upper()[:1]

def normalize_rack_flexible(raw: Any) -> str:
    try:
        return _rack_pure_normalize(raw)
    except ValueError:
        raise HTTPException(status_code=400, detail="invalid_rack_format")

def is_coord_map(d: Dict[str, Any]) -> bool:
    return _is_coord_map_pure(d)

def squares_from_coord_map(coord_map: Dict[str, Any], rows: int, cols: int) -> List[List[Optional[str]]]:
    try:
        return _squares_from_coord_map_pure(coord_map, rows, cols)
    except ValueError as e:
        msg = str(e) if str(e) in {"malformed_board", "invalid_board_coordinate"} else "malformed_board"
        raise HTTPException(status_code=400, detail=msg)

def grid_to_coordmap(grid: List[str]) -> Dict[str, Dict]:
    try:
        return _coord_map_from_grid_pure(grid)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

def _letter_points_en(letter: str) -> int:
    L = letter.upper()[:1] if letter else ""
    if L in {"A","E","I","L","N","O","R","S","T","U"}: return 1
    if L in {"D","G"}: return 2
    if L in {"B","C","M","P"}: return 3
    if L in {"F","H","V","W","Y"}: return 4
    if L == "K": return 5
    if L in {"J","X"}: return 8
    if L in {"Q","Z"}: return 10
    if L in {"?","*"}: return 0
    return 1

def reconstruct_tiles_from_raw_move(raw_move: Dict[str, Any], words: Optional[Any] = None) -> List[Dict[str, Any]]:
    try:
        positions_raw = raw_move.get("positions") or []
    except AttributeError:
        return []
    pos_list: List[tuple[int, int]] = []
    for pos in positions_raw:
        if not isinstance(pos, (list, tuple)) or len(pos) < 2:
            continue
        try:
            r = int(pos[0])
            c = int(pos[1])
        except (TypeError, ValueError):
            continue
        pos_list.append((r, c))
    if not pos_list:
        return []
    try:
        start_row = int(raw_move.get("row"))
        start_col = int(raw_move.get("col"))
    except (TypeError, ValueError):
        return []
    direction = str(raw_move.get("dir") or "H").upper()
    raw_word = raw_move.get("word")
    raw_word_str = str(raw_word) if isinstance(raw_word, str) or raw_word is not None else ""
    first_word = ""
    if isinstance(words, (list, tuple)) and words:
        candidate = words[0]
        if isinstance(candidate, str):
            first_word = candidate
        elif candidate is not None:
            first_word = str(candidate)
    full_word_str = first_word or raw_word_str.replace('.', '') or raw_word_str
    tiles: List[Dict[str, Any]] = []
    pos_idx = 0
    for i, full_char in enumerate(full_word_str):
        if pos_idx >= len(pos_list):
            break
        row = start_row + (0 if direction == 'H' else i)
        col = start_col + (i if direction == 'H' else 0)
        target = pos_list[pos_idx]
        if target != (row, col):
            continue
        raw_char = raw_word_str[i] if i < len(raw_word_str) else ""
        letter_char = full_char or raw_char
        is_blank = False
        if raw_char:
            if raw_char in {'.'}:
                letter_char = full_char
            elif raw_char.islower():
                is_blank = True
                letter_char = full_char or raw_char.upper()
            elif raw_char in {'?', '*'}:
                is_blank = True
                letter_char = full_char or raw_char.upper()
            else:
                letter_char = full_char or raw_char
        else:
            letter_char = full_char or letter_char
        if not letter_char:
            pos_idx += 1
            continue
        letter_up = letter_char.upper()
        tiles.append({
            "row": target[0],
            "col": target[1],
            "letter": letter_up,
            "points": 0 if is_blank else _letter_points_en(letter_up),
            "isBlank": is_blank
        })
        pos_idx += 1
    return tiles

def normalize_board_for_bridge(board_input: Any) -> Dict[str, Any]:
    """Accetta SOLO una coord map 1-based {"r,c": {letter,isBlank}}.

    Tutti i precedenti formati (lista grid, dict con grid, squares, placements) ora generano
    un HTTP 400 con detail = "unsupported_board_format" per ridurre complessità e ambiguità.
    """
    if not isinstance(board_input, dict) or not is_coord_map(board_input):
        # Manteniamo messaggi precedenti specifici per coordinate invalide quando riconoscibili,
        # ma qui semplifichiamo: solo coord map valida ammessa.
        raise HTTPException(status_code=400, detail="unsupported_board_format")

    rows = 15
    cols = 15
    try:
        squares = squares_from_coord_map(board_input, rows, cols)
    except HTTPException as e:
        # Propaga errori formali (malformed_board / invalid_board_coordinate) dalla conversione.
        raise e

    grid = [''.join(_cell_to_char(v) for v in row) for row in squares]
    # Validazione finale di sicurezza
    if not (len(grid) == 15 and all(isinstance(r, str) and len(r) == 15 for r in grid)):
        raise HTTPException(status_code=400, detail="malformed_board")
    return {"rows": rows, "cols": cols, "grid": grid}
