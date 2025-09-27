from __future__ import annotations
import pytest

from quackle_service.lib.rack import normalize_rack_flexible
from quackle_service.lib.encoding import is_coord_map, squares_from_coord_map, grid_from_squares, coord_map_from_grid
from quackle_service.lib.timeouts import clamp_timeout_ms, to_subprocess_timeout_s


def test_normalize_rack_flexible_accepts_various_inputs():
    assert normalize_rack_flexible("aei?rt*") == "AEI?RT*"
    assert normalize_rack_flexible(["A","b","C"]) == "ABC"
    assert normalize_rack_flexible([{"letter": "d"}, {"letter": "E"}, "?"]) == "DE?"
    assert normalize_rack_flexible("") == ""
    assert normalize_rack_flexible(None) == ""
    with pytest.raises(ValueError):
        normalize_rack_flexible("a_b")
    with pytest.raises(ValueError):
        normalize_rack_flexible("ABCDEFGH")  # too long but still format-OK; our helper enforces 0..7


def test_encoding_coord_map_roundtrip():
    rows, cols = 15, 15
    cm = {"1,1": {"letter": "A", "isBlank": False}, "8,8": {"letter": "B", "isBlank": False}}
    sq = squares_from_coord_map(cm, rows, cols)
    grid = grid_from_squares(sq)
    assert len(grid) == 15 and all(len(r) == 15 for r in grid)
    cm2 = coord_map_from_grid(grid)
    assert cm2.get("1,1", {}).get("letter") == "A"
    assert cm2.get("8,8", {}).get("letter") == "B"


def test_is_coord_map_detection():
    assert is_coord_map({}) is True
    assert is_coord_map({"1,1": {"letter": "A"}}) is True
    assert is_coord_map({"foo": 1}) is False


def test_timeouts_helpers():
    assert clamp_timeout_ms(50) == 100
    assert clamp_timeout_ms(200000) == 60000
    assert to_subprocess_timeout_s(8000) >= 1
