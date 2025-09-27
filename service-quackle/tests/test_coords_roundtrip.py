import json
from typing import Tuple

from quackle_service import main as m


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
        coord_map = m._grid_to_coordmap(grid)
        assert case['one'] in coord_map
        assert coord_map[case['one']]['letter'] == 'X'

        # Sanitize pass-through does not drop the coordinate
        sanitized = m._sanitize_coordmap_for_bridge({case['one']: {'letter': 'X', 'isBlank': False}})
        assert case['one'] in sanitized
