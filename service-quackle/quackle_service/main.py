import os, sys
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
import logging

from .config import (
    logger,
    LEXDIR,
    APPDATA,
)
from .runtime import ensure_lexicon_files, ensure_lexicon_ready as _ensure_lexicon_ready
from .routes_best_move import router as best_move_router
from .routes_health import router as health_router
from .routes_debug import router as debug_router
from .normalization import (
    normalize_board_for_bridge as _normalize_board_for_bridge,
    grid_to_coordmap as _grid_to_coordmap,
    sanitize_none as _sanitize_none,
)
import re
from typing import Dict, Any

logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1) Create directories idempotently
    Path(LEXDIR).mkdir(parents=True, exist_ok=True)
    Path(APPDATA).mkdir(parents=True, exist_ok=True)
    print(f"[startup] Created/verified LEXDIR={LEXDIR} APPDATA={APPDATA}")
    # 2) Optional download and validation
    st = ensure_lexicon_files()
    print(f"[startup] Lexicon ensure: ok={st['ok']} dawg={st['dawg_path']}({st['dawg_size']}) gaddag={st['gaddag_path']}({st['gaddag_size']})")
    if st["errors"]:
        print(f"[startup] Lexicon errors: {st['errors']}")


    # 3) Block until completion of download/verification (done above synchronously)
    yield

app = FastAPI(lifespan=lifespan)
# Evaluate CORS origins dynamically from env to support tests that reload the module with different settings
_ALLOW_ORIGINS_LOCAL = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]
app.add_middleware(CORSMiddleware, allow_origins=_ALLOW_ORIGINS_LOCAL, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# Simple request logger middleware
class RequestLoggerMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        try:
            if request.url.path == "/best-move":
                raw = await request.body()
                print("[ACCESS]", request.method, request.url.path, "len=", len(raw))
            else:
                print("[ACCESS]", request.method, request.url.path)
        except Exception:
            print("[ACCESS]", request.method, request.url.path, "<body read error>")
        response = await call_next(request)
        return response

app.add_middleware(RequestLoggerMiddleware)

# Register routers
app.include_router(health_router)
app.include_router(best_move_router)
app.include_router(debug_router)

"""
Main FastAPI app bootstrap: mounts routers and adds a tiny request-logging middleware.
All business logic lives in dedicated modules under quackle_service/.
"""

# -------------------------------------------------------------
# Back-compat shims for tests that import helpers from main.py
# -------------------------------------------------------------

def _sanitize_coordmap_for_bridge(board_in):
    out = {}
    for k, v in (board_in or {}).items():
        if not (isinstance(k, str) and re.fullmatch(r"\d+,\d+", k)):
            continue
        try:
            r_str, c_str = k.split(',')
            r, c = int(r_str), int(c_str)
        except Exception:
            continue
        if not (1 <= r <= 15 and 1 <= c <= 15):
            continue
        if isinstance(v, dict):
            letter = str(v.get("letter", "")).strip().upper()[:1]
            is_blank = bool(v.get("isBlank") or v.get("is_blank") or False)
        else:
            letter = str(v).strip().upper()[:1]
            is_blank = False
        if not letter or letter in {'.', '?', '*'}:
            continue
        if not re.fullmatch(r"[A-Z]", letter):
            continue
        out[k] = {"letter": letter, "isBlank": bool(is_blank)}
    return out

def _call_bridge(payload: Dict[str, Any]) -> Dict[str, Any]:
    # Back-compat shim: delegate to bridge client
    from .bridge_client import call_bridge
    return call_bridge(payload)

def ensure_lexicon_ready():
    # Back-compat shim for tests that patch main.ensure_lexicon_ready
    return _ensure_lexicon_ready()

@app.get("/debug/sample-moves")
def debug_sample_moves():
    # kept for backwards compatibility; actual implementation moved in routes_debug
    return {"moved": True, "use": "/debug/sample-moves via routes"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
