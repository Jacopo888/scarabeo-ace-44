from __future__ import annotations


def clamp_timeout_ms(ms: int, min_ms: int = 100, max_ms: int = 60000) -> int:
    try:
        v = int(ms)
    except Exception:
        v = 8000
    v = max(min_ms, min(max_ms, v))
    return v


def to_subprocess_timeout_s(ms: int) -> int:
    ms = clamp_timeout_ms(ms)
    # subprocess.run timeout is seconds (int). Ensure at least 1.
    return max(1, ms // 1000)
