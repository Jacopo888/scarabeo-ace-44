from __future__ import annotations
from typing import Any, Dict, Optional
from fastapi import HTTPException
from fastapi.responses import JSONResponse


def json_error(detail: str, status_code: int = 400, *, engine: bool = False, extra: Optional[Dict[str, Any]] = None) -> JSONResponse:
    body: Dict[str, Any] = {"error": detail}
    if engine:
        body["engine_fallback"] = True
    if extra:
        body.update(extra)
    return JSONResponse(body, status_code=status_code)


def from_http_exc(e: HTTPException, *, engine: bool = False, extra: Optional[Dict[str, Any]] = None) -> JSONResponse:
    return json_error(str(e.detail), int(e.status_code), engine=engine, extra=extra)


def status_from_engine_result(err: str, rc: Optional[int]) -> int:
    """Map known engine error codes/rc to HTTP status.
    We prefer 400 for client-normalization errors, 502 for bridge/strategy problems.
    """
    if rc is not None:
        if rc == 64:
            return 400
        if rc == 72:
            return 502
        if rc == 70:
            return 500
    if err in {"invalid_board_coordinate", "malformed_coordinate", "rack_empty", "invalid_rack_format", "malformed_board", "invalid_ruleset", "board.grid missing", "board.grid must be 15 strings of length 15"}:
        return 400
    if err.startswith("exec_failed") or err.startswith("bridge_failed_rc") or err == "strategy_missing":
        return 502
    return 500
