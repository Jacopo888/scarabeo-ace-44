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
            "row": target[0] - 1,
            "col": target[1] - 1,
            "letter": letter_up,
            "points": 0 if is_blank else _letter_points_en(letter_up),
            "isBlank": is_blank
        })
        pos_idx += 1
    return tiles

def normalize_board_for_bridge(board_input: Any) -> Dict[str, Any]:
    if isinstance(board_input, list):
        grid = board_input
    elif isinstance(board_input, dict):
        rows = int(board_input.get("rows") or 15)
        cols = int(board_input.get("cols") or 15)
        if "center_x" in board_input or "center_y" in board_input:
            try:
                cx = int(board_input.get("center_x"))
                cy = int(board_input.get("center_y"))
            except Exception:
                raise HTTPException(status_code=400, detail="malformed_board")
            if not (0 <= cx < cols and 0 <= cy < rows):
                raise HTTPException(status_code=400, detail="invalid_board_coordinate")
        if "grid" in board_input:
            grid = board_input.get("grid")
        elif is_coord_map(board_input):
            squares = squares_from_coord_map(board_input, rows, cols)
            grid = [''.join(_cell_to_char(v) for v in row) for row in squares]
        elif isinstance(board_input.get("squares"), list):
            squares = board_input.get("squares")
            if not (isinstance(squares, list) and len(squares) == rows and all(isinstance(r, list) and len(r) == cols for r in squares)):
                raise HTTPException(status_code=400, detail="malformed_board_squares_size")
            grid = [''.join(_cell_to_char(cell) for cell in r) for r in squares]
        elif isinstance(board_input.get("placements"), list):
            squares = [[None for _ in range(cols)] for _ in range(rows)]
            for p in board_input.get("placements"):
                try:
                    x = int(p.get("x"))
                    y = int(p.get("y"))
                    letter = str(p.get("letter", "")).upper()[:1]
                    is_blank = bool(p.get("is_blank") or p.get("isBlank") or False)
                except Exception:
                    raise HTTPException(status_code=400, detail="malformed_board")
                if not (0 <= x < cols and 0 <= y < rows):
                    raise HTTPException(status_code=400, detail="invalid_board_coordinate")
                squares[y][x] = '?' if is_blank or letter in ('?', '*') else letter
            grid = [''.join(_cell_to_char(v) for v in row) for row in squares]
        else:
            raise HTTPException(status_code=400, detail="board.grid missing")
    else:
        raise HTTPException(status_code=400, detail="board invalid type")
    if not (isinstance(grid, list) and len(grid) == 15 and all(isinstance(r, str) and len(r) == 15 for r in grid)):
        raise HTTPException(status_code=400, detail="board.grid must be 15 strings of length 15")
    return {"rows": 15, "cols": 15, "grid": grid}
