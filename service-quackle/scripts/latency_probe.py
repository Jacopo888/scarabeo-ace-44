#!/usr/bin/env python3
"""
Small in-process latency probe for CI.

It imports the FastAPI app, performs N POSTs to /best-move using TestClient, then
fetches /debug/latency and prints a single-line JSON with p50/p95/p99/min/max/count.

Env:
  N (int): number of samples (default 20)
  PAYLOAD (json): override request body; default uses rack empty {}
"""
import os
import json
import importlib
from typing import Any, Dict

from fastapi.testclient import TestClient


def main() -> int:
    n = int(os.environ.get("N", "20"))
    # default: fast path (empty rack) still records latency
    payload_raw = os.environ.get("PAYLOAD")
    try:
        payload: Dict[str, Any] = json.loads(payload_raw) if payload_raw else {"rack": "", "board": {}}
    except Exception:
        payload = {"rack": "", "board": {}}

    os.environ.setdefault("ENV", "test")
    os.environ.setdefault("CORS_ORIGINS", "http://localhost")
    mod = importlib.import_module("quackle_service.main")
    importlib.reload(mod)
    app = mod.app
    client = TestClient(app)

    # warmup request to initialize
    client.get("/health")
    before = client.get("/debug/latency").json().get("count", 0)
    for _ in range(max(1, n)):
        r = client.post("/best-move", json=payload)
        # swallow errors but ensure request attempted
        try:
            _ = r.json()
        except Exception:
            pass
    snap = client.get("/debug/latency").json()
    out = {
        "count": snap.get("count", 0),
        "p50": snap.get("p50", 0.0),
        "p95": snap.get("p95", 0.0),
        "p99": snap.get("p99", 0.0),
        "min": snap.get("min", 0.0),
        "max": snap.get("max", 0.0),
        "delta": snap.get("count", 0) - before,
    }
    print(json.dumps(out))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
