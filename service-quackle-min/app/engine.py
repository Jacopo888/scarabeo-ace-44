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
        raise HTTPException(status_code=504, detail="timeout")
    except FileNotFoundError:
        raise HTTPException(status_code=500, detail="engine_error")
    if proc.returncode != 0:
        # Log server-side uno snippet di stderr per diagnosi
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
        raise HTTPException(status_code=500, detail="engine_error")
    if not isinstance(data, dict):
        raise HTTPException(status_code=500, detail="engine_error")
    if data.get("status") != "ok":
        raise HTTPException(status_code=500, detail="engine_error")
    return data
