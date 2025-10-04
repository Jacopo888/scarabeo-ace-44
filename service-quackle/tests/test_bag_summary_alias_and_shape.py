from fastapi.testclient import TestClient

from quackle_service.main import app
from quackle_service.normalization import grid_to_coordmap


def make_client():
    return TestClient(app)


def empty_grid():
    return ["." * 15 for _ in range(15)]


def test_bag_summary_alias_opponentRack_and_shape():
    client = make_client()
    grid = empty_grid()
    coord_map = grid_to_coordmap(grid)
    body_camel = {"board": coord_map, "rack": "ABCDEF?", "opponentRack": "GH"}
    body_snake = {"board": coord_map, "rack": "ABCDEF?", "opponent_rack": "GH"}

    r1 = client.post("/bag/summary", json=body_camel)
    r2 = client.post("/bag/summary", json=body_snake)

    assert r1.status_code == 200, r1.text
    assert r2.status_code == 200, r2.text

    j1 = r1.json()
    j2 = r2.json()

    # Shape invariants
    for j in (j1, j2):
        assert isinstance(j.get("remaining_count"), int)
        assert isinstance(j.get("unseen_count"), int)
        for k in ("remaining_by_letter", "unseen_by_letter", "bag_by_letter"):
            assert isinstance(j.get(k), dict)
            # Basic expected keys include A..Z and ?
            for letter in ["A", "E", "I", "O", "U", "?", "Z"]:
                assert letter in j[k]
        for k in ("pool", "unseen_pool", "bag_pool"):
            assert isinstance(j.get(k), list)

    # With the same inputs (just alias difference) responses should be equal
    assert j1 == j2
