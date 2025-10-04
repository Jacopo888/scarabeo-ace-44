from fastapi.testclient import TestClient

from quackle_service.main import app
from quackle_service.normalization import grid_to_coordmap


def make_client():
    return TestClient(app)


def empty_grid():
    return ["." * 15 for _ in range(15)]


def test_bag_summary_empty_board_and_rack():
    client = make_client()
    grid = empty_grid()
    coord_map = grid_to_coordmap(grid)
    body = {"board": coord_map, "rack": "AEIRSTZ"}
    r = client.post("/bag/summary", json=body)
    assert r.status_code == 200, r.text
    j = r.json()
    # 100 tiles total - 7 on rack = 93 remaining
    assert j.get("remaining_count") == 93
    by = j.get("remaining_by_letter")
    # Check a couple of letters were decremented
    assert by["A"] == 8  # 9 - 1
    assert by["E"] == 11  # 12 - 1
    assert by["R"] == 5   # 6 - 1
    assert by["Z"] == 0   # 1 - 1


def test_bag_summary_center_A_and_HELLO_blanks():
    client = make_client()
    grid = empty_grid()
    # Place 'A' at center (row 7, col 7 in 0-based => 8,8 in 1-based)
    row = list(grid[7])
    row[7] = 'A'
    grid[7] = ''.join(row)

    coord_map = grid_to_coordmap(grid)
    body = {"board": coord_map, "rack": "HELLO??"}
    r = client.post("/bag/summary", json=body)
    assert r.status_code == 200, r.text
    j = r.json()
    # 100 tiles total - 1 on board - 7 on rack = 92 remaining
    assert j.get("remaining_count") == 92
    by = j.get("remaining_by_letter")
    assert by["A"] == 8   # 9 - 1 on board
    assert by["H"] == 1   # 2 - 1 in rack
    assert by["E"] == 11  # 12 - 1 in rack
    assert by["L"] == 2   # 4 - 2 in rack
    assert by["O"] == 7   # 8 - 1 in rack
    assert by["?"] == 0   # 2 - 2 blanks in rack


def test_bag_summary_with_opponent_rack():
    client = make_client()
    grid = empty_grid()
    # Center 'A'
    row = list(grid[7])
    row[7] = 'A'
    grid[7] = ''.join(row)

    coord_map = grid_to_coordmap(grid)
    body = {"board": coord_map, "rack": "HELLO??", "opponent_rack": "AB"}
    r = client.post("/bag/summary", json=body)
    assert r.status_code == 200, r.text
    j = r.json()
    # unseen_count is as before (board + my rack removed)
    assert j.get("unseen_count") == 92
    # bag_count removes opponent rack too
    assert j.get("bag_count") == 90
    by_bag = j.get("bag_by_letter")
    assert by_bag["A"] == 7  # 9 - 1 (board) - 1 (opp)
    assert by_bag["B"] == 1  # 2 - 1 (opp)


def test_bag_summary_partial_rack_allowed():
        client = make_client()
        grid = empty_grid()
        coord_map = grid_to_coordmap(grid)
        body = {"board": coord_map, "rack": "HELLO", "opponent_rack": "ABCD"}
        r = client.post("/bag/summary", json=body)
        assert r.status_code == 200, r.text
        j = r.json()
        # Total unseen = 100 - 0(board) - 5 = 95
        assert j.get("unseen_count") == 95
        # Bag after removing opponent 4 tiles = 91
        assert j.get("bag_count") == 91
