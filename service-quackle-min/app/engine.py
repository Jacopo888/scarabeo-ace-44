from __future__ import annotations
import json
import subprocess
from fastapi import HTTPException
from .config import ENGINE_BIN, TIMEOUT_MS, LEXICON
import os

def best_move(rack: str, board: dict) -> dict:
    payload = {
        "op": "best_move",
        "rack": rack,
        "board": board,
        "lexicon": LEXICON,
        "strategies": True
    }
    try:
        proc = subprocess.run(
            [ENGINE_BIN],
            input=json.dumps(payload).encode("utf-8"),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=TIMEOUT_MS / 1000.0,
        )
    except subprocess.TimeoutExpired:
        print("[engine] timeout while waiting for wrapper")
        raise HTTPException(status_code=504, detail="timeout")
    except FileNotFoundError:
        print(f"[engine] engine binary not found at {ENGINE_BIN}")
        raise HTTPException(status_code=500, detail="engine_error")
    if proc.returncode != 0:
        # Log server-side: rc e snippet stderr per diagnosi
        try:
            stderr_snip = proc.stderr.decode(errors="replace")[:400]
        except Exception:
            stderr_snip = "<stderr decode failed>"
        # Evita di esporre al client dettagli sensibili
        print(f"[engine] wrapper failed rc={proc.returncode} stderr='{stderr_snip}'")
        raise HTTPException(status_code=500, detail="engine_error")
    try:
        data = json.loads(proc.stdout.decode("utf-8", errors="replace"))
    except Exception:
        # stdout non decodificabile → log snippet raw per capire
        raw_out = proc.stdout[:200] if proc and proc.stdout is not None else b""
        try:
            raw_snip = raw_out.decode(errors="replace")
        except Exception:
            raw_snip = "<stdout decode failed>"
        print(f"[engine] invalid json from wrapper rc={proc.returncode} stdout_snip='{raw_snip}'")
        raise HTTPException(status_code=500, detail="engine_error")
    if not isinstance(data, dict):
        print(f"[engine] wrapper returned non-dict payload rc={proc.returncode}")
        raise HTTPException(status_code=500, detail="engine_error")
    if data.get("status") != "ok":
        # Log l'errore strutturato se presente
        err = data.get("error") or "unknown"
        print(f"[engine] wrapper status!=ok rc={proc.returncode} error='{err}'")
        raise HTTPException(status_code=500, detail="engine_error")
    return data
