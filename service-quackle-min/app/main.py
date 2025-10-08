from __future__ import annotations
from fastapi import FastAPI, HTTPException, Request
from .config import LEXICON, LEXDIR, ENGINE_BIN
from .lexicon import lexicon_ready, lexicon_files
from .validate import normalize_rack, validate_board_coord_map
from .engine import best_move
import os
import time

_START = time.time()

app = FastAPI()

@app.get("/health")
def health():
    dawg, gaddag = lexicon_files()
    dawg_size = os.path.getsize(dawg) if os.path.isfile(dawg) else 0
    gaddag_size = os.path.getsize(gaddag) if os.path.isfile(gaddag) else 0
    lex_ready = (dawg_size > 0 and gaddag_size > 0)
    bin_ready = (os.path.isfile(ENGINE_BIN) and os.access(ENGINE_BIN, os.X_OK))
    engine_ready = (lex_ready and bin_ready)
    return {
        "engine_ready": engine_ready,
        "lexicon": LEXICON,
        "lexdir": LEXDIR,
        "dawg_size": dawg_size,
        "gaddag_size": gaddag_size,
        "binary_path": ENGINE_BIN,
        "binary_present": bin_ready,
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
