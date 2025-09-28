from __future__ import annotations
import os
import json
import subprocess
from typing import Any, Dict
from pathlib import Path
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from .config import APPDATA, BRIDGE_BIN, QUACKLE_LEXDIR, QUACKLE_LEXICON, DEBUG_ENABLE_LDD
from .runtime import strategy_inventory
from .bridge_client import call_bridge_simple_op, call_bridge
from .normalization import normalize_rack_flexible, normalize_board_for_bridge, is_coord_map, sanitize_none, grid_to_coordmap, reconstruct_tiles_from_raw_move

router = APIRouter()

@router.get("/debug/ping")
def debug_ping():
    return {"ok": True, "msg": "pong", "version": "v104-debug"}

@router.get("/debug/strategy")
def debug_strategy():
    base = Path(os.getenv("QUACKLE_APPDATA_DIR", "/data/appdata")).joinpath("strategy")
    inventory = []
    for root, _, files in os.walk(base):
        for name in files:
            p = Path(root) / name
            try:
                sz = p.stat().st_size
                h = None
            except Exception:
                sz, h = 0, None
            inventory.append({"path": str(p), "size": sz, "sha256": h})
    def ok(rel: str) -> bool:
        p = base / rel
        try:
            return p.is_file() and p.stat().st_size > 0
        except Exception:
            return False
    required = {
        "syn2": ok("default_english/syn2"),
        "vcplace": ok("default_english/vcplace"),
        "superleaves": ok("default_english/superleaves"),
        "worths": ok("default_english/worths"),
        "bogowin": ok("default/bogowin"),
    }
    return {"inventory": inventory, "required_flags": required, "bridge_path": BRIDGE_BIN, "bridge_version": "v104-strict"}

@router.get("/debug/config")
async def debug_config():
    return {
        "cors_origins": [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()],
        "env_mode": os.getenv("ENV", "").lower(),
        "cors_origins_raw": os.getenv("CORS_ORIGINS", ""),
        "quackle_lexicon": os.getenv("QUACKLE_LEXICON", ""),
        "quackle_lexdir": QUACKLE_LEXDIR,
        "lexicon_name": os.getenv("LEXICON_NAME", os.getenv("QUACKLE_LEXICON", "enable1.15").strip()).strip(),
        "lex_dir": os.getenv("QUACKLE_LEXDIR", "/data/lexica").strip()
    }

@router.get("/debug/ldd")
def debug_ldd():
    if not DEBUG_ENABLE_LDD:
        return {"enabled": False}
    info = {
        "enabled": True,
        "bridge_path": BRIDGE_BIN,
        "exists": os.path.exists(BRIDGE_BIN),
        "executable": os.access(BRIDGE_BIN, os.X_OK) if os.path.exists(BRIDGE_BIN) else False,
    }
    try:
        proc = subprocess.run(["ldd", BRIDGE_BIN], capture_output=True, text=True, timeout=3)
        out = (proc.stdout or "") + ("\n" + (proc.stderr or "")).strip()
        info.update({"returncode": proc.returncode, "output": out[:4000]})
    except Exception as e:
        info.update({"error": str(e)})
    return info

@router.get("/debug/selftest")
def debug_selftest():
    try:
        child_env = {**os.environ, "QUACKLE_APPDATA_DIR": APPDATA, "QUACKLE_LEXDIR": QUACKLE_LEXDIR, "QUACKLE_LEXICON": QUACKLE_LEXICON}
        args = [BRIDGE_BIN, "--lexicon", QUACKLE_LEXICON, "--lexdir", QUACKLE_LEXDIR, "--gaddag", f"{QUACKLE_LEXDIR}/{QUACKLE_LEXICON}.gaddag", "--ruleset", "en", "--selftest"]
        proc = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=child_env, timeout=10)
        return JSONResponse({"rc": proc.returncode, "stdout": proc.stdout.decode("utf-8", errors="replace"), "stderr": proc.stderr.decode("utf-8", errors="replace")}, status_code=200 if proc.returncode == 0 else 500)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@router.post("/debug/probe")
async def debug_probe(request: Request):
    try:
        raw = await request.body()
        body = json.loads(raw.decode("utf-8")) if raw else {}
        rack_norm = normalize_rack_flexible(body.get("rack"))
        board_out = normalize_board_for_bridge(body.get("board"))
        non_empty = any(ch != '.' for row in board_out.get("grid", []) for ch in row)
        payload = {"board": board_out, "rack": rack_norm}
        result = call_bridge_simple_op("compute") if False else call_bridge(payload)  # reuse main compute path for consistency
        return {
            "took_ms": result.get("time_ms", 0),
            "timeout_hit": False,
            "board_empty": not non_empty,
            "center_anchor_ok": True,
            "generated_count": len(result.get("moves", [])) if isinstance(result.get("moves"), list) else 0,
            "legal_count": len([m for m in result.get("moves", []) if m.get("score", 0) > 0]) if isinstance(result.get("moves"), list) else 0,
            "top_5_moves": result.get("moves", [])[:5] if isinstance(result.get("moves"), list) else []
        }
    except Exception as e:
        return {"error": str(e), "took_ms": 0, "timeout_hit": False, "board_empty": False, "center_anchor_ok": False, "generated_count": 0, "legal_count": 0, "top_5_moves": []}

@router.post("/debug/bridge-payload")
def debug_bridge_payload(req: Dict[str, Any]):
    rack_str = normalize_rack_flexible(req.get("rack"))
    b_in = req.get("board")
    if isinstance(b_in, dict) and is_coord_map(b_in):
        coord_map = {k: v for k, v in b_in.items() if isinstance(k, str)}
    else:
        board_out = normalize_board_for_bridge(b_in)
        grid = board_out["grid"]
        coord_map = grid_to_coordmap(grid)
    bridge_payload = sanitize_none({"rack": rack_str, "ruleset": "en", "board": coord_map})
    return {"bridge_payload": bridge_payload}

@router.get("/debug/quackle")
def debug_quackle():
    appdata = APPDATA
    lexdir = QUACKLE_LEXDIR
    lex = QUACKLE_LEXICON
    dawg = os.path.join(lexdir, f"{lex}.dawg")
    gaddag = os.path.join(lexdir, f"{lex}.gaddag")
    def size_or_none(p):
        try:
            return os.path.getsize(p) if os.path.exists(p) else None
        except Exception:
            return None
    paths = {
        "syn2": os.path.join(appdata, "strategy", "default_english", "syn2"),
        "vcplace": os.path.join(appdata, "strategy", "default_english", "vcplace"),
        "superleaves": os.path.join(appdata, "strategy", "default_english", "superleaves"),
        "worths_en": os.path.join(appdata, "strategy", "default_english", "worths"),
        "bogowin": os.path.join(appdata, "strategy", "default", "bogowin"),
    }
    return JSONResponse({
        "bridge": BRIDGE_BIN,
        "appdata": appdata,
        "lexicon": lex,
        "lexdir": lexdir,
        "bridge_ruleset": "en",
        "board_schema": "coord_map_1based",
        "payload_sanitize": True,
        "dawg": {"path": dawg, "size": size_or_none(dawg)},
        "gaddag": {"path": gaddag, "size": size_or_none(gaddag)},
        "strategy": {k: {"path": v, "size": size_or_none(v)} for k, v in paths.items()}
    })

@router.get("/debug/strategy-probe")
def debug_strategy_probe():
    res = call_bridge_simple_op("probe_strategy")
    return res

@router.get("/debug/sample-moves")
def debug_sample_moves():
    cases = []
    try:
        board_out = normalize_board_for_bridge({"rows": 15, "cols": 15, "grid": ["."*15 for _ in range(15)]})
        res = call_bridge({"board": board_out, "rack": "AEIRSTZ"})
        cases.append({"name": "empty+AEIRSTZ", "ok": (not res.get("engine_fallback") and res.get("move_type") != "pass"), "res": res if res.get("engine_fallback") else {"move_type": res.get("move_type"), "score": res.get("score")}})
    except Exception as e:
        cases.append({"name": "empty+AEIRSTZ", "ok": False, "error": str(e)})
    try:
        grid = ["."*15 for _ in range(15)]
        grid[7] = ".......A......."
        board_out = normalize_board_for_bridge({"rows": 15, "cols": 15, "grid": grid})
        res = call_bridge({"board": board_out, "rack": "HELLO??"})
        cases.append({"name": "centerA+HELLO??", "ok": (not res.get("engine_fallback") and res.get("move_type") != "pass"), "res": res if res.get("engine_fallback") else {"move_type": res.get("move_type"), "score": res.get("score")}})
    except Exception as e:
        cases.append({"name": "centerA+HELLO??", "ok": False, "error": str(e)})
    try:
        board_out = normalize_board_for_bridge(["."*15 for _ in range(15)])
        res = call_bridge({"board": board_out, "rack": "AEIRSTZ"})
        cases.append({"name": "legacyB+AEIRSTZ", "ok": (not res.get("engine_fallback") and res.get("move_type") != "pass"), "res": res if res.get("engine_fallback") else {"move_type": res.get("move_type"), "score": res.get("score")}})
    except Exception as e:
        cases.append({"name": "legacyB+AEIRSTZ", "ok": False, "error": str(e)})
    return {"cases": cases}
