import os, json, subprocess
from typing import Any, Dict
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware

ORIGINS = os.getenv("CORS_ORIGINS", "").split(",")
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in ORIGINS if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
            print(f"[ERROR] Bridge stderr: {stderr_output[:500]}")
            raise RuntimeError("bridge failed")
            
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
    body = await req.json()
    if "board" not in body or "rack" not in body:
        raise HTTPException(400, "Missing 'board' or 'rack'")
    result = _call_bridge(body)
    return {
        "tiles": result.get("tiles", []),
        "score": result.get("score", 0),
        "words": result.get("words", []),
        "move_type": result.get("move_type", "place" if result.get("tiles") else "pass"),
        "engine_fallback": result.get("engine_fallback", False)
    }
