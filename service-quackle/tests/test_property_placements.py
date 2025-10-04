import random
from typing import List, Optional
from quackle_service.normalization import normalize_board_for_bridge as _normalize_board_for_bridge, grid_to_coordmap


def make_empty_grid(n: int = 15) -> List[str]:
    return ["." * n for _ in range(n)]


def place(grid: List[str], r: int, c: int, letter: str) -> List[str]:
    row = list(grid[r])
    row[c] = letter
    grid[r] = ''.join(row)
    return grid


def test_property_coordmap_roundtrip_and_legacy_rejected():
    rnd = random.Random(42)
    # 1) Positive: 50 random single placements using coord map
    for _ in range(50):
        r = rnd.randint(0, 14)
        c = rnd.randint(0, 14)
        grid = make_empty_grid()
        grid = place(grid, r, c, 'X')
        coord_map = grid_to_coordmap(grid)
        out = _normalize_board_for_bridge(coord_map)
        assert out["grid"][r][c] == 'X'
    # 2) Legacy grid rejected
    import pytest
    with pytest.raises(Exception):
        _normalize_board_for_bridge({"rows":15, "cols":15, "grid": make_empty_grid()})
    # 3) Legacy placements rejected
    with pytest.raises(Exception):
        _normalize_board_for_bridge({"rows":15, "cols":15, "placements": [{"x":16, "y":1, "letter":"A", "is_blank": False}]})
