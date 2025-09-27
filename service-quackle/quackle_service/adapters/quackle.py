from __future__ import annotations
from typing import Any, Dict

# Adapter wraps the internal bridge call to provide a stable boundary
# and a single place to adjust mapping or error handling.

from ..main import _call_bridge  # reuse existing implementation


def best_move(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Invoke the quackle bridge with a normalized payload.

    Payload keys:
      - board: normalized board object (as expected by _call_bridge)
      - rack: uppercase 0..7 letters string with ?/* for blanks
      - difficulty: optional 'easy'|'medium'|'hard'

    Returns the raw bridge result dict.
    """
    # In future we could inject timeouts, metrics, retries here.
    return _call_bridge(payload)
