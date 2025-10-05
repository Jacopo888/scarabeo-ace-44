from __future__ import annotations
from typing import Any, Dict, List, Optional
import re


def is_coord_map(d: Dict[str, Any]) -> bool:
    if not isinstance(d, dict):
        return False
    if not d:
        return True
    for k in d.keys():
        if isinstance(k, str) and re.fullmatch(r"\d+,\d+", k):
            return True
    return False


def squares_from_coord_map(coord_map: Dict[str, Any], rows: int, cols: int) -> List[List[Optional[str]]]:
    """Strict 0-based coordinate map parser.

    Accepts only keys in the form "r,c" where r and c are integers in [0, rows-1] and [0, cols-1].
    No 1-based compatibility shim.
    """
    squares: List[List[Optional[str]]] = [[None for _ in range(cols)] for _ in range(rows)]
    for k, v in coord_map.items():
        if not isinstance(k, str) or not re.fullmatch(r"\d+,\d+", k):
            raise ValueError("malformed_board")
        r_str, c_str = k.split(',')
        try:
            r0 = int(r_str)
            c0 = int(c_str)
        except Exception:
            raise ValueError("malformed_board")
        if not (0 <= r0 < rows and 0 <= c0 < cols):
            raise ValueError("invalid_board_coordinate")
        if isinstance(v, dict):
            letter = str(v.get("letter", "")).upper()
            is_blank = bool(v.get("isBlank") or v.get("is_blank") or False)
        else:
            letter = str(v).upper()
            is_blank = False
        if not letter or letter == ".":
            continue
        squares[r0][c0] = "?" if is_blank or letter in ("?","*") else letter[:1]
    return squares


def grid_from_squares(squares: List[List[Optional[str]]]) -> List[str]:
    rows = len(squares)
    cols = len(squares[0]) if rows else 0
    grid: List[str] = []
    for r in range(rows):
        row = ''.join(
            '.' if (squares[r][c] in (None, '', '.')) else ('?' if squares[r][c] in ('?','*') else str(squares[r][c]).upper()[:1])
            for c in range(cols)
        )
        grid.append(row)
    return grid


def coord_map_from_grid(grid: List[str]) -> Dict[str, Dict[str, Any]]:
    if not (isinstance(grid, list) and len(grid) == 15 and all(isinstance(r, str) and len(r) == 15 for r in grid)):
        raise ValueError("board.grid must be 15 strings of length 15")
    out: Dict[str, Dict[str, Any]] = {}
    for r, row in enumerate(grid):
        for c, ch in enumerate(row):
            if ch == '.':
                continue
            ch_up = str(ch).upper()[:1]
            if ch_up in ('?', '*'):
                # cannot infer blank's assigned letter from single-char grid
                continue
            out[f"{r},{c}"] = {"letter": ch_up, "isBlank": False}
    return out
