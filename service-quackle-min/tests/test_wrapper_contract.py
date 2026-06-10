from pathlib import Path


def test_wrapper_uses_full_move_tiles_for_coordinates():
    wrapper = (Path(__file__).parents[1] / "json_wrapper_main.cpp").read_text(encoding="utf-8")

    assert "LetterString moveTiles = move.tiles()" in wrapper
    assert "using it for coordinates shifts every tile after an anchor" in wrapper
    assert "LetterString used = best.usedTiles()" not in wrapper
