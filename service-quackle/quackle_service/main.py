import os, json, subprocess, sys, re
from typing import Any, Dict, Optional, List, Tuple
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import logging

# Configure logging to stderr
logging.basicConfig(stream=sys.stderr, level=logging.INFO, format='[%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

# Pydantic models
class BoardCell(BaseModel):
    letter: str
    isBlank: bool = False

class BestMoveRequest(BaseModel):
    # Loosen schema to accept multiple board formats (object, grid, squares, placements)
    board: Any
    # Rack can be a string or list; we will normalize to string
    rack: Any
    difficulty: Optional[str] = None

ENV_MODE = os.getenv("ENV", "").lower()
_origins_raw = os.getenv("CORS_ORIGINS", "").strip()

# Default origins for development
default_dev_origins = [
    "http://localhost:3000",
    "http://localhost:5173", 
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "http://localhost:8080",
    "http://127.0.0.1:8080"
]

if not _origins_raw and ENV_MODE in ("dev", "development"):
    ALLOW_ORIGINS = ["*"]
elif not _origins_raw:
    # If no CORS_ORIGINS is set, use default dev origins
    ALLOW_ORIGINS = default_dev_origins
else:
    # Parse configured origins and add dev origins if in dev mode
    configured_origins = [o.strip() for o in _origins_raw.split(",") if o.strip()]
    if ENV_MODE in ("dev", "development"):
        ALLOW_ORIGINS = list(set(configured_origins + default_dev_origins))
    else:
        ALLOW_ORIGINS = configured_origins

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOW_ORIGINS or [],
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

BRIDGE_BIN = os.getenv("QUACKLE_BRIDGE_BIN", os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "bridge", "engine_wrapper"))).strip()
QUACKLE_LEXICON = os.getenv("QUACKLE_LEXICON", "enable1").strip()
QUACKLE_LEXDIR = os.getenv("QUACKLE_LEXDIR", "/usr/share/quackle/lexica").strip()
DEBUG_ENABLE_LDD = os.getenv("DEBUG_ENABLE_LDD", "").strip().lower() in {"1", "true", "yes", "y", "on", "dev"}
BRIDGE_TIMEOUT_MS = int(os.getenv("QUACKLE_TIMEOUT_MS", "8000"))

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
    try:
        ok = (os.path.isfile(dawg) and os.path.getsize(dawg) > 0 and
              os.path.isfile(gaddag) and os.path.getsize(gaddag) > 0)
    except Exception:
        ok = False
    return ok, dawg, gaddag

# --------------------------
# Input normalization helpers
# --------------------------

def _letter_points_en(letter: str) -> int:
    L = letter.upper()[:1] if letter else ""
    if L in {"A","E","I","L","N","O","R","S","T","U"}: return 1
    if L in {"D","G"}: return 2
    if L in {"B","C","M","P"}: return 3
    if L in {"F","H","V","W","Y"}: return 4
    if L == "K": return 5
    if L in {"J","X"}: return 8
    if L in {"Q","Z"}: return 10
    if L in {"?","*"}: return 0
    return 1

def normalize_rack(raw: Any) -> str:
    """Accepts a string or list of characters/tiles and normalizes to 7-char uppercase string.
    Allowed characters: A-Z and blanks '?','*'. Spaces are ignored.
    Errors:
      - invalid_rack_format
      - rack_must_be_7_chars
    """
    # Accept list of chars or list of objects with 'letter'
    if isinstance(raw, list):
        # If array of tile dicts, join their 'letter'
        try:
            # Prefer extracting 'letter' if elements are dicts
            parts: List[str] = []
            for el in raw:
                if isinstance(el, dict) and "letter" in el:
                    parts.append(str(el["letter"]))
                else:
                    parts.append(str(el))
            raw = ''.join(parts)
        except Exception:
            raw = ''.join([str(x) for x in raw])
    # Fall back to string casting
    raw = str(raw) if raw is not None else ""
    raw = raw.replace(" ", "").upper()

    if not re.fullmatch(r"[A-Z\?\*]{1,7}", raw):
        raise HTTPException(status_code=400, detail="invalid_rack_format")
    if len(raw) != 7:
        raise HTTPException(status_code=400, detail="rack_must_be_7_chars")
    return raw

def _is_coord_map(d: Dict[str, Any]) -> bool:
    if not isinstance(d, dict):
        return False
    if not d:
        return True  # empty board map is valid
    # Heuristic: any key like "<int>,<int>"
    for k in d.keys():
        if isinstance(k, str) and re.fullmatch(r"\d+,\d+", k):
            return True
    return False

def _squares_from_coord_map(coord_map: Dict[str, Any], rows: int, cols: int) -> List[List[Optional[str]]]:
    squares: List[List[Optional[str]]] = [[None for _ in range(cols)] for _ in range(rows)]
    for k, v in coord_map.items():
        if not isinstance(k, str) or not re.fullmatch(r"\d+,\d+", k):
            raise HTTPException(status_code=400, detail="malformed_board")
        r_str, c_str = k.split(',')
        # Bridge expects 1-based; accept both but clamp/validate later; here we convert to 0-based indices
        try:
            r1 = int(r_str)
            c1 = int(c_str)
        except Exception:
            raise HTTPException(status_code=400, detail="malformed_board")
        # Convert 1-based to 0-based, but if clients sent 0-based, these will be -1 which is invalid later
        r0 = r1 - 1
        c0 = c1 - 1
        if not (0 <= r0 < rows and 0 <= c0 < cols):
            # Try interpreting as 0-based if clearly in 0..14 and 1-based check failed
            if 0 <= r1 < rows and 0 <= c1 < cols:
                r0, c0 = r1, c1
            else:
                raise HTTPException(status_code=400, detail="invalid_board_coordinate")
        letter = None
        is_blank = False
        if isinstance(v, dict):
            letter = str(v.get("letter", "")).upper()
            is_blank = bool(v.get("isBlank") or v.get("is_blank") or False)
        else:
            letter = str(v).upper()
        if not letter or letter == ".":
            continue
        squares[r0][c0] = "?" if is_blank or letter in ("?", "*") else letter[:1]
    return squares

def normalize_board(board_in: Any) -> Tuple[int, int, int, int, List[List[Optional[str]]], Dict[str, Dict[str, Any]]]:
    """Normalizes different input shapes into a 15x15 squares matrix and a bridge-ready coord map.
    Returns: (rows, cols, center_x, center_y, squares, board_map_for_bridge)
    - All indices in 'squares' are 0-based (squares[row][col]).
    - Board map for bridge uses 1-based string keys "row,col" and includes {letter,isBlank,points}.
    - Orientation: (x,y) = (col,row) with 0-based input; we convert internally to [row][col].
    Errors:
      - invalid_board_coordinate
      - malformed_board_grid_size / malformed_board_squares_size
      - malformed_board
    """
    # Defaults
    rows = 15
    cols = 15
    cx = 7
    cy = 7

    # Handle naked arrays as board (grid or squares)
    if isinstance(board_in, list):
        arr = board_in
        # Try grid (list of strings)
        if all(isinstance(r, str) for r in arr):
            grid: List[str] = arr  # type: ignore
            if len(grid) != rows or any(len(r) != cols for r in grid):
                raise HTTPException(status_code=400, detail="malformed_board_grid_size")
            squares = [[None if ch == '.' else ('?' if ch in ('?','*') else ch.upper()) for ch in row] for row in grid]
        # Try 2D squares
        elif all(isinstance(r, list) for r in arr):
            sq: List[List[Optional[str]]] = arr  # type: ignore
            if len(sq) != rows or any(len(r) != cols for r in sq):
                raise HTTPException(status_code=400, detail="malformed_board_squares_size")
            squares = [[None if cell in (None, '.', '') else (str(cell).upper()[:1]) for cell in r] for r in sq]
        else:
            # Unknown list shape
            raise HTTPException(status_code=400, detail="malformed_board")
    elif isinstance(board_in, dict):
        b = board_in or {}
        # Read dimensions and center if present
        try:
            rows = int(b.get("rows", 15))
            cols = int(b.get("cols", 15))
            cx = int(b.get("center_x", 7))
            cy = int(b.get("center_y", 7))
        except Exception:
            raise HTTPException(status_code=400, detail="malformed_board")
        if not (0 <= cx < cols and 0 <= cy < rows):
            raise HTTPException(status_code=400, detail="invalid_board_coordinate")

        if isinstance(b.get("grid"), list):
            grid = b["grid"]
            if len(grid) != rows or any(len(r) != cols for r in grid):
                raise HTTPException(status_code=400, detail="malformed_board_grid_size")
            squares = [[None if ch == '.' else ('?' if ch in ('?','*') else str(ch).upper()[:1]) for ch in row] for row in grid]
        elif isinstance(b.get("squares"), list):
            squares = b["squares"]
            if len(squares) != rows or any(len(r) != cols for r in squares):
                raise HTTPException(status_code=400, detail="malformed_board_squares_size")
            squares = [[None if cell in (None, '.', '') else str(cell).upper()[:1] for cell in r] for r in squares]
        elif isinstance(b.get("placements"), list):
            squares = [[None for _ in range(cols)] for _ in range(rows)]
            for p in b["placements"]:
                try:
                    x = int(p["x"])
                    y = int(p["y"])
                    letter = str(p.get("letter", "")).upper()[:1]
                    is_blank = bool(p.get("is_blank") or p.get("isBlank") or False)
                except Exception:
                    raise HTTPException(status_code=400, detail="malformed_board")
                if not (0 <= x < cols and 0 <= y < rows):
                    raise HTTPException(status_code=400, detail="invalid_board_coordinate")
                squares[y][x] = "?" if is_blank or letter in ("?","*") else letter
        elif _is_coord_map(b):
            # Backwards compatibility: already a coordinate map (likely 1-based keys)
            squares = _squares_from_coord_map(b, rows, cols)
        else:
            # Do not silently fallback — invalid shape
            raise HTTPException(status_code=400, detail="malformed_board")
    else:
        # Not a supported type
        raise HTTPException(status_code=400, detail="malformed_board")

    # Convert to bridge board map: only non-empty squares, keys as 1-based "row,col"
    board_map: Dict[str, Dict[str, Any]] = {}
    for r in range(rows):
        for c in range(cols):
            v = squares[r][c]
            if v is None or v == '.' or v == '':
                continue
            is_blank = (v in ('?','*'))
            letter = '?' if is_blank else str(v).upper()[:1]
            key = f"{r+1},{c+1}"
            board_map[key] = {
                "letter": letter,
                "isBlank": is_blank,
                "points": _letter_points_en(letter)
            }

    return rows, cols, cx, cy, squares, board_map

@app.get("/health")
def health():
    ok, dawg, gaddag = ensure_lexicon_ready()
    appdata = APPDATA_DIR
    strat_en = os.path.join(appdata, "strategy", "default_english")
    strat_def = os.path.join(appdata, "strategy", "default")
    def exists(p):
        return os.path.isfile(p)
    def size_or_zero(p):
        try:
            return os.path.getsize(p)
        except Exception:
            return 0
    # Try to count words if a wordlist is available
    lex_words_path = os.getenv("QUACKLE_WORDLIST", os.path.join(LEX_DIR, f"{LEXICON_NAME}.txt"))
    word_count = None
    try:
        if os.path.isfile(lex_words_path):
            with open(lex_words_path, 'r', encoding='utf-8', errors='ignore') as f:
                word_count = sum(1 for _ in f)
    except Exception:
        word_count = None
    engine_ready = (os.path.exists(BRIDGE_BIN) and os.access(BRIDGE_BIN, os.X_OK)
                    and ok)
    return {
        "status": "ok",
        "engine": "quackle-bridge",
        "engine_ready": engine_ready,
        "bridge_path": BRIDGE_BIN,
        "timeout_ms": BRIDGE_TIMEOUT_MS,
        "lexicon": QUACKLE_LEXICON,
        "lexdir": QUACKLE_LEXDIR,
        "dawg_exists": os.path.isfile(dawg),
        "gaddag_exists": os.path.isfile(gaddag),
        "dawg_size": size_or_zero(dawg),
        "gaddag_size": size_or_zero(gaddag),
        "word_count": word_count,
        "strategy": {
            "syn2": exists(os.path.join(strat_en, "syn2")),
            "vcplace": exists(os.path.join(strat_en, "vcplace")),
            "superleaves": exists(os.path.join(strat_en, "superleaves")),
            "worths": exists(os.path.join(strat_en, "worths")),
            "bogowin": exists(os.path.join(strat_def, "bogowin")),
        },
        "version": "v104-strict"
    }

@app.get("/healthz")
def healthz():
    """Railway healthcheck endpoint"""
    return {"ok": True}

@app.get("/health/cors")
def health_cors():
    return {"allow_origins": ALLOW_ORIGINS}

@app.get("/debug/config")
async def debug_config():
    """Debug endpoint to return configuration"""
    return {
        "cors_origins": ALLOW_ORIGINS,
        "env_mode": ENV_MODE,
        "cors_origins_raw": _origins_raw,
        "quackle_lexicon": os.getenv("QUACKLE_LEXICON", ""),
        "quackle_lexdir": os.getenv("QUACKLE_LEXDIR", ""),
        "lexicon_name": os.getenv("LEXICON_NAME", ""),
        "lex_dir": os.getenv("LEX_DIR", "")
    }
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

@app.get("/debug/ldd")
def debug_ldd():
    """Returns ldd output for the bridge binary. Disabled unless DEBUG_ENABLE_LDD is set.
    Output is truncated to 4000 chars for safety.
    """
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
        info.update({
            "returncode": proc.returncode,
            "output": out[:4000]
        })
    except Exception as e:
        info.update({
            "error": str(e)
        })
    return info

@app.post("/debug/probe")
async def debug_probe(request: Request):
    """Debug endpoint to analyze a game state without executing a full turn
    Accepts same payload as /best-move. Normalizes input and returns quick diagnostics.
    """
    try:
        raw = await request.body()
        body = json.loads(raw.decode("utf-8")) if raw else {}
        rack_norm = normalize_rack(body.get("rack"))
        rows, cols, cx, cy, squares, board_map = normalize_board(body.get("board"))
        non_empty = any(any(cell is not None for cell in row) for row in squares)
        center_anchor_ok = (rows == 15 and cols == 15 and cx == 7 and cy == 7)
        logger.debug("board_norm rows=%s cols=%s center=(%s,%s) non_empty=%s", rows, cols, cx, cy, non_empty)

        # Optionally call the bridge to ensure it's reachable and to surface errors; not mandatory for probe
        payload = {
            "board": board_map,
            "rack": rack_norm,
            "difficulty": body.get("difficulty")
        }
        result = _call_bridge(payload)

        return {
            "took_ms": result.get("time_ms", 0),
            "timeout_hit": False,
            "board_empty": not non_empty,
            "center_anchor_ok": center_anchor_ok,
            "generated_count": len(result.get("moves", [])),
            "legal_count": len([m for m in result.get("moves", []) if m.get("score", 0) > 0]),
            "top_5_moves": result.get("moves", [])[:5] if isinstance(result.get("moves"), list) else []
        }

    except HTTPException as e:
        return JSONResponse({"engine_fallback": True, "error": e.detail}, status_code=e.status_code)
    except Exception as e:
        logger.error(f"Debug probe failed: {e}")
        return {"error": str(e), "took_ms": 0, "timeout_hit": False, "board_empty": False,
                "center_anchor_ok": False, "generated_count": 0, "legal_count": 0, "top_5_moves": []}

@app.get("/health/lexicon")
def health_lexicon():
    ok, dawg, gaddag = ensure_lexicon_ready()
    status = 200 if ok else 503
    body = {
        "lexicon_name": LEXICON_NAME,
        "lex_dir": LEX_DIR,
        "lexicon_ok": ok,
        "dawg_path": dawg,
        "gaddag_path": gaddag,
    }
    return JSONResponse(body, status_code=status)

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
    print(f"[startup] Bridge binary: {BRIDGE_BIN}")
    print(f"[startup] Bridge exists: {os.path.exists(BRIDGE_BIN)}")
    print(f"[startup] Bridge executable: {os.access(BRIDGE_BIN, os.X_OK) if os.path.exists(BRIDGE_BIN) else False}")
    
    ok, dawg, gaddag = ensure_lexicon_ready()
    print(f"[startup] DAWG present? {os.path.isfile(dawg)} path={dawg}")
    print(f"[startup] GADDAG present? {os.path.isfile(gaddag)} path={gaddag}")
    
    if not ok:
        print(f"[startup] ERROR: Lexicon files missing!")
        print(f"[startup] Expected DAWG: {dawg}")
        print(f"[startup] Expected GADDAG: {gaddag}")
        print(f"[startup] LexDir exists: {os.path.exists(LEX_DIR)}")
        if os.path.exists(LEX_DIR):
            print(f"[startup] LexDir contents: {os.listdir(LEX_DIR)}")
    else:
        print(f"[startup] SUCCESS: All lexicon files found and ready!")

def _call_bridge(payload: Dict[str, Any]) -> Dict[str, Any]:
    try:
        # Add the 'op' field that the wrapper expects
        wrapper_payload = {"op": "compute", **payload}
        print(f"[DEBUG] Calling bridge with payload: {json.dumps(wrapper_payload, indent=2)[:500]}...")
        try:
            proc = subprocess.run(
                [
                    BRIDGE_BIN,
                    "--lexicon", QUACKLE_LEXICON,
                    "--lexdir", QUACKLE_LEXDIR,
                    "--gaddag", f"{QUACKLE_LEXDIR}/{QUACKLE_LEXICON}.gaddag",
                    "--ruleset", "en"
                ],
                input=json.dumps(wrapper_payload).encode("utf-8"),
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                timeout=max(1, BRIDGE_TIMEOUT_MS // 1000),
            )
        except OSError as e:
            # Likely missing runtime dep (e.g., dynamic linker or libasan)
            print(f"[ERROR] Exec failed: {repr(e)}")
            ldd_out = ""
            try:
                ldd = subprocess.run(["ldd", BRIDGE_BIN], capture_output=True, text=True, timeout=3)
                ldd_out = (ldd.stdout or "") + ("\n" + (ldd.stderr or "")).strip()
                print("[DEBUG] ldd bridge output:\n" + ldd_out)
            except Exception as _:
                pass
            return {
                "tiles": [],
                "score": 0,
                "words": [],
                "move_type": "pass",
                "engine_fallback": True,
                "error": f"exec_failed: {e.strerror or str(e)}",
                "ldd": ldd_out[:4000]
            }
        
        # Always log stderr for debugging - handle encoding issues
        try:
            stderr_output = proc.stderr.decode("utf-8")
        except UnicodeDecodeError:
            # Fallback to latin-1 for binary data or corrupted UTF-8
            stderr_output = proc.stderr.decode("latin-1", errors="replace")
        if stderr_output:
            print(f"[DEBUG] Bridge stderr: {stderr_output}")
        
        if proc.returncode != 0:
            logger.error(f"Bridge failed with return code {proc.returncode}")
            logger.error(f"stderr: {stderr_output[:2000]}")
            # Try to parse stdout for a structured error message from the bridge
            out_try = proc.stdout.decode("utf-8", errors="replace").strip()
            try:
                parsed = json.loads(out_try) if out_try else {}
            except Exception:
                parsed = {}
            if isinstance(parsed, dict) and parsed.get("engine_fallback"):
                return parsed
            # Return structured error instead of raising to avoid 500
            return {
                "tiles": [],
                "score": 0,
                "words": [],
                "move_type": "pass",
                "engine_fallback": True,
                "error": f"bridge_failed_rc={proc.returncode}",
                "rc": proc.returncode,
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
        raw = await req.body()
        print("[DEBUG] /best-move raw len:", len(raw))
        print("[DEBUG] /best-move raw head:", raw[:200])
        body = json.loads(raw.decode("utf-8"))
        print("[DEBUG] /best-move payload keys:", list(body.keys()))
        if "rack" not in body:
            raise HTTPException(status_code=400, detail="invalid_rack_format")

        # Normalize inputs
        rack_norm = normalize_rack(body.get("rack"))
        rows, cols, cx, cy, squares, board_map = normalize_board(body.get("board"))
        non_empty = any(any(cell is not None for cell in row) for row in squares)
        logger.debug("rack_norm=%s (len=%s)", rack_norm, len(rack_norm))
        logger.debug("board_norm rows=%s cols=%s center=(%s,%s) non_empty=%s", rows, cols, cx, cy, non_empty)
        print(f"[DEBUG] rack_norm len={len(rack_norm)} rack='{rack_norm}'")
        print(f"[DEBUG] board_norm rows={rows} cols={cols} center=({cx},{cy}) non_empty={non_empty}")

        # Preflight: ensure lexicon assets exist and >0 to avoid segfault in the bridge
        ok, dawg, gaddag = ensure_lexicon_ready()
        if not ok:
            print(f"[lexicon] missing files: dawg={os.path.exists(dawg)} gaddag={os.path.exists(gaddag)} dir={LEX_DIR}")
            raise HTTPException(status_code=500, detail="lexicon_not_ready")

        # Build bridge payload from normalized inputs
        payload = {
            "board": board_map,
            "rack": rack_norm,
            "difficulty": body.get("difficulty"),
        }

        # Call bridge
        result = _call_bridge(payload)
        print("[DEBUG] Bridge result summary:", {
            'tiles_len': len(result.get('tiles', [])),
            'move_type': result.get('move_type'),
            'score': result.get('score'),
            'engine_fallback': result.get('engine_fallback')
        })
        # If the bridge signaled fallback or returned an explicit error key, convert to HTTP error
        if result.get("engine_fallback") or (isinstance(result, dict) and result.get("error")):
            err = (result.get("error") or "engine_error")
            status = 500
            if err in {"invalid_board_coordinate", "malformed_coordinate", "rack_empty", "invalid_rack_format", "malformed_board"}:
                status = 400
            elif err.startswith("exec_failed") or err.startswith("bridge_failed_rc"):
                status = 502
            body = {k: v for k, v in result.items() if k in {"engine_fallback", "error", "stderr", "ldd", "rc"}}
            return JSONResponse(body or {"engine_fallback": True, "error": err}, status_code=status)

        # Success path
        return {
            "tiles": result.get("tiles", []),
            "score": result.get("score", 0),
            "words": result.get("words", []),
            "move_type": result.get("move_type", "play" if result.get("tiles") else "pass"),
            "engine_fallback": False
        }
    except HTTPException as e:
        # Return uniform error envelope for input errors
        return JSONResponse({"engine_fallback": True, "error": e.detail}, status_code=e.status_code)
    except Exception as e:
        try:
            raw = await req.body()
            print("[ERROR] /best-move exception:", repr(e), "raw head:", raw[:200])
            raw_head = raw[:400].decode("utf-8", errors="replace")
        except Exception:
            raw_head = ""
        return JSONResponse({
            "engine_fallback": True,
            "error": str(e),
            "raw_head": raw_head
        }, status_code=500)

@app.get("/debug/sample-moves")
def debug_sample_moves():
    """Runs three sample scenarios and reports whether a non-pass move was produced.
    No silent fallbacks: errors are reported explicitly.
    """
    cases = []
    # Case 1: Empty board + AEIRSTZ
    try:
        rows, cols, cx, cy, squares, board_map = normalize_board({
            "rows": 15, "cols": 15, "center_x": 7, "center_y": 7,
            "grid": ["."*15 for _ in range(15)]
        })
        res = _call_bridge({"board": board_map, "rack": "AEIRSTZ", "difficulty": "medium"})
        cases.append({
            "name": "empty+AEIRSTZ",
            "ok": (not res.get("engine_fallback") and res.get("move_type") != "pass"),
            "res": res if res.get("engine_fallback") else {"move_type": res.get("move_type"), "score": res.get("score")}
        })
    except Exception as e:
        cases.append({"name": "empty+AEIRSTZ", "ok": False, "error": str(e)})

    # Case 2: Center occupied + HELLO??
    try:
        grid = ["."*15 for _ in range(15)]
        grid[7] = ".......A......."
        rows, cols, cx, cy, squares, board_map = normalize_board({
            "rows": 15, "cols": 15, "center_x": 7, "center_y": 7, "grid": grid
        })
        res = _call_bridge({"board": board_map, "rack": "HELLO??", "difficulty": "medium"})
        cases.append({
            "name": "centerA+HELLO??",
            "ok": (not res.get("engine_fallback") and res.get("move_type") != "pass"),
            "res": res if res.get("engine_fallback") else {"move_type": res.get("move_type"), "score": res.get("score")}
        })
    except Exception as e:
        cases.append({"name": "centerA+HELLO??", "ok": False, "error": str(e)})

    # Case 3: Legacy B format (15 strings grid)
    try:
        rows, cols, cx, cy, squares, board_map = normalize_board(["."*15 for _ in range(15)])
        res = _call_bridge({"board": board_map, "rack": "AEIRSTZ", "difficulty": "medium"})
        cases.append({
            "name": "legacyB+AEIRSTZ",
            "ok": (not res.get("engine_fallback") and res.get("move_type") != "pass"),
            "res": res if res.get("engine_fallback") else {"move_type": res.get("move_type"), "score": res.get("score")}
        })
    except Exception as e:
        cases.append({"name": "legacyB+AEIRSTZ", "ok": False, "error": str(e)})

    return {"cases": cases}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
