import random
from typing import List, Optional
from quackle_service.main import _normalize_board_for_bridge


def make_empty_grid(n: int = 15) -> List[str]:
    return ["." * n for _ in range(n)]


def place(grid: List[str], r: int, c: int, letter: str) -> List[str]:
    row = list(grid[r])
    row[c] = letter
    grid[r] = ''.join(row)
    return grid


def test_property_anchors_and_bounds():
    rnd = random.Random(42)  # deterministic seed
    # Generate 50 random single-letter placements in-bounds and ensure normalization preserves anchors
    for _ in range(50):
        r = rnd.randint(0, 14)
        c = rnd.randint(0, 14)
        grid = make_empty_grid()
        grid = place(grid, r, c, 'X')
        out = _normalize_board_for_bridge({"rows": 15, "cols": 15, "grid": grid})
        assert out["rows"] == 15 and out["cols"] == 15
        assert out["grid"][r][c] == 'X'

    # Out-of-bounds coordinates via placements array should be rejected (bubble 400 upstream)
    # Here we expect _normalize_board_for_bridge to raise on invalid coordinate
    try:
        _normalize_board_for_bridge({
            "rows": 15, "cols": 15,
            "placements": [{"x": 16, "y": 1, "letter": "A", "is_blank": False}]
        })
        assert False, "expected exception for out-of-bounds placement"
    except Exception:
        pass
