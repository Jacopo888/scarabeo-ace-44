from __future__ import annotations
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from .config import LEXICON, LEXDIR, ENGINE_BIN
from .lexicon import lexicon_ready, lexicon_files
from .validate import normalize_rack, validate_board_coord_map
from .engine import best_move
import os
import time
import shutil
from pathlib import Path

_START = time.time()

app = FastAPI()

# CORS: origini da env CORS_ORIGINS (lista separata da virgole)
import os as _os
_cors_env = _os.getenv("CORS_ORIGINS", "").strip()
_cors_origins = [o.strip() for o in _cors_env.split(",") if o.strip() and o.strip() != "*"]
if _cors_env == "*":
    # Wildcard: consenti tutte le origini (senza credenziali)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
        max_age=3600,
    )
elif _cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        max_age=3600,
    )

@app.get("/health")
def health():
    dawg, gaddag = lexicon_files()
    dawg_size = os.path.getsize(dawg) if os.path.isfile(dawg) else 0
    gaddag_size = os.path.getsize(gaddag) if os.path.isfile(gaddag) else 0
    lex_ready = (dawg_size > 0 and gaddag_size > 0)
    bin_ready = (os.path.isfile(ENGINE_BIN) and os.access(ENGINE_BIN, os.X_OK))
    # Also require strategies to be present to declare ready
    strat_ready = bool(_STRATEGY_BOOT.get("ready"))
    engine_ready = (lex_ready and bin_ready and strat_ready)
    return {
        "engine_ready": engine_ready,
        "lexicon": LEXICON,
        "lexdir": LEXDIR,
        "dawg_size": dawg_size,
        "gaddag_size": gaddag_size,
        "binary_path": ENGINE_BIN,
        "binary_present": bin_ready,
        "strategy_ready": strat_ready,
        "strategy_dest": _STRATEGY_BOOT.get("dest"),
        "strategy_src": _STRATEGY_BOOT.get("src"),
        "strategy_errors": _STRATEGY_BOOT.get("errors", []),
        "uptime_s": round(time.time() - _START, 2)
    }

MAX_BODY_LEN = 32_000  # safeguard semplice

@app.post("/best-move")
async def post_best_move(req: Request):
    if req.headers.get("content-length"):
        try:
            if int(req.headers["content-length"]) > MAX_BODY_LEN:
                raise HTTPException(status_code=400, detail="invalid_input")
        except ValueError:
            raise HTTPException(status_code=400, detail="invalid_input")
    raw = await req.body()
    if len(raw) > MAX_BODY_LEN:
        raise HTTPException(status_code=400, detail="invalid_input")
    import json as _json
    try:
        body = _json.loads(raw.decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=400, detail="invalid_input")
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="invalid_input")
    rack = normalize_rack(body.get("rack"))
    board = validate_board_coord_map(body.get("board") or {})
    if not lexicon_ready():
        raise HTTPException(status_code=500, detail="lexicon_not_ready")
    data = best_move(rack, board)
    # Pass-through semplificato -> normalizziamo solo la chiave raw
    move_type = data.get("move_type") or "play"
    out = {"move_type": move_type, "raw": data}
    if move_type == "play":
        out["score"] = data.get("score")
        out["tiles"] = data.get("tiles")
    elif move_type == "exchange":
        if "exchange_letters" in data:
            out["exchange_letters"] = data.get("exchange_letters")
    return out

@app.get("/")
def root():
    return {"ok": True}

# Stub opzionale per compat con vecchio FE: non supportato nel minimal service
@app.get("/lexicon/words")
def lexicon_words(q: str | None = None, limit: int = 100):
    # Restituiamo 200 con payload vuoto per non rompere il FE
    return {"supported": False, "words": [], "q": q or "", "limit": limit}
def _ensure_strategy_on_startup() -> dict:
    """Validate strategy files presence only (no runtime copy).

    Files are baked into the image at build time under /data/appdata/strategy.
    """
    dest = Path(os.getenv("QUACKLE_STRATEGY_DIR", "/data/appdata/strategy")).resolve()
    required = {
        "default_english/syn2",
        "default_english/vcplace",
        "default_english/superleaves",
        "default_english/worths",
        "default/bogowin",
    }
    errors: list[str] = []
    copied: list[str] = []
    # Just validate presence
    def ok(p: Path) -> bool:
        try:
            return p.exists() and p.is_file() and p.stat().st_size > 0
        except Exception:
            return False
    for rel in required:
        p = dest / rel
        if not ok(p):
            errors.append(f"missing:{p}")
    ready = len(errors) == 0
    return {
        "dest": str(dest),
        "src": str(dest),
        "copied": copied,
        "ready": ready,
        "errors": errors,
    }

_STRATEGY_BOOT = _ensure_strategy_on_startup()
