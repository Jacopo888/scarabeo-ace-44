from __future__ import annotations
import os
from fastapi import APIRouter
from fastapi.responses import JSONResponse

from .config import APPDATA, BRIDGE_BIN, LEXDIR, LEXICON_NAME, TIMEOUT_MS
import os
from .runtime import ensure_lexicon_ready, strategy_inventory

router = APIRouter()

@router.get("/health")
def health():
    lexicon_name = os.getenv("LEXICON_NAME", os.getenv("QUACKLE_LEXICON", "enable1.15").strip()).strip()
    lexdir = os.getenv("QUACKLE_LEXDIR", "/data/lexica").strip()
    appdata = os.getenv("QUACKLE_APPDATA_DIR", "/data/appdata").strip()
    skip = os.getenv("QUACKLE_SKIP_LEXICON_CHECK", "").strip().lower() in {"1","true","yes","on"}

    ok, dawg, gaddag = ensure_lexicon_ready()
    strat_debug = strategy_inventory()
    def size_or_zero(p):
        try:
            return os.path.getsize(p)
        except Exception:
            return 0
    engine_ready = (os.path.exists(BRIDGE_BIN) and os.access(BRIDGE_BIN, os.X_OK) and (ok or skip))
    payload = {
        "status": "ok",
        "engine": "quackle-bridge",
        "engine_ready": engine_ready,
        "bridge_path": BRIDGE_BIN,
        "timeout_ms": TIMEOUT_MS,
        "lexicon": lexicon_name,
        "lexdir": lexdir,
        "lexicon_check_skipped": skip,
        "bridge_ruleset": "en",
        "board_schema": "coord_map_1based",
        "payload_sanitize": True,
        "dawg_exists": os.path.isfile(dawg),
        "gaddag_exists": os.path.isfile(gaddag),
        "dawg_size": size_or_zero(dawg),
        "gaddag_size": size_or_zero(gaddag),
        "word_count": None,
        "version": "v104-strict",
        "strategy_ready": strat_debug["all_ok"],
        "strategy_files": strat_debug["strategy"],
        "strategy": {
            "syn2": strat_debug["strategy"].get("default_english/syn2", {}).get("exists", False),
            "vcplace": strat_debug["strategy"].get("default_english/vcplace", {}).get("exists", False),
            "superleaves": strat_debug["strategy"].get("default_english/superleaves", {}).get("exists", False),
            "worths": strat_debug["strategy"].get("default_english/worths", {}).get("exists", False),
            "bogowin": strat_debug["strategy"].get("default/bogowin", {}).get("exists", False),
        },
    }
    return payload

@router.get("/healthz")
def healthz():
    return {"ok": True}

@router.get("/health/cors")
def health_cors():
    allow = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]
    return {"allow_origins": allow}

@router.get("/health/lexicon")
def health_lexicon():
    ok, dawg, gaddag = ensure_lexicon_ready()
    status = 200 if ok else 503
    body = {
        "lexicon_name": os.getenv("LEXICON_NAME", os.getenv("QUACKLE_LEXICON", "enable1.15").strip()).strip(),
        "lex_dir": os.getenv("QUACKLE_LEXDIR", "/data/lexica").strip(),
        "lexicon_ok": ok,
        "dawg_path": dawg,
        "gaddag_path": gaddag,
    }
    return JSONResponse(body, status_code=status)
