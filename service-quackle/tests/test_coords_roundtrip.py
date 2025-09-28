import json
from typing import Tuple

from quackle_service.normalization import grid_to_coordmap
from quackle_service.lib.encoding import squares_from_coord_map, grid_from_squares


def test_zero_one_string_roundtrip():
    with open('fixtures/coords/test_payload.json', 'r') as f:
        payload = json.load(f)
    assert payload.get('boardSize') == 15
    cases = payload.get('cases', [])
    # Validate grid<->coordmap path for a single-letter placement per case
    for case in cases:
        # Build a 15x15 grid with the letter 'X' at the zero-based coord
        r0, c0 = case['zero']
        grid = ['.' * 15 for _ in range(15)]
        row = list(grid[r0])
        row[c0] = 'X'
        grid[r0] = ''.join(row)

        # Convert grid to 1-based coord map
        coord_map = grid_to_coordmap(grid)
        assert case['one'] in coord_map
        assert coord_map[case['one']]['letter'] == 'X'

    # Roundtrip via squares/grid utilities preserves the coordinate
    squares = squares_from_coord_map({case['one']: {'letter': 'X', 'isBlank': False}}, 15, 15)
    grid_rt = grid_from_squares(squares)
    # back to coord_map should include the same coordinate (letter non-blank)
    coord_map_rt = grid_to_coordmap(grid_rt)
    assert case['one'] in coord_map_rt
