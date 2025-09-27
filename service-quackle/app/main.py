import os, json, subprocess, re
from typing import Any, Dict
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi.responses import JSONResponse
import os
from pydantic import BaseModel

# --- Board normalization helpers (accept multiple shapes; output coord map 1-based) ---
def _is_coord_map(d: Dict[str, Any]) -> bool:
    if not isinstance(d, dict):
        return False
    if not d:
        return True
    for k in d.keys():
        if isinstance(k, str) and re.fullmatch(r"\d+,\d+", k):
            return True
    return False

def _grid_to_coordmap(grid: list[str]) -> Dict[str, Dict[str, Any]]:
    if not (isinstance(grid, list) and len(grid) == 15):
        raise HTTPException(status_code=400, detail="board.grid must be 15 strings of length 15")
    out: Dict[str, Dict[str, Any]] = {}
    for r, row in enumerate(grid, start=1):
        if not isinstance(row, str) or len(row) != 15:
            raise HTTPException(status_code=400, detail="board.grid must be 15 strings of length 15")
        for c, ch in enumerate(row, start=1):
            if ch != '.':
                out[f"{r},{c}"] = {"letter": str(ch).upper(), "isBlank": False}
    return out

def _squares_to_coordmap(squares: list[list[Any]]) -> Dict[str, Dict[str, Any]]:
    if not (isinstance(squares, list) and len(squares) == 15 and all(isinstance(r, list) and len(r) == 15 for r in squares)):
        raise HTTPException(status_code=400, detail="board.squares must be 15x15")
    out: Dict[str, Dict[str, Any]] = {}
    for r0 in range(15):
        for c0 in range(15):
            v = squares[r0][c0]
            if v in (None, '.', ''):
                continue
            letter = str(v).upper()[:1]
            # Treat '?' or '*' as blanks without assigned letter — skip to avoid placeholders
            if letter in ('?', '*', '.'):
                continue
            out[f"{r0+1},{c0+1}"] = {"letter": letter, "isBlank": False}
    return out

def _placements_to_coordmap(placements: list[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    out: Dict[str, Dict[str, Any]] = {}
    for p in placements:
        try:
            x = int(p.get("x"))
            y = int(p.get("y"))
            letter = str(p.get("letter", "")).strip().upper()[:1]
            is_blank = bool(p.get("is_blank") or p.get("isBlank") or False)
        except Exception:
            raise HTTPException(status_code=400, detail="malformed_board")
        if not (0 <= x < 15 and 0 <= y < 15):
            raise HTTPException(status_code=400, detail="invalid_board_coordinate")
        if not letter or letter in ('.',) or (is_blank and letter in ('?', '*', '.')):
            # Skip placeholders
            continue
        r1, c1 = y + 1, x + 1
        out[f"{r1},{c1}"] = {"letter": letter, "isBlank": is_blank}
    return out

def _sanitize_coordmap(board_in: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    out: Dict[str, Dict[str, Any]] = {}
    for k, v in board_in.items():
        if not (isinstance(k, str) and re.fullmatch(r"\d+,\d+", k)):
            # Ignore non coord keys
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
        if not letter or letter == '.' or (is_blank and letter in {'?', '*', '.'}):
            continue
        out[k] = {"letter": letter, "isBlank": is_blank}
    return out

def _normalize_board_to_coordmap(board: Any) -> Dict[str, Dict[str, Any]]:
    # Accept several forms and always return a 1-based coord map {"r,c": {letter,isBlank}}
    if isinstance(board, dict):
        b = board
        if isinstance(b.get("grid"), list):
            return _grid_to_coordmap(b.get("grid"))
        if isinstance(b.get("squares"), list):
            return _squares_to_coordmap(b.get("squares"))
        if isinstance(b.get("placements"), list):
            return _placements_to_coordmap(b.get("placements"))
        if _is_coord_map(b):
            return _sanitize_coordmap(b)
        raise HTTPException(status_code=400, detail="malformed_board")
    if isinstance(board, list):
        arr = board
        if all(isinstance(r, str) for r in arr):
            return _grid_to_coordmap(arr)  # type: ignore
        if all(isinstance(r, list) for r in arr):
            return _squares_to_coordmap(arr)  # type: ignore
        raise HTTPException(status_code=400, detail="malformed_board")
    raise HTTPException(status_code=400, detail="malformed_board")

# NOTE: This module is aligned with ENABLE defaults for consistency, but the
# running app is `quackle_service.main:app` (see Docker CMD). Keep this file
# only if you need a second app entry for local testing.

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

BRIDGE_BIN = os.getenv("QUACKLE_BRIDGE_BIN", "/usr/local/bin/quackle_bridge")
QUACKLE_LEXICON = os.getenv("QUACKLE_LEXICON", "enable1.15")
QUACKLE_LEXDIR = os.getenv("QUACKLE_LEXDIR", "/data/lexica")

# Additional envs used for preflight/diagnostics (align with Dockerfile defaults)
LEXICON_NAME = os.getenv("LEXICON_NAME", QUACKLE_LEXICON)
LEX_DIR = os.getenv("LEX_DIR", QUACKLE_LEXDIR)
APPDATA_DIR = os.getenv("QUACKLE_APPDATA_DIR", "/usr/share/quackle/data")

def _lex_paths():
    dawg = os.path.join(LEX_DIR, f"{LEXICON_NAME}.dawg")
    gaddag = os.path.join(LEX_DIR, f"{LEXICON_NAME}.gaddag")
    return dawg, gaddag

def ensure_lexicon_ready():
    dawg, gaddag = _lex_paths()
    ok = os.path.isfile(dawg) and os.path.isfile(gaddag)
    return ok, dawg, gaddag

class BestMoveRequest(BaseModel):
    board: Dict[str, Any]
    rack: Any
    difficulty: str

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

@app.post("/debug/echo")
async def debug_echo(request: Request):
    raw = await request.body()
    try:
        parsed = await request.json()
    except Exception:
        parsed = None
    return {"raw_body": raw.decode(errors="replace"), "parsed_json": parsed}

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
    return {
        "lexicon_name": LEXICON_NAME,
        "lex_dir": LEX_DIR,
        "app_data_dir": APPDATA_DIR,
        "dawg_exists": exists(dawg),
        "gaddag_exists": exists(gaddag),
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

@app.post("/debug/generate_gaddag")
def debug_generate_gaddag(lex: str | None = None):
    """Generate GADDAG for current (or provided) lexicon and return stdout/stderr and file size."""
    try:
        target_lex = (lex or QUACKLE_LEXICON).strip()
        lexdir = QUACKLE_LEXDIR
        dawg = os.path.join(lexdir, f"{target_lex}.dawg")
        gaddag = os.path.join(lexdir, f"{target_lex}.gaddag")
        if not os.path.exists(dawg):
            return {"ok": False, "error": f"dawg not found: {dawg}", "lex": target_lex}
        mk = "/usr/local/bin/makegaddag"
        if not os.path.exists(mk):
            return {"ok": False, "error": "makegaddag not found", "path": mk}
        proc = subprocess.run([mk, dawg, gaddag], cwd=lexdir, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=90)
        size = os.path.getsize(gaddag) if os.path.exists(gaddag) else None
        return {
            "ok": proc.returncode == 0 and size not in (None, 0),
            "rc": proc.returncode,
            "stdout": proc.stdout.decode("utf-8", "ignore")[-1000:],
            "stderr": proc.stderr.decode("utf-8", "ignore")[-1000:],
            "gaddag": {"path": gaddag, "size": size},
            "lex": target_lex,
        }
    except Exception as e:
        return {"ok": False, "error": str(e)}

def _call_bridge(payload: Dict[str, Any]) -> Dict[str, Any]:
    try:
        payload_json = json.dumps(payload).encode("utf-8")
        print(f"[CURSOR_DEBUG] Input inviato al bridge C++: {payload_json.decode('utf-8')}")
        print(f"[DEBUG] Calling bridge with payload: {json.dumps(payload, indent=2)[:500]}...")
        proc = subprocess.run(
            [BRIDGE_BIN, "--lexicon", QUACKLE_LEXICON, "--lexdir", QUACKLE_LEXDIR],
            input=payload_json,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=30,
        )
        
        # Always log stderr for debugging
        stderr_output = proc.stderr.decode("utf-8")
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
        return json.loads(out) if out else {}
    except subprocess.TimeoutExpired as e:
        print(f"[ERROR] Bridge timed out: {repr(e)}")
        return {
            "tiles": [],
            "score": 0,
            "words": [],
            "move_type": "pass",
            "engine_fallback": True,
            "error": f"bridge_timeout: {e}"
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
async def best_move(req_model: BestMoveRequest):
    try:
        body_dict = req_model.dict()
        print(f"[CURSOR_DEBUG] Payload ricevuto dal frontend: {json.dumps(body_dict, indent=2)}")
        
        # Preflight: ensure lexicon assets exist to avoid segfault in the bridge
        ok, dawg, gaddag = ensure_lexicon_ready()
        if not ok:
            print(f"[lexicon] missing files: dawg={os.path.exists(dawg)} gaddag={os.path.exists(gaddag)} dir={LEX_DIR}")
            raise HTTPException(status_code=503, detail="lexicon_not_ready")

        # Normalize board to 1-based coord map accepted by the bridge
        board_map: Dict[str, Any] = _normalize_board_to_coordmap(req_model.board)
        print(f"[CURSOR_DEBUG] board keys normalized (count={len(board_map)}): {list(board_map.keys())[:5]}")
        body = {
            "board": board_map,
            "rack": req_model.rack,
            "difficulty": req_model.difficulty,
        }
        print("[DEBUG] /best-move payload keys:", list(body.keys()))
        result = _call_bridge(body)
        print("[DEBUG] Bridge result summary:", {
            'tiles_len': len(result.get('tiles', [])),
            'move_type': result.get('move_type'),
            'score': result.get('score'),
            'engine_fallback': result.get('engine_fallback')
        })
        # Normalize all tile coordinates to 0-based before responding
        tiles_out = result.get("tiles", [])
        def _to_zero_based(t: dict) -> dict:
            try:
                r = int(t.get("row")); c = int(t.get("col"))
            except Exception:
                return t
            return {**t, "row": r - 1, "col": c - 1}
        tiles_out = [_to_zero_based(t) for t in tiles_out]

        return {
            "tiles": tiles_out,
            "score": result.get("score", 0),
            "words": result.get("words", []),
            "move_type": result.get("move_type", "place" if result.get("tiles") else "pass"),
            "engine_fallback": result.get("engine_fallback", False)
        }
    except HTTPException:
        raise
    except Exception as e:
        return {
            "tiles": [],
            "score": 0,
            "words": [],
            "move_type": "pass",
            "engine_fallback": True,
            "error": str(e)
        }
