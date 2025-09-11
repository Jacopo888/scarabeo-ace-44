import os, json, subprocess
from typing import Any, Dict
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi.responses import JSONResponse
import os

ORIGINS = os.getenv("CORS_ORIGINS", "").split(",")
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in ORIGINS if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

BRIDGE_BIN = os.getenv("QUACKLE_BRIDGE_BIN", "./bridge/engine_wrapper").strip()
QUACKLE_LEXICON = os.getenv("QUACKLE_LEXICON", "en-enable").strip()
QUACKLE_LEXDIR = os.getenv("QUACKLE_LEXDIR", "/usr/share/quackle/lexica").strip()

# Additional envs used for preflight/diagnostics (align with Dockerfile defaults)
LEXICON_NAME = os.getenv("LEXICON_NAME", QUACKLE_LEXICON).strip()
LEX_DIR = os.getenv("LEX_DIR", QUACKLE_LEXDIR).strip()
APPDATA_DIR = os.getenv("QUACKLE_APPDATA_DIR", "/usr/share/quackle/data").strip()

def _lex_paths():
    base = os.path.normpath(LEX_DIR)
    dawg = os.path.join(base, f"{LEXICON_NAME}.dawg")
    gaddag = os.path.join(base, f"{LEXICON_NAME}.gaddag")
    return dawg, gaddag

def ensure_lexicon_ready():
    dawg, gaddag = _lex_paths()
    ok = os.path.isfile(dawg) and os.path.isfile(gaddag)
    return ok, dawg, gaddag

@app.get("/health")
def health():
    return {
        "status": "ok",
        "engine": "quackle-bridge",
        "bridge_path": BRIDGE_BIN,
        "lexicon": QUACKLE_LEXICON,
        "lexdir": QUACKLE_LEXDIR,
        "version": "v104-debug"
    }

@app.get("/debug/config")
async def debug_config():
    """Debug endpoint to return configuration"""
    dawg_path, gaddag_path = _lex_paths()
    dawg_exists = os.path.exists(dawg_path)
    gaddag_exists = os.path.exists(gaddag_path)
    
    return {
        "lexicon": LEXICON_NAME,
        "dawg_exists": dawg_exists,
        "gaddag_exists": gaddag_exists,
        "dawg_path": dawg_path,
        "gaddag_path": gaddag_path,
        "board_width": 15,
        "board_height": 15,
        "center_x": 7,
        "center_y": 7,
        "bridge_bin": BRIDGE_BIN,
        "lex_dir": LEX_DIR,
        "appdata_dir": APPDATA_DIR
    }

@app.post("/debug/probe")
async def debug_probe(request: BestMoveRequest):
    """Debug endpoint to analyze a game state without executing a full turn"""
    try:
        # Call the bridge with debug mode
        payload = {
            "op": "compute",
            "board": {"cells": request.board.cells},
            "rack": request.rack,
            "difficulty": request.difficulty,
            "debug": True
        }
        
        result = _call_bridge(payload)
        
        # Extract debug information from the result
        debug_info = {
            "took_ms": result.get("time_ms", 0),
            "timeout_hit": False,  # We don't have timeout info in current implementation
            "board_empty": result.get("board_empty", False),
            "center_anchor_ok": True,  # Will be determined by bridge logs
            "generated_count": len(result.get("moves", [])),
            "legal_count": len([m for m in result.get("moves", []) if m.get("score", 0) > 0]),
            "top_5_moves": result.get("moves", [])[:5]
        }
        
        return debug_info
        
    except Exception as e:
        logger.error(f"Debug probe failed: {e}")
        return {"error": str(e), "took_ms": 0, "timeout_hit": False, "board_empty": False, 
                "center_anchor_ok": False, "generated_count": 0, "legal_count": 0, "top_5_moves": []}

@app.get("/health/lexicon")
def health_lexicon():
    ok, dawg, gaddag = ensure_lexicon_ready()
    return {
        "lexicon_name": LEXICON_NAME,
        "lex_dir": LEX_DIR,
        "lexicon_ok": ok,
        "dawg_path": dawg,
        "gaddag_path": gaddag,
    }

@app.get("/debug/quackle")
def debug_quackle():
    appdata = APPDATA_DIR
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
        "dawg": {"path": dawg, "size": size_or_none(dawg)},
        "gaddag": {"path": gaddag, "size": size_or_none(gaddag)},
        "strategy": {k: {"path": v, "size": size_or_none(v)} for k, v in paths.items()}
    })

@app.get("/debug/ping")
def debug_ping():
    return {"ok": True, "msg": "pong", "version": "v104-debug"}

@app.get("/debug/lexicon")
def debug_lexicon():
    dawg, gaddag = _lex_paths()
    strat_en = os.path.join(APPDATA_DIR, "strategy", "default_english")
    strat_def = os.path.join(APPDATA_DIR, "strategy", "default")
    def exists(p):
        return os.path.isfile(p)
    def join(*a):
        return os.path.join(*a)
    # Directory listing for diagnostics (names and sizes)
    listing = []
    dir_exists = os.path.isdir(LEX_DIR)
    dir_error = None
    try:
        for name in sorted(os.listdir(LEX_DIR)):
            p = os.path.join(LEX_DIR, name)
            try:
                size = os.path.getsize(p) if os.path.isfile(p) else None
            except Exception:
                size = None
            listing.append({"name": name, "is_file": os.path.isfile(p), "size": size})
    except Exception as e:
        listing = []
        dir_error = str(e)
    return {
        "lexicon_name": LEXICON_NAME,
        "lex_dir": LEX_DIR,
        "lex_dir_exists": dir_exists,
        "lex_dir_error": dir_error,
        "app_data_dir": APPDATA_DIR,
        "dawg_exists": exists(dawg),
        "gaddag_exists": exists(gaddag),
        "lex_dir_listing": listing,
        "env": {
            "DAWG_URL_set": bool(os.getenv("DAWG_URL")),
            "GADDAG_URL_set": bool(os.getenv("GADDAG_URL")),
        },
        "strategy_files": {
            "syn2": exists(join(strat_en, "syn2")),
            "vcplace": exists(join(strat_en, "vcplace")),
            "superleaves": exists(join(strat_en, "superleaves")),
            "bogowin": exists(join(strat_def, "bogowin")),
            "worths_en": exists(join(strat_en, "worths"))
        }
    }

@app.on_event("startup")
def _startup_log():
    print(f"[startup] Lexicon: {LEXICON_NAME}, LexDir: {LEX_DIR}, AppData: {APPDATA_DIR}")
    ok, dawg, gaddag = ensure_lexicon_ready()
    print(f"[startup] DAWG present? {os.path.isfile(dawg)} path={dawg}")
    print(f"[startup] GADDAG present? {os.path.isfile(gaddag)} path={gaddag}")

def _call_bridge(payload: Dict[str, Any]) -> Dict[str, Any]:
    try:
        # Add the 'op' field that the wrapper expects
        wrapper_payload = {"op": "compute", **payload}
        print(f"[DEBUG] Calling bridge with payload: {json.dumps(wrapper_payload, indent=2)[:500]}...")
        proc = subprocess.run(
            [BRIDGE_BIN, "--gaddag", f"{QUACKLE_LEXDIR}/{QUACKLE_LEXICON}.gaddag", "--ruleset", "en"],
            input=json.dumps(wrapper_payload).encode("utf-8"),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=8,
        )
        
        # Always log stderr for debugging - handle encoding issues
        try:
            stderr_output = proc.stderr.decode("utf-8")
        except UnicodeDecodeError:
            # Fallback to latin-1 for binary data or corrupted UTF-8
            stderr_output = proc.stderr.decode("latin-1", errors="replace")
        if stderr_output:
            print(f"[DEBUG] Bridge stderr: {stderr_output}")
        
        if proc.returncode != 0:
            print(f"[ERROR] Bridge failed with return code {proc.returncode}")
            print(f"[ERROR] Bridge stderr: {stderr_output[:2000]}")
            # Return structured error instead of raising to avoid 500
            return {
                "tiles": [],
                "score": 0,
                "words": [],
                "move_type": "pass",
                "engine_fallback": True,
                "error": f"bridge_failed_rc={proc.returncode}",
                "stderr": stderr_output[:4000]
            }
            
        out = proc.stdout.decode("utf-8").strip()
        print(f"[DEBUG] Bridge stdout: {out}")
        
        if not out:
            return {}
            
        try:
            result = json.loads(out)
            
            # Convert wrapper format to service format
            if "moves" in result and "meta" in result:
                moves = result["moves"]
                if moves:
                    # Take the first (best) move
                    best_move = moves[0]
                    # Convert positions from [row, col] arrays to {row, col} objects
                    tiles = []
                    for pos in best_move.get("positions", []):
                        if len(pos) >= 2:
                            tiles.append({
                                "row": pos[0],
                                "col": pos[1],
                                "letter": best_move.get("word", "")[len(tiles)] if len(tiles) < len(best_move.get("word", "")) else "",
                                "points": 0,  # Will be calculated by frontend
                                "isBlank": False
                            })
                    return {
                        "tiles": tiles,
                        "score": best_move.get("score", 0),
                        "words": [best_move.get("word", "")],
                        "move_type": "play",
                        "engine_fallback": False,
                        "raw_move": best_move
                    }
                else:
                    return {
                        "tiles": [],
                        "score": 0,
                        "words": [],
                        "move_type": "pass",
                        "engine_fallback": False
                    }
            else:
                # Fallback for other formats
                return result
        except json.JSONDecodeError as e:
            print(f"[ERROR] JSON decode error: {e}")
            return {
                "tiles": [],
                "score": 0,
                "words": [],
                "move_type": "pass",
                "engine_fallback": True,
                "error": f"json_decode_error: {e}"
            }
    except Exception as e:
        print(f"[ERROR] Bridge error: {repr(e)}")
        return {
            "tiles": [],
            "score": 0,
            "words": [],
            "move_type": "pass",
            "engine_fallback": True,
            "error": str(e)
        }

@app.post("/best-move")
async def best_move(req: Request):
    try:
        # Preflight: ensure lexicon assets exist to avoid segfault in the bridge
        ok, dawg, gaddag = ensure_lexicon_ready()
        if not ok:
            print(f"[lexicon] missing files: dawg={os.path.exists(dawg)} gaddag={os.path.exists(gaddag)} dir={LEX_DIR}")
            raise HTTPException(status_code=503, detail="lexicon_not_ready")

        raw = await req.body()
        print("[DEBUG] /best-move raw len:", len(raw))
        print("[DEBUG] /best-move raw head:", raw[:200])
        body = json.loads(raw.decode("utf-8"))
        print("[DEBUG] /best-move payload keys:", list(body.keys()))
        if "board" not in body or "rack" not in body:
            raise HTTPException(400, "Missing 'board' or 'rack'")

        result = _call_bridge(body)
        print("[DEBUG] Bridge result summary:", {
            'tiles_len': len(result.get('tiles', [])),
            'move_type': result.get('move_type'),
            'score': result.get('score'),
            'engine_fallback': result.get('engine_fallback')
        })
        return {
            "tiles": result.get("tiles", []),
            "score": result.get("score", 0),
            "words": result.get("words", []),
            "move_type": result.get("move_type", "place" if result.get("tiles") else "pass"),
            "engine_fallback": result.get("engine_fallback", False)
        }
    except HTTPException:
        raise
    except Exception as e:
        try:
            raw = await req.body()
            print("[ERROR] /best-move exception:", repr(e), "raw head:", raw[:200])
            raw_head = raw[:400].decode("utf-8", errors="replace")
        except Exception:
            raw_head = ""
        return {
            "tiles": [],
            "score": 0,
            "words": [],
            "move_type": "pass",
            "engine_fallback": True,
            "error": str(e),
            "raw_head": raw_head
        }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)


