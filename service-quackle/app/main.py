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

BRIDGE_BIN = os.getenv("QUACKLE_BRIDGE_BIN", "/usr/local/bin/quackle_bridge")
QUACKLE_LEXICON = os.getenv("QUACKLE_LEXICON", "en-enable")
QUACKLE_LEXDIR = os.getenv("QUACKLE_LEXDIR", "/usr/share/quackle/lexica")

@app.get("/health")
def health():
    return {
        "status": "ok",
        "engine": "quackle-bridge",
        "bridge_path": BRIDGE_BIN,
        "lexicon": QUACKLE_LEXICON,
        "lexdir": QUACKLE_LEXDIR
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
async def best_move(req: Request):
    try:
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
