import json
import os
import time
import subprocess
import threading
import select
import sys
from fastapi import FastAPI, Body, HTTPException
from fastapi.responses import JSONResponse
from app.models import MoveRequest, MoveResponse
from typing import Optional

APP_PORT = int(os.getenv("PORT", "8080"))
GADDAG_PATH = os.getenv("GADDAG_PATH", "/app/lexica/enable1.gaddag")
RULESET = os.getenv("RULESET", "it")

app = FastAPI(title="Scarabeo Engine", version="0.1.0")

_engine_proc: Optional[subprocess.Popen] = None
_stderr_thread: Optional[threading.Thread] = None


def start_engine():
    global _engine_proc
    global _stderr_thread
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
    # Start stderr drain thread (non-blocking logging)
    def _drain_stderr(proc: subprocess.Popen):
        try:
            while True:
                if proc.poll() is not None:
                    # Drain any remaining content
                    rest = proc.stderr.read() if proc.stderr else ""
                    if rest:
                        for ln in rest.splitlines():
                            print(f"[wrapper] {ln}")
                    break
                if proc.stderr is None:
                    break
                r, _, _ = select.select([proc.stderr], [], [], 0.2)
                if r:
                    line = proc.stderr.readline()
                    if line:
                        print(f"[wrapper] {line.rstrip()}\n", end="")
        except Exception as e:
            print(f"[engine] stderr thread error: {e}", file=sys.stderr)

    if _engine_proc.stderr and (_stderr_thread is None or not _stderr_thread.is_alive()):
        _stderr_thread = threading.Thread(target=_drain_stderr, args=(_engine_proc,), daemon=True)
        _stderr_thread.start()


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
        if (time.time() - start_t) * 1000 > timeout_ms + 800:
            raise TimeoutError("engine timeout")
        line = _engine_proc.stdout.readline()
        if not line:
            # try to drain a bit of stderr for diagnostics without blocking
            try:
                if _engine_proc.stderr is not None:
                    r, _, _ = select.select([_engine_proc.stderr], [], [], 0)
                    if r:
                        err_line = _engine_proc.stderr.readline()
                        if err_line:
                            print(f"[wrapper] {err_line.rstrip()}\n", end="")
            except Exception:
                pass
            continue
        try:
            return json.loads(line)
        except json.JSONDecodeError:
            # ignora righe non-JSON
            continue


@app.on_event("startup")
def _on_startup():
    # Optional GADDAG check at startup
    gaddag_path = os.environ.get("GADDAG_PATH", "/app/lexica/enable1.gaddag")
    if os.environ.get("RUN_GADDAG_CHECK", "0") == "1":
        try:
            subprocess.run(
                ["/app/bin/engine_wrapper", "--check-gaddag", gaddag_path],
                check=True
            )
            print(f"[startup] GADDAG check passed for {gaddag_path}")
        except subprocess.CalledProcessError as e:
            print(f"[startup] FATAL: GADDAG check failed for {gaddag_path} (rc={e.returncode}). "
                  f"Regenerate the file with the same Quackle version as the one used to build libquackle.")
            sys.exit(10)
    
    try:
        start_engine()
    except Exception as e:
        # non bloccare l'avvio: /healthz segnalerà lo stato
        print(f"[engine] startup warning: {e}")


@app.get("/healthz")
def healthz():
    ok = os.path.exists(GADDAG_PATH)
    return JSONResponse({"ok": ok, "dict_loaded": ok, "lang": RULESET, "path": GADDAG_PATH})


@app.get("/health/lexicon")
def health_lexicon():
    ok_fs = os.path.exists(GADDAG_PATH)
    lex_ok = False
    try:
        out = ask_engine({"op": "probe_lexicon"}, timeout_ms=800)
        # Propaga risposta wrapper se presente
        if isinstance(out, dict) and "lexicon_ok" in out:
            return out
        lex_ok = False
    except Exception:
        lex_ok = False
    return {
        "lexicon_name": "enable1",
        "lex_dir": os.path.dirname(GADDAG_PATH),
        "lexicon_ok": bool(ok_fs and lex_ok),
        "gaddag_path": GADDAG_PATH,
    }


@app.get("/health/engine")
def health_engine():
    try:
        out = ask_engine({"op": "ping"}, timeout_ms=500)
        if isinstance(out, dict) and out.get("pong") is True:
            return {"ok": True}
    except Exception:
        pass
    return {"ok": False}

@app.post("/engine/cmd")
def cmd(payload: dict = Body(...)):
    """Forward JSON command to wrapper process and return response"""
    try:
        out = ask_engine(payload, timeout_ms=5000)  # 5 second default timeout
        return out
    except TimeoutError:
        raise HTTPException(status_code=504, detail="engine timeout")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"engine error: {e}")

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


