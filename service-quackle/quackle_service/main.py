import os
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
import logging

from .config import (
    LEXDIR,
    APPDATA,
    ENV_MODE,
)
from .runtime import ensure_lexicon_files, ensure_lexicon_ready as _ensure_lexicon_ready
from .routes_best_move import router as best_move_router
from .routes_health import router as health_router
from .routes_debug import router as debug_router
import re
from typing import Dict, Any

_log = logging.getLogger(__name__)


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
                _log.info("[ACCESS] %s %s len=%s", request.method, request.url.path, len(raw))
            else:
                _log.info("[ACCESS] %s %s", request.method, request.url.path)
        except Exception:
            _log.info("[ACCESS] %s %s <body read error>", request.method, request.url.path)
        response = await call_next(request)
        return response

app.add_middleware(RequestLoggerMiddleware)

# Register routers
app.include_router(health_router)
app.include_router(best_move_router)

# Conditional debug router: mount only if DEBUG_ROUTES enabled or non-prod environment
DEBUG_ROUTES_ENABLED = os.getenv("DEBUG_ROUTES", "").strip().lower() in {"1", "true", "yes", "on"}
if DEBUG_ROUTES_ENABLED or ENV_MODE != "prod":
    app.include_router(debug_router)
    _log.info("[startup] 🐛 Debug routes ENABLED (DEBUG_ROUTES=%s, ENV=%s)", DEBUG_ROUTES_ENABLED, ENV_MODE)
else:
    _log.info("[startup] 🔒 Debug routes DISABLED (production mode, ENV=%s)", ENV_MODE)

"""
Main FastAPI app bootstrap: mounts routers and adds a tiny request-logging middleware.
All business logic lives in dedicated modules under quackle_service/.
"""


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
