import pytest
from fastapi import HTTPException
from quackle_service.normalization import normalize_board_for_bridge

# Coord map valida minimale: singola lettera al centro (0-based 7,7)
VALID_COORD_MAP = {"7,7": {"letter": "A", "isBlank": False}}

@pytest.mark.parametrize("board_input", [
    ["."*15 for _ in range(15)],  # plain grid list
    {"rows": 15, "cols": 15, "grid": ["."*15 for _ in range(15)]},  # dict con grid
    {"rows": 15, "cols": 15, "squares": [[None for _ in range(15)] for _ in range(15)]},  # squares
    {"rows": 15, "cols": 15, "placements": [{"x": 7, "y": 7, "letter": "A", "is_blank": False}]},  # placements
])
def test_rejected_legacy_formats(board_input):
    with pytest.raises(HTTPException) as ei:
        normalize_board_for_bridge(board_input)
    assert ei.value.status_code == 400
    assert ei.value.detail == "unsupported_board_format"


def test_accepts_coord_map_only():
    out = normalize_board_for_bridge(VALID_COORD_MAP)
    assert out["rows"] == 15 and out["cols"] == 15
    # Verifica che la lettera sia stata posizionata nella griglia normalizzata
    assert out["grid"][7][7] == 'A'


def test_invalid_coord_in_coord_map():
    # Coord fuori bounds (16,16)
    bad = {"16,16": {"letter": "Z", "isBlank": False}}
    with pytest.raises(HTTPException) as ei:
        normalize_board_for_bridge(bad)
    assert ei.value.status_code == 400
    # La conversione interna oggi alza malformed_board o invalid_board_coordinate: accettiamo uno dei due
    assert ei.value.detail in {"malformed_board", "invalid_board_coordinate"}
