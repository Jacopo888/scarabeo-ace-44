import os
import json
import shutil
import subprocess
import pytest

BIN_CANDIDATES = [
    os.getenv("QUACKLE_ENGINE_BIN"),
    shutil.which("quackle_json_wrapper"),
]

@pytest.mark.skipif(all(not c for c in BIN_CANDIDATES), reason="wrapper binary not available")
def test_wrapper_best_move_empty_board():
    bin_path = next(c for c in BIN_CANDIDATES if c)
    payload = {
        "op": "best_move",
        "rack": "AEIRSTZ",
        "board": {},
        "lexicon": os.getenv("QUACKLE_LEXICON", "enable1.15"),
        "strategies": True
    }
    proc = subprocess.run([bin_path], input=json.dumps(payload).encode(), stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=15)
    out = proc.stdout.decode(errors="replace")
    assert proc.returncode == 0, f"non-zero rc: {proc.returncode}\nSTDERR:{proc.stderr.decode(errors='replace')[:500]}\nSTDOUT:{out[:500]}"
    data = json.loads(out)
    assert data.get("status") == "ok"
    assert data.get("move_type") in {"play","pass","exchange"}
