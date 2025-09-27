import os, json, subprocess, sys, re
import hashlib
import shutil
from typing import Any, Dict, Optional, List, Tuple
from pathlib import Path
from contextlib import asynccontextmanager
from urllib.request import urlopen
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import logging
from .lib.rack import normalize_rack_flexible as _rack_pure_normalize
from .lib.encoding import (
    is_coord_map as _is_coord_map_pure,
    squares_from_coord_map as _squares_from_coord_map_pure,
    coord_map_from_grid as _coord_map_from_grid_pure,
)
from .lib.timeouts import to_subprocess_timeout_s

# Configure logging to stderr
logging.basicConfig(stream=sys.stderr, level=logging.INFO, format='[%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

# ------------------------------
# Sanitization helpers
# ------------------------------
def _sanitize_none(obj):
    if isinstance(obj, dict):
        return {k: _sanitize_none(v) for k, v in obj.items() if v is not None}
    if isinstance(obj, list):
        return [_sanitize_none(v) for v in obj]
    return obj

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

# ------------------------------
# Tile distribution (English default) and helpers
# ------------------------------

def _english_tile_distribution() -> Dict[str, int]:
    """Standard English Scrabble tile counts (100 tiles including 2 blanks).
    Keys are A-Z plus '?' for blanks.
    """
    return {
        'A': 9, 'B': 2, 'C': 2, 'D': 4, 'E': 12, 'F': 2, 'G': 3, 'H': 2, 'I': 9,
        'J': 1, 'K': 1, 'L': 4, 'M': 2, 'N': 6, 'O': 8, 'P': 2, 'Q': 1, 'R': 6,
        'S': 4, 'T': 6, 'U': 4, 'V': 2, 'W': 2, 'X': 1, 'Y': 2, 'Z': 1, '?': 2
    }

def _merge_distribution_override(base: Dict[str, int], override: Optional[Dict[str, Any]]) -> Dict[str, int]:
    """Merge an optional override distribution into the base.
    Only keys 'A'-'Z' and '?' are considered; values coerced to non-negative ints.
    """
    if not isinstance(override, dict):
        return dict(base)
    out = dict(base)
    for k, v in override.items():
        if not isinstance(k, str) or len(k) != 1:
            continue
        K = k.upper()
        if K == '*' or K == '.':
            K = '?'
        if re.fullmatch(r"[A-Z\?]", K) is None:
            continue
        try:
            n = int(v)
        except Exception:
            continue
        out[K] = max(0, n)
    return out

def _count_unseen(grid: List[str], rack: str, dist: Dict[str, int]) -> Tuple[int, Dict[str, int]]:
    """Return (remaining_total, remaining_by_letter) given a 15x15 grid and a 7-char rack.
    Grid uses '.' for empty and '?' for blanks; letters are A-Z.
    Rack can include '?' or '*' for blanks.
    """
    remain: Dict[str, int] = {k: int(v) for k, v in dist.items()}

    # Subtract board letters and blanks
    for row in grid:
        if not isinstance(row, str):
            continue
        for ch in row:
            if ch == '.':
                continue
            if ch in {'?', '*'}:
                remain['?'] = max(0, remain.get('?', 0) - 1)
            else:
                L = str(ch).upper()[:1]
                if re.fullmatch(r"[A-Z]", L):
                    remain[L] = max(0, remain.get(L, 0) - 1)

    # Subtract rack tiles
    for ch in str(rack or '').upper():
        K = '?' if ch in {'?', '*'} else ch
        if re.fullmatch(r"[A-Z\?]", K):
            remain[K] = max(0, remain.get(K, 0) - 1)

    total_left = sum(remain.values())
    return total_left, remain

ENV_MODE = os.getenv("ENV", "").lower()
SKIP_LEXICON_CHECK = os.getenv("QUACKLE_SKIP_LEXICON_CHECK", "").strip().lower() in {"1","true","yes","on"}
# CORS from env (comma-separated) → list
ALLOW_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]

# ------------------------------
# Runtime configuration (volume-first)
# ------------------------------
LEXICON_NAME = os.getenv("LEXICON_NAME", os.getenv("QUACKLE_LEXICON", "enable1.15").strip()).strip()
LEXDIR = os.getenv("QUACKLE_LEXDIR", "/data/lexica").strip()
APPDATA = os.getenv("QUACKLE_APPDATA_DIR", "/data/appdata").strip()
TIMEOUT_MS = int(os.getenv("QUACKLE_TIMEOUT_MS", "8000"))

BRIDGE_BIN = os.getenv(
    "QUACKLE_BRIDGE_BIN",
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "bridge", "engine_wrapper"))
).strip()
QUACKLE_LEXICON = LEXICON_NAME
QUACKLE_LEXDIR = LEXDIR
DEBUG_ENABLE_LDD = os.getenv("DEBUG_ENABLE_LDD", "").strip().lower() in {"1", "true", "yes", "y", "on", "dev"}
BRIDGE_TIMEOUT_MS = TIMEOUT_MS

# Track startup status for diagnostics
STARTUP_STATUS: Dict[str, Any] = {
    "lexicon_ok": False,
    "gaddag_path": "",
    "dawg_path": "",
    "gaddag_size": 0,
    "dawg_size": 0,
    "errors": [],
    "strategy": {}
}

def _lex_paths():
    base = os.path.normpath(LEXDIR)
    dawg = os.path.join(base, f"{LEXICON_NAME}.dawg")
    gaddag = os.path.join(base, f"{LEXICON_NAME}.gaddag")
    return dawg, gaddag

def ensure_lexicon_ready():
    """Evaluate lexicon existence using current environment variables at call time.
    Returns (ok, dawg_path, gaddag_path).
    """
    # Read dynamic env each time to support tests that monkeypatch env per request
    lexicon_name = os.getenv("LEXICON_NAME", os.getenv("QUACKLE_LEXICON", "enable1.15").strip()).strip()
    lexdir = os.getenv("QUACKLE_LEXDIR", "/data/lexica").strip()
    skip = os.getenv("QUACKLE_SKIP_LEXICON_CHECK", "").strip().lower() in {"1","true","yes","on"}
    base = os.path.normpath(lexdir)
    dawg = os.path.join(base, f"{lexicon_name}.dawg")
    gaddag = os.path.join(base, f"{lexicon_name}.gaddag")
    try:
        ok = (os.path.isfile(dawg) and os.path.getsize(dawg) > 0 and
              os.path.isfile(gaddag) and os.path.getsize(gaddag) > 0)
    except Exception:
        ok = False
    # In non-prod environments OR when explicitly skipped, allow running without files
    if not ok and (skip or (ENV_MODE and ENV_MODE.lower() in {"test", "dev", "development"})):
        return True, dawg, gaddag
    return ok, dawg, gaddag

def _download_to(url: str, dest: Path, timeout: int = 60) -> Tuple[bool, Optional[str]]:
    try:
        tmp = dest.with_suffix(dest.suffix + ".part")
        tmp.parent.mkdir(parents=True, exist_ok=True)
        with urlopen(url, timeout=timeout) as r, open(tmp, "wb") as f:
            chunk = r.read(8192)
            while chunk:
                f.write(chunk)
                chunk = r.read(8192)
        tmp.replace(dest)
        return True, None
    except Exception as e:
        return False, str(e)

def _ensure_lexicon_files() -> Dict[str, Any]:
    """Optionally download lexicon files if URLs provided; validate sizes > 0.
    Returns a dict with paths, sizes, and ok flag.
    """
    gaddag_url = os.getenv("GADDAG_URL", "").strip()
    dawg_url = os.getenv("DAWG_URL", "").strip()
    dawg_path_str, gaddag_path_str = _lex_paths()
    dawg_p = Path(dawg_path_str)
    gaddag_p = Path(gaddag_path_str)
    errs: List[str] = []

    # Ensure directories exist
    Path(LEXDIR).mkdir(parents=True, exist_ok=True)
    Path(APPDATA).mkdir(parents=True, exist_ok=True)

    # Conditional downloads
    if dawg_url:
        ok, err = _download_to(dawg_url, dawg_p)
        if not ok:
            errs.append(f"dawg_download_failed: {err}")
    if gaddag_url:
        ok, err = _download_to(gaddag_url, gaddag_p)
        if not ok:
            errs.append(f"gaddag_download_failed: {err}")

    dawg_sz = dawg_p.stat().st_size if dawg_p.exists() else 0
    gaddag_sz = gaddag_p.stat().st_size if gaddag_p.exists() else 0
    ok = (dawg_sz > 0 and gaddag_sz > 0)

    return {
        "ok": ok,
        "dawg_path": str(dawg_p),
        "gaddag_path": str(gaddag_p),
        "dawg_size": dawg_sz,
        "gaddag_size": gaddag_sz,
        "errors": errs,
    }

# ------------------------------
# Strategy helpers and diagnostics
# ------------------------------
REQ_STRATEGY: List[tuple[str, str]] = [
    ("default_english", "syn2"),
    ("default_english", "vcplace"),
    ("default_english", "superleaves"),
    ("default_english", "worths"),
    ("default", "bogowin"),
]

def _hash_sha256(path: Path) -> Optional[str]:
    try:
        h = hashlib.sha256()
        with path.open("rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                h.update(chunk)
        return h.hexdigest()
    except Exception:
        return None

def _stat_strategy_file(p: Path) -> Dict[str, Any]:
    try:
        if p.exists() and p.is_file():
            st = p.stat()
            return {
                "exists": True,
                "path": str(p),
                "size": st.st_size,
                "sha256": _hash_sha256(p),
                "mode": oct(st.st_mode & 0o777),
            }
        else:
            return {"exists": False, "path": str(p)}
    except Exception as e:
        return {"exists": False, "path": str(p), "error": str(e)}

def _strategy_inventory(base: Optional[Path] = None) -> Dict[str, Any]:
    """Return inventory for required strategy files under base (default APPDATA/strategy)."""
    base = base or (Path(APPDATA) / "strategy")
    items: Dict[str, Any] = {}
    for d, f in REQ_STRATEGY:
        p = base / d / f
        items[f"{d}/{f}"] = _stat_strategy_file(p)
    all_ok = all(v.get("exists") and (v.get("size") or 0) > 0 for v in items.values())
    return {"strategy": items, "all_ok": all_ok, "base": str(base)}

def _ensure_strategy_files() -> Dict[str, Any]:
    """Ensure Quackle strategy tables exist under APPDATA/strategy.
    Copies packaged assets into the runtime directory if they're missing and
    reports which required files are present."""
    # Choose a source directory for strategy files. Prefer explicit env,
    # otherwise try common fallbacks present in both container and local dev.
    candidates: List[Path] = []
    env_src = os.getenv("QUACKLE_STRATEGY_SRC", "").strip()
    if env_src:
        candidates.append(Path(env_src).resolve())
    # Default container path
    candidates.append(Path("/usr/share/quackle/data/strategy").resolve())
    # Repo fallback (engine/third_party/quackle/data/strategy)
    try:
        repo_root = Path(__file__).resolve().parents[2]  # .../service-quackle
        repo_root = repo_root.parent  # repo root
        candidates.append((repo_root / "engine/third_party/quackle/data/strategy").resolve())
    except Exception:
        pass
    # Pick the first existing candidate
    src_base = next((c for c in candidates if c.exists()), candidates[0])
    dest_base = Path(APPDATA) / "strategy"
    required: Dict[str, List[str]] = {
        "default": ["bogowin"],
        "default_english": ["syn2", "vcplace", "superleaves", "worths"],
    }
    result: Dict[str, Any] = {
        "ok": False,
        "src": str(src_base),
        "dest": str(dest_base),
        "files": {},
        "errors": [],
    }

    if not src_base.exists():
        result["errors"].append("strategy_src_missing")
        return result

    try:
        shutil.copytree(src_base, dest_base, dirs_exist_ok=True)
    except Exception as e:
        result["errors"].append(f"copy_failed:{e}")

    missing: List[str] = []
    for subset, names in required.items():
        for name in names:
            key = f"{subset}/{name}"
            target = dest_base / subset / name
            exists = target.exists() and target.is_file()
            size = target.stat().st_size if exists else 0
            is_ready = exists and size > 0
            result["files"][key] = {"exists": is_ready, "size": size}
            if not is_ready:
                missing.append(key)

    if missing:
        result["errors"].append("missing:" + ",".join(missing))

    result["ok"] = not result["errors"]
    return result

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1) Create directories idempotently
    Path(LEXDIR).mkdir(parents=True, exist_ok=True)
    Path(APPDATA).mkdir(parents=True, exist_ok=True)
    print(f"[startup] Created/verified LEXDIR={LEXDIR} APPDATA={APPDATA}")
    # 2) Optional download and validation
    st = _ensure_lexicon_files()
    STARTUP_STATUS.update(st)
    print(f"[startup] Lexicon ensure: ok={st['ok']} dawg={st['dawg_path']}({st['dawg_size']}) gaddag={st['gaddag_path']}({st['gaddag_size']})")
    if st["errors"]:
        print(f"[startup] Lexicon errors: {st['errors']}")
    # 2b) Ensure strategy files are present (copy from packaged assets or local fallbacks)
    stg = _ensure_strategy_files()
    STARTUP_STATUS["strategy"] = stg
    print(f"[startup] Strategy ensure: ok={stg.get('ok')} src={stg.get('src')} dest={stg.get('dest')} errors={stg.get('errors')}")
    if stg.get("files"):
        missing_debug = [k for k, v in stg["files"].items() if not v.get("exists")]
        if missing_debug:
            print(f"[startup] Strategy missing: {missing_debug}")


    # 3) Block until completion of download/verification (done above synchronously)
    yield

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=ALLOW_ORIGINS, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

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

def _reconstruct_tiles_from_raw_move(raw_move: Dict[str, Any], words: Optional[Any] = None) -> List[Dict[str, Any]]:
    """Rebuild placed tiles ensuring letters align with board coordinates and blanks."""
    try:
        positions_raw = raw_move.get("positions") or []
    except AttributeError:
        return []

    pos_list: List[tuple[int, int]] = []
    for pos in positions_raw:
        if not isinstance(pos, (list, tuple)) or len(pos) < 2:
            continue
        try:
            r = int(pos[0])
            c = int(pos[1])
        except (TypeError, ValueError):
            continue
        pos_list.append((r, c))

    if not pos_list:
        return []

    try:
        start_row = int(raw_move.get("row"))
        start_col = int(raw_move.get("col"))
    except (TypeError, ValueError):
        return []

    direction = str(raw_move.get("dir") or "H").upper()
    raw_word = raw_move.get("word")
    raw_word_str = str(raw_word) if isinstance(raw_word, str) or raw_word is not None else ""

    first_word = ""
    if isinstance(words, (list, tuple)) and words:
        candidate = words[0]
        if isinstance(candidate, str):
            first_word = candidate
        elif candidate is not None:
            first_word = str(candidate)

    full_word_str = first_word or raw_word_str.replace('.', '') or raw_word_str

    tiles: List[Dict[str, Any]] = []
    pos_idx = 0

    for i, full_char in enumerate(full_word_str):
        if pos_idx >= len(pos_list):
            break

        row = start_row + (0 if direction == 'H' else i)
        col = start_col + (i if direction == 'H' else 0)
        target = pos_list[pos_idx]

        if target != (row, col):
            continue

        raw_char = raw_word_str[i] if i < len(raw_word_str) else ""
        letter_char = full_char or raw_char

        is_blank = False
        if raw_char:
            if raw_char in {'.'}:
                # Existing board tile placeholder; use word character
                letter_char = full_char
            elif raw_char.islower():
                is_blank = True
                letter_char = full_char or raw_char.upper()
            elif raw_char in {'?', '*'}:
                is_blank = True
                letter_char = full_char or raw_char.upper()
            else:
                letter_char = full_char or raw_char
        else:
            letter_char = full_char or letter_char

        if not letter_char:
            pos_idx += 1
            continue

        letter_up = letter_char.upper()
        # Bridge raw positions are 1-based; normalize to 0-based for service output
        tiles.append({
            "row": target[0] - 1,
            "col": target[1] - 1,
            "letter": letter_up,
            "points": 0 if is_blank else _letter_points_en(letter_up),
            "isBlank": is_blank
        })

        pos_idx += 1

    return tiles

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

def _normalize_rack_flexible(raw: Any) -> str:
    """Wrap the pure helper and map ValueError to HTTPException(400)."""
    try:
        return _rack_pure_normalize(raw)
    except ValueError:
        raise HTTPException(status_code=400, detail="invalid_rack_format")

def _is_coord_map(d: Dict[str, Any]) -> bool:
    return _is_coord_map_pure(d)

def _squares_from_coord_map(coord_map: Dict[str, Any], rows: int, cols: int) -> List[List[Optional[str]]]:
    try:
        return _squares_from_coord_map_pure(coord_map, rows, cols)
    except ValueError as e:
        msg = str(e) if str(e) in {"malformed_board", "invalid_board_coordinate"} else "malformed_board"
        raise HTTPException(status_code=400, detail=msg)

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

def _normalize_board_for_bridge(board_input: Any) -> Dict[str, Any]:
    """
    Accepts:
      - legacy grid: List[str] (15x15)
      - object: {"rows":15, "cols":15, "grid":[...15 strings...]}
        (may include extra metadata like center_x/center_y which are ignored)
    Returns a sanitized object {"rows":15,"cols":15,"grid":[...]}.
    Raises HTTPException(400) for invalid shapes.
    """
    # Extract grid depending on type
    if isinstance(board_input, list):
        # Legacy form: list[str] (15 strings)
        grid = board_input
    elif isinstance(board_input, dict):
        rows = int(board_input.get("rows") or 15)
        cols = int(board_input.get("cols") or 15)
        # Optional center validation if provided
        if "center_x" in board_input or "center_y" in board_input:
            try:
                cx = int(board_input.get("center_x"))
                cy = int(board_input.get("center_y"))
            except Exception:
                raise HTTPException(status_code=400, detail="malformed_board")
            if not (0 <= cx < cols and 0 <= cy < rows):
                raise HTTPException(status_code=400, detail="invalid_board_coordinate")

        # Accept grid
        if "grid" in board_input:
            grid = board_input.get("grid")
        # Accept 1-based coordinate map
        elif _is_coord_map(board_input):
            # Build a 15x15 grid from provided coordinates
            squares = _squares_from_coord_map(board_input, rows, cols)
            grid = [
                ''.join(
                    '.' if (v is None or v == '' or v == '.') else ('?' if v in ('?', '*') else str(v).upper()[:1])
                    for v in row
                )
                for row in squares
            ]
        # Accept squares: 2D array (rows x cols)
        elif isinstance(board_input.get("squares"), list):
            squares = board_input.get("squares")
            if not (isinstance(squares, list) and len(squares) == rows and all(isinstance(r, list) and len(r) == cols for r in squares)):
                raise HTTPException(status_code=400, detail="malformed_board_squares_size")
            grid = [
                ''.join(
                    '.' if (cell in (None, '.', '')) else ('?' if str(cell) in ('?', '*') else str(cell).upper()[:1])
                    for cell in r
                )
                for r in squares
            ]
        # Accept placements: list of objects with x,y,letter,is_blank
        elif isinstance(board_input.get("placements"), list):
            squares = [[None for _ in range(cols)] for _ in range(rows)]
            for p in board_input.get("placements"):
                try:
                    x = int(p.get("x"))
                    y = int(p.get("y"))
                    letter = str(p.get("letter", "")).upper()[:1]
                    is_blank = bool(p.get("is_blank") or p.get("isBlank") or False)
                except Exception:
                    raise HTTPException(status_code=400, detail="malformed_board")
                if not (0 <= x < cols and 0 <= y < rows):
                    raise HTTPException(status_code=400, detail="invalid_board_coordinate")
                squares[y][x] = '?' if is_blank or letter in ('?', '*') else letter
            grid = [
                ''.join('.' if (v is None or v == '' or v == '.') else ('?' if v in ('?', '*') else str(v).upper()[:1]) for v in row)
                for row in squares
            ]
        else:
            raise HTTPException(status_code=400, detail="board.grid missing")
    else:
        raise HTTPException(status_code=400, detail="board invalid type")

    # Validate grid shape
    if not (isinstance(grid, list) and len(grid) == 15 and all(isinstance(r, str) and len(r) == 15 for r in grid)):
        raise HTTPException(status_code=400, detail="board.grid must be 15 strings of length 15")

    return {"rows": 15, "cols": 15, "grid": grid}

def _grid_to_coordmap(grid: list[str]) -> dict[str, dict]:
    try:
        return _coord_map_from_grid_pure(grid)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

def _sanitize_coordmap_for_bridge(board_in: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    """
    Accepts a dict with string keys "r,c" and values that may be dicts with
    {letter,isBlank} or raw letters. Returns a cleaned 1-based coord map suitable
    for the native bridge. Skips entries with missing/invalid letters.
    """
    out: Dict[str, Dict[str, Any]] = {}
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
        letter = ''
        is_blank = False
        if isinstance(v, dict):
            letter = str(v.get("letter", "")).strip().upper()[:1]
            is_blank = bool(v.get("isBlank") or v.get("is_blank") or False)
        else:
            letter = str(v).strip().upper()[:1]
            is_blank = False
        # Reject placeholders and missing letters
        if not letter or letter in {'.', '?', '*'}:
            continue
        # Only allow A-Z letters
        if not re.fullmatch(r"[A-Z]", letter):
            continue
        out[k] = {"letter": letter, "isBlank": bool(is_blank)}
    return out

@app.get("/debug/strategy")
def debug_strategy():
    base = Path(os.getenv("QUACKLE_APPDATA_DIR", "/data/appdata")).joinpath("strategy")
    inventory = []
    for root, _, files in os.walk(base):
        for name in files:
            p = Path(root) / name
            try:
                sz = p.stat().st_size
                h = _hash_sha256(p) if sz > 0 else None
            except Exception:
                sz, h = 0, None
            inventory.append({"path": str(p), "size": sz, "sha256": h})
    # Required flags (existence and size>0)
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
    return {
        "inventory": inventory,
        "required_flags": required,
        "bridge_path": BRIDGE_BIN,
        "bridge_version": "v104-strict",
    }

@app.get("/health")
def health():
    # Read dynamic env for accurate, test-friendly reporting
    lexicon_name = os.getenv("LEXICON_NAME", os.getenv("QUACKLE_LEXICON", "enable1.15").strip()).strip()
    lexdir = os.getenv("QUACKLE_LEXDIR", "/data/lexica").strip()
    appdata = os.getenv("QUACKLE_APPDATA_DIR", "/data/appdata").strip()
    skip = os.getenv("QUACKLE_SKIP_LEXICON_CHECK", "").strip().lower() in {"1","true","yes","on"}

    ok, dawg, gaddag = ensure_lexicon_ready()
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
    lex_words_path = os.getenv("QUACKLE_WORDLIST", os.path.join(LEXDIR, f"{LEXICON_NAME}.txt"))
    word_count = None
    try:
        if os.path.isfile(lex_words_path):
            with open(lex_words_path, 'r', encoding='utf-8', errors='ignore') as f:
                word_count = sum(1 for _ in f)
    except Exception:
        word_count = None
    engine_ready = (os.path.exists(BRIDGE_BIN) and os.access(BRIDGE_BIN, os.X_OK) and (ok or skip))
    strat_debug = _strategy_inventory()
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
        "word_count": word_count,
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
        "cors_origins_raw": os.getenv("CORS_ORIGINS", ""),
        "quackle_lexicon": os.getenv("QUACKLE_LEXICON", ""),
        "quackle_lexdir": QUACKLE_LEXDIR,
        "lexicon_name": LEXICON_NAME,
        "lex_dir": LEXDIR
    }
    # Note: code below was unreachable; removed for clarity.

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

@app.get("/debug/selftest")
def debug_selftest():
    """Run the native bridge in --selftest mode to verify lexicon loading and
    basic board preparation, without invoking kibitz.
    Returns rc, stdout, stderr.
    """
    try:
        child_env = {
            **os.environ,
            "QUACKLE_APPDATA_DIR": APPDATA,
            "QUACKLE_LEXDIR": QUACKLE_LEXDIR,
            "QUACKLE_LEXICON": QUACKLE_LEXICON,
        }
        args = [
            BRIDGE_BIN,
            "--lexicon", QUACKLE_LEXICON,
            "--lexdir", QUACKLE_LEXDIR,
            "--gaddag", f"{QUACKLE_LEXDIR}/{QUACKLE_LEXICON}.gaddag",
            "--ruleset", "en",
            "--selftest",
        ]
        proc = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=child_env, timeout=10)
        return JSONResponse({
            "rc": proc.returncode,
            "stdout": proc.stdout.decode("utf-8", errors="replace"),
            "stderr": proc.stderr.decode("utf-8", errors="replace"),
        }, status_code=200 if proc.returncode == 0 else 500)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@app.post("/debug/probe")
async def debug_probe(request: Request):
    """Debug endpoint to analyze a game state without executing a full turn
    Accepts same payload as /best-move. Normalizes input and returns quick diagnostics.
    """
    try:
        raw = await request.body()
        body = json.loads(raw.decode("utf-8")) if raw else {}
        # Accept partial racks (0..7) here for robustness in endgame situations
        rack_norm = _normalize_rack_flexible(body.get("rack"))
        board_out = _normalize_board_for_bridge(body.get("board"))
        non_empty = any(ch != '.' for row in board_out.get("grid", []) for ch in row)
        center_anchor_ok = True
        logger.debug("board_norm (grid) rows=%s cols=%s non_empty=%s", board_out.get("rows"), board_out.get("cols"), non_empty)

        # Optionally call the bridge to ensure it's reachable and to surface errors; not mandatory for probe
        payload = {"board": board_out, "rack": rack_norm}
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

@app.post("/bag/summary")
async def bag_summary(req: Request):
    """Compute remaining tiles in the bag and unseen letters, based on current board and rack.
    Accepts JSON like {"board": <any accepted shape>, "rack": <string|list>, "distribution": {optional override}}.
    Returns remaining_count, remaining_by_letter and a repeated letters pool.
    """
    try:
        raw = await req.body()
        body = json.loads(raw.decode("utf-8")) if raw else {}
        rack_norm = _normalize_rack_flexible(body.get("rack"))
        board_out = _normalize_board_for_bridge(body.get("board"))
        base = _english_tile_distribution()
        dist = _merge_distribution_override(base, body.get("distribution"))

        # Unseen from the player's perspective = base - board - player rack
        unseen_count, unseen_by_letter = _count_unseen(board_out["grid"], rack_norm, dist)

        # Optionally compute the actual bag (excluding opponent rack if provided)
        opp_raw = body.get("opponent_rack") if isinstance(body, dict) else None
        if opp_raw is None and isinstance(body, dict):
            opp_raw = body.get("opponentRack")  # camelCase alternative
        opp_rack = _normalize_rack_flexible(opp_raw)

        bag_by_letter = dict(unseen_by_letter)
        if opp_rack:
            for ch in opp_rack:
                K = '?' if ch in {'?', '*'} else ch
                if re.fullmatch(r"[A-Z\?]", K):
                    bag_by_letter[K] = max(0, bag_by_letter.get(K, 0) - 1)
        bag_count = sum(int(v) for v in bag_by_letter.values())

        # Build pools
        order = [chr(c) for c in range(ord('A'), ord('Z') + 1)] + ['?']
        unseen_pool: List[str] = []
        bag_pool: List[str] = []
        for k in order:
            u = int(unseen_by_letter.get(k, 0))
            b = int(bag_by_letter.get(k, 0))
            if u > 0:
                unseen_pool.extend([k] * u)
            if b > 0:
                bag_pool.extend([k] * b)

        return {
            # Back-compat fields (represent unseen)
            "remaining_count": unseen_count,
            "remaining_by_letter": unseen_by_letter,
            "pool": unseen_pool,
            # Explicit fields
            "unseen_count": unseen_count,
            "unseen_by_letter": unseen_by_letter,
            "unseen_pool": unseen_pool,
            "bag_count": bag_count,
            "bag_by_letter": bag_by_letter,
            "bag_pool": bag_pool,
        }
    except HTTPException as e:
        return JSONResponse({"error": e.detail}, status_code=e.status_code)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@app.get("/health/lexicon")
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

@app.get("/debug/quackle")
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

@app.get("/debug/ping")
def debug_ping():
    return {"ok": True, "msg": "pong", "version": "v104-debug"}

def _call_bridge_simple_op(op: str) -> Dict[str, Any]:
    """Call the native bridge with a simple op (no board/rack), e.g. 'probe_strategy'."""
    try:
        wrapper_payload = {"op": op}
        stdin_str = json.dumps(wrapper_payload, separators=(",", ":"))
        child_env = {
            **os.environ,
            "QUACKLE_APPDATA_DIR": APPDATA,
            "QUACKLE_LEXDIR": QUACKLE_LEXDIR,
            "QUACKLE_LEXICON": QUACKLE_LEXICON,
        }
        proc = subprocess.run(
            [
                BRIDGE_BIN,
                "--lexicon", QUACKLE_LEXICON,
                "--lexdir", QUACKLE_LEXDIR,
                "--gaddag", f"{QUACKLE_LEXDIR}/{QUACKLE_LEXICON}.gaddag",
                "--ruleset", "en"
            ],
            input=stdin_str.encode("utf-8"),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=to_subprocess_timeout_s(TIMEOUT_MS),
            env=child_env,
        )
        try:
            stderr_output = proc.stderr.decode("utf-8")
        except UnicodeDecodeError:
            stderr_output = proc.stderr.decode("latin-1", errors="replace")
        out_try = proc.stdout.decode("utf-8", errors="replace").strip()
        if proc.returncode != 0:
            return {"engine_fallback": True, "error": f"bridge_failed_rc={proc.returncode}", "rc": proc.returncode, "stderr": stderr_output[:4000]}
        return json.loads(out_try) if out_try else {"ok": True}
    except Exception as e:
        return {"engine_fallback": True, "error": str(e)}

@app.get("/debug/strategy-probe")
def debug_strategy_probe():
    """Use the bridge 'probe_strategy' op to report strategy files status and resolution,
    without calling initialize() or kibitz."""
    res = _call_bridge_simple_op("probe_strategy")
    return res

@app.post("/debug/bridge-payload")
def debug_bridge_payload(req: Dict[str, Any]):
    """Return the exact sanitized JSON that would be sent to the bridge,
    without invoking the native binary."""
    rack_str = _normalize_rack_flexible(req.get("rack"))
    b_in = req.get("board")
    # Preview exact payload: pass through coord map if already provided, otherwise convert grid/squares
    if isinstance(b_in, dict) and _is_coord_map(b_in):
        coord_map = _sanitize_coordmap_for_bridge(b_in)
    else:
        board_out = _normalize_board_for_bridge(b_in)
        grid = board_out["grid"]
        coord_map = _grid_to_coordmap(grid)
    bridge_payload = _sanitize_none({"rack": rack_str, "ruleset": "en", "board": coord_map})
    return {"bridge_payload": bridge_payload}

@app.get("/debug/lexicon")
def debug_lexicon():
    dawg, gaddag = _lex_paths()
    strat_en = os.path.join(APPDATA, "strategy", "default_english")
    strat_def = os.path.join(APPDATA, "strategy", "default")
    def exists(p):
        return os.path.isfile(p)
    def join(*a):
        return os.path.join(*a)
    # Directory listing for diagnostics (names and sizes)
    listing = []
    dir_exists = os.path.isdir(LEXDIR)
    dir_error = None
    try:
        for name in sorted(os.listdir(LEXDIR)):
            p = os.path.join(LEXDIR, name)
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
        "lex_dir": LEXDIR,
        "lex_dir_exists": dir_exists,
        "lex_dir_error": dir_error,
        "app_data_dir": APPDATA,
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

# on_event startup removed in favor of lifespan()

def _call_bridge(payload: Dict[str, Any]) -> Dict[str, Any]:
    try:
        # Build minimal, sanitized payload for the bridge
        # Accept partial racks (0..7) for endgame; allow only A-Z and blanks
        rack_str = _normalize_rack_flexible(payload.get("rack"))

        # Bridge expects a 1-based coordinate map: "r,c" -> {letter,isBlank}
        board_in = payload.get("board")
        if isinstance(board_in, dict) and _is_coord_map(board_in):
            board_for_bridge = _sanitize_coordmap_for_bridge(board_in)
        else:
            board_out = _normalize_board_for_bridge(board_in)
            grid = board_out["grid"]
            board_for_bridge = _grid_to_coordmap(grid)
        bridge_payload = {
            "rack": rack_str,
            "ruleset": "en",
            "board": board_for_bridge,
        }
        # Optional difficulty passthrough (easy|medium|hard)
        diff = (payload.get("difficulty") or "").strip().lower()
        if diff in {"easy", "medium", "hard"}:
            bridge_payload["difficulty"] = diff
        bridge_payload = _sanitize_none(bridge_payload)
        wrapper_payload = {"op": "compute", **bridge_payload}
        stdin_str = json.dumps(wrapper_payload, separators=(",", ":"))

        if os.getenv("DEBUG_BRIDGE_PAYLOAD", "").strip().lower() in {"1","true","yes","on"}:
            print("[bridge.stdin]", stdin_str)
        # Preflight: require strategy unless explicitly allowed empty
        allow_empty_strategy = os.getenv("ALLOW_EMPTY_STRATEGY") == "1"
        inv = _strategy_inventory()
        if not allow_empty_strategy and not inv.get("all_ok", False):
            return {"engine_fallback": True, "error": "strategy_missing", **inv}

        try:
            # Ensure the bridge child sees the same runtime dirs we validated
            child_env = {
                **os.environ,
                "QUACKLE_APPDATA_DIR": APPDATA,
                "QUACKLE_LEXDIR": QUACKLE_LEXDIR,
                "QUACKLE_LEXICON": QUACKLE_LEXICON,
            }
            proc = subprocess.run(
                [
                    BRIDGE_BIN,
                    "--lexicon", QUACKLE_LEXICON,
                    "--lexdir", QUACKLE_LEXDIR,
                    "--gaddag", f"{QUACKLE_LEXDIR}/{QUACKLE_LEXICON}.gaddag",
                    "--ruleset", "en"
                ],
                input=stdin_str.encode("utf-8"),
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                timeout=to_subprocess_timeout_s(TIMEOUT_MS),
                env=child_env,
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
        out_try = proc.stdout.decode("utf-8", errors="replace").strip()
        if os.getenv("DEBUG_BRIDGE_PAYLOAD", "").strip().lower() in {"1","true","yes","on"}:
            print("[bridge.rc]", proc.returncode)
            print("[bridge.stdout]", out_try[:2000])
            if stderr_output:
                print("[bridge.stderr]", stderr_output[:2000])
        
        if proc.returncode != 0:
            logger.error(f"Bridge failed with return code {proc.returncode}")
            if stderr_output:
                logger.error(f"stderr: {stderr_output[:2000]}")
            # Try to parse stdout for a structured error message from the bridge
            try:
                parsed = json.loads(out_try) if out_try else {}
            except Exception:
                parsed = {}
            if isinstance(parsed, dict) and parsed.get("engine_fallback"):
                parsed.setdefault("rc", proc.returncode)
                return parsed
            # Optional: include ldd output to aid diagnostics if explicitly enabled
            ldd_out = None
            if DEBUG_ENABLE_LDD:
                try:
                    ldd = subprocess.run(["ldd", BRIDGE_BIN], capture_output=True, text=True, timeout=3)
                    ldd_out = ((ldd.stdout or "") + ("\n" + (ldd.stderr or "")).strip())[:4000]
                except Exception:
                    ldd_out = None
            # Return structured error instead of raising to avoid 500
            err = {
                "engine_fallback": True,
                "error": f"bridge_failed_rc={proc.returncode}",
                "rc": proc.returncode,
                "stderr": stderr_output[:4000]
            }
            if ldd_out:
                err["ldd"] = ldd_out
            return err

        out = out_try
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
                "engine_fallback": True,
                "error": f"json_decode_error: {e}"
            }
    except Exception as e:
        print(f"[ERROR] Bridge error: {repr(e)}")
        return {
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
        # Accept partial racks (0..7) — endgame can have fewer than 7 tiles
        rack_norm = _normalize_rack_flexible(body.get("rack"))
        board_out = _normalize_board_for_bridge(body.get("board"))
        non_empty = any(ch != '.' for row in board_out.get("grid", []) for ch in row)
        logger.debug("rack_norm=%s (len=%s)", rack_norm, len(rack_norm))
        logger.debug("board_norm(grid) rows=%s cols=%s non_empty=%s", board_out.get("rows"), board_out.get("cols"), non_empty)
        print(f"[DEBUG] rack_norm len={len(rack_norm)} rack='{rack_norm}'")
        print(f"[DEBUG] board_norm rows={board_out.get('rows')} cols={board_out.get('cols')} non_empty={non_empty}")

        # If rack is empty, no move is possible: return a PASS deterministically (avoid hitting the bridge)
        if len(rack_norm) == 0:
            return {
                "tiles": [],
                "score": 0,
                "words": [],
                "move_type": "pass",
                "engine_fallback": False
            }

        # Preflight lexicon only in production to keep tests fast
        if ENV_MODE == 'prod' and not SKIP_LEXICON_CHECK:
            ok, dawg, gaddag = ensure_lexicon_ready()
            if not ok:
                print(f"[lexicon] missing files: dawg={os.path.exists(dawg)} gaddag={os.path.exists(gaddag)} dir={LEXDIR}")
                raise HTTPException(status_code=500, detail="lexicon_not_ready")

        # Build bridge payload from normalized inputs (propaga difficulty se presente)
        # Convert normalized grid to 1-based coordinate map for the bridge
        board_map = _grid_to_coordmap(board_out.get("grid"))
        try:
            bkeys = list(board_map.keys())
            print("[DEBUG] board_map keys sample:", bkeys[:5], "count=", len(bkeys))
        except Exception:
            pass
        payload = {
            "board": (board_map if board_map else {}),
            "rack": rack_norm,
        }
        diff_raw = (body.get("difficulty") if isinstance(body, dict) else None) or None
        if isinstance(diff_raw, str) and diff_raw.strip().lower() in {"easy", "medium", "hard"}:
            payload["difficulty"] = diff_raw.strip().lower()

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
            if err in {"invalid_board_coordinate", "malformed_coordinate", "rack_empty", "invalid_rack_format", "malformed_board", "invalid_ruleset"}:
                status = 400
            rc_val = result.get("rc")
            if isinstance(rc_val, int):
                if rc_val == 64:
                    status = 400
                elif rc_val == 72:
                    status = 502
                elif rc_val == 70:
                    status = 500
            elif err.startswith("exec_failed") or err.startswith("bridge_failed_rc") or err == "strategy_missing":
                status = 502
            # If rack has fewer than 7 tiles, degrade engine errors to a deterministic PASS
            if len(rack_norm) < 7:
                return {
                    "tiles": [],
                    "score": 0,
                    "words": [],
                    "move_type": "pass",
                    "engine_fallback": False
                }
            body = {k: v for k, v in result.items() if k in {"engine_fallback", "error", "stderr", "ldd", "rc"}}
            return JSONResponse(body or {"engine_fallback": True, "error": err}, status_code=status)

        # Success path
        tiles_out = result.get("tiles", [])
        raw_move = result.get("raw_move") if isinstance(result, dict) else None
        if isinstance(raw_move, dict):
            rebuilt = _reconstruct_tiles_from_raw_move(raw_move, result.get("words"))
            if rebuilt:
                tiles_out = rebuilt
        # Bridge already returns 0-based coordinates; pass through unchanged
        # Keep a light validation to ensure integers where possible
        def _ensure_ints(t: dict) -> dict:
            try:
                r = int(t.get("row"))
                c = int(t.get("col"))
                return {**t, "row": r, "col": c}
            except Exception:
                return t
        tiles_out = [_ensure_ints(t) for t in tiles_out]

        return {
            "tiles": tiles_out,
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
        board_out = _normalize_board_for_bridge({
            "rows": 15, "cols": 15, "grid": ["."*15 for _ in range(15)]
        })
        res = _call_bridge({"board": board_out, "rack": "AEIRSTZ"})
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
        board_out = _normalize_board_for_bridge({
            "rows": 15, "cols": 15, "grid": grid
        })
        res = _call_bridge({"board": board_out, "rack": "HELLO??"})
        cases.append({
            "name": "centerA+HELLO??",
            "ok": (not res.get("engine_fallback") and res.get("move_type") != "pass"),
            "res": res if res.get("engine_fallback") else {"move_type": res.get("move_type"), "score": res.get("score")}
        })
    except Exception as e:
        cases.append({"name": "centerA+HELLO??", "ok": False, "error": str(e)})

    # Case 3: Legacy B format (15 strings grid)
    try:
        board_out = _normalize_board_for_bridge(["."*15 for _ in range(15)])
        res = _call_bridge({"board": board_out, "rack": "AEIRSTZ"})
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
