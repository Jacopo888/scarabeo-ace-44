import os, json, subprocess
from typing import Any, Dict
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi.responses import JSONResponse
import os
from pydantic import BaseModel

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
QUACKLE_LEXICON = os.getenv("QUACKLE_LEXICON", "en-enable")
QUACKLE_LEXDIR = os.getenv("QUACKLE_LEXDIR", "/usr/share/quackle/lexica")

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
    appdata = os.getenv("QUACKLE_APPDATA_DIR", "")
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

# Ensure required lexicon assets exist at startup (generate GADDAG if missing)
@app.on_event("startup")
def _ensure_quackle_assets():
    try:
        lex = QUACKLE_LEXICON
        lexdir = QUACKLE_LEXDIR
        dawg = os.path.join(lexdir, f"{lex}.dawg")
        gaddag = os.path.join(lexdir, f"{lex}.gaddag")
        need_gaddag = not os.path.exists(gaddag)
        if need_gaddag and os.path.exists(dawg):
            mk = "/usr/local/bin/makegaddag"
            if os.path.exists(mk):
                print(f"[STARTUP] Generating GADDAG: {gaddag} from {dawg}")
                proc = subprocess.run(
                    [mk, dawg, gaddag],
                    cwd=lexdir,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    timeout=60,
                )
                print(f"[STARTUP] makegaddag rc={proc.returncode}")
                if proc.stdout:
                    print(f"[STARTUP] makegaddag stdout: {proc.stdout.decode('utf-8', 'ignore')[:500]}")
                if proc.stderr:
                    print(f"[STARTUP] makegaddag stderr: {proc.stderr.decode('utf-8', 'ignore')[:500]}")
                if proc.returncode != 0:
                    print("[STARTUP] makegaddag failed; continuing without GADDAG")
            else:
                print("[STARTUP] makegaddag not found; skipping GADDAG generation")
        else:
            print("[STARTUP] GADDAG already present or DAWG missing; no action")
    except Exception as e:
        print("[STARTUP] ensure assets error:", repr(e))

def _call_bridge(payload: Dict[str, Any]) -> Dict[str, Any]:
    try:
        print(f"[DEBUG] Calling bridge with payload: {json.dumps(payload, indent=2)[:500]}...")
        proc = subprocess.run(
            [BRIDGE_BIN, "--lexicon", QUACKLE_LEXICON, "--lexdir", QUACKLE_LEXDIR],
            input=json.dumps(payload).encode("utf-8"),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=8,
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
        body = {
            "board": req_model.board,
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
        return {
            "tiles": [],
            "score": 0,
            "words": [],
            "move_type": "pass",
            "engine_fallback": True,
            "error": str(e)
        }
