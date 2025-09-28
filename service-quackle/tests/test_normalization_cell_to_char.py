import pytest
from quackle_service.normalization import _cell_to_char

@pytest.mark.parametrize(
    "inp, expected",
    [
        (None, '.'),
        ('', '.'),
        ('.', '.'),
        ('?', '?'),
        ('*', '?'),
        ('a', 'A'),
        ('Z', 'Z'),
        ('word', 'W'),
        (1, '1'),
    ],
)
def test_cell_to_char(inp, expected):
    assert _cell_to_char(inp) == expected
