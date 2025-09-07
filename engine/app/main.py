import json
import os
import time
import subprocess
from fastapi import FastAPI, Body, HTTPException
from fastapi.responses import JSONResponse
from app.models import MoveRequest, MoveResponse
from typing import Optional

APP_PORT = int(os.getenv("PORT", "8080"))
GADDAG_PATH = os.getenv("GADDAG_PATH", "/app/lexica/enable1.gaddag")
RULESET = os.getenv("RULESET", "it")

app = FastAPI(title="Scarabeo Engine", version="0.1.0")

_engine_proc: Optional[subprocess.Popen] = None


def start_engine():
    global _engine_proc
    if _engine_proc and _engine_proc.poll() is None:
        return
    binary_path = "/app/bin/engine_wrapper"
    if not os.path.exists(binary_path):
        raise RuntimeError("Wrapper bin not found at /app/bin/engine_wrapper")
    if not os.path.exists(GADDAG_PATH):
        raise RuntimeError(f"GADDAG not found at {GADDAG_PATH}")
    _engine_proc = subprocess.Popen(
        [binary_path, "--gaddag", GADDAG_PATH, "--ruleset", RULESET],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=1  # line-buffered
    )


def ask_engine(payload: dict, timeout_ms: int) -> dict:
    if not _engine_proc or _engine_proc.poll() is not None:
        start_engine()
    assert _engine_proc and _engine_proc.stdin and _engine_proc.stdout
    msg = json.dumps(payload) + "\n"
    try:
        _engine_proc.stdin.write(msg)
        _engine_proc.stdin.flush()
    except BrokenPipeError:
        # restart once
        start_engine()
        _engine_proc.stdin.write(msg)
        _engine_proc.stdin.flush()

    # leggere una riga JSON come risposta
    start_t = time.time()
    while True:
        if (time.time() - start_t) * 1000 > timeout_ms + 200:
            raise TimeoutError("engine timeout")
        line = _engine_proc.stdout.readline()
        if not line:
            # se il wrapper ha scritto su stderr, puoi loggare; qui evitiamo deadlock
            continue
        try:
            return json.loads(line)
        except json.JSONDecodeError:
            # ignora righe non-JSON
            continue


@app.on_event("startup")
def _on_startup():
    try:
        start_engine()
    except Exception as e:
        # non bloccare l’avvio: /healthz segnalerà lo stato
        print(f"[engine] startup warning: {e}")


@app.get("/healthz")
def healthz():
    ok = os.path.exists(GADDAG_PATH)
    return JSONResponse({"ok": ok, "dict_loaded": ok, "lang": RULESET, "path": GADDAG_PATH})


@app.post("/api/v1/move", response_model=MoveResponse)
def compute_move(req: MoveRequest = Body(...)):
    # validazione dimensione board
    if len(req.board) != 15 or any(len(r) != 15 for r in req.board):
        raise HTTPException(status_code=400, detail="board must be 15x15")
    payload = {
        "op": "compute",
        "board": req.board,
        "rack": req.rack,
        "bag": req.bag or "",
        "turn": req.turn,
        "limit_ms": req.limit_ms,
        "ruleset": req.ruleset,
        "top_n": req.top_n
    }
    t0 = time.time()
    try:
        out = ask_engine(payload, timeout_ms=req.limit_ms)
    except TimeoutError:
        raise HTTPException(status_code=504, detail="engine timeout")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"engine error: {e}")
    elapsed = int((time.time() - t0) * 1000)
    # il wrapper stub garantisce chiavi "moves"
    return MoveResponse(moves=out.get("moves", []), elapsed_ms=elapsed)


