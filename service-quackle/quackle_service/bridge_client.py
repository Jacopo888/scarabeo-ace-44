from __future__ import annotations
import json
import os
import subprocess
from typing import Any, Dict

from .config import APPDATA, QUACKLE_LEXDIR, QUACKLE_LEXICON, BRIDGE_BIN, TIMEOUT_MS, DEBUG_ENABLE_LDD
from .normalization import normalize_rack_flexible, is_coord_map, sanitize_none, normalize_board_for_bridge, grid_to_coordmap
from .runtime import strategy_inventory
from .lib.timeouts import to_subprocess_timeout_s

def call_bridge(payload: Dict[str, Any]) -> Dict[str, Any]:
    try:
        rack_str = normalize_rack_flexible(payload.get("rack"))
        board_in = payload.get("board")
        if isinstance(board_in, dict) and is_coord_map(board_in):
            board_for_bridge = {k: v for k, v in board_in.items() if isinstance(k, str)}  # will be sanitized upstream if needed
        else:
            board_out = normalize_board_for_bridge(board_in)
            grid = board_out["grid"]
            board_for_bridge = grid_to_coordmap(grid)
        bridge_payload: Dict[str, Any] = {
            "rack": rack_str,
            "ruleset": "en",
            "board": board_for_bridge,
        }
        diff = (payload.get("difficulty") or "").strip().lower()
        if diff in {"easy", "medium", "hard"}:
            bridge_payload["difficulty"] = diff
        bridge_payload = sanitize_none(bridge_payload)
        wrapper_payload = {"op": "compute", **bridge_payload}
        stdin_str = json.dumps(wrapper_payload, separators=(",", ":"))

        allow_empty_strategy = os.getenv("ALLOW_EMPTY_STRATEGY") == "1"
        inv = strategy_inventory()
        if not allow_empty_strategy and not inv.get("all_ok", False):
            return {"engine_fallback": True, "error": "strategy_missing", **inv}

        try:
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
            ldd_out = ""
            try:
                ldd = subprocess.run(["ldd", BRIDGE_BIN], capture_output=True, text=True, timeout=3)
                ldd_out = (ldd.stdout or "") + ("\n" + (ldd.stderr or "")).strip()
            except Exception:
                pass
            return {
                "engine_fallback": True,
                "error": f"exec_failed: {e.strerror or str(e)}",
                "ldd": ldd_out[:4000]
            }

        try:
            stderr_output = proc.stderr.decode("utf-8")
        except UnicodeDecodeError:
            stderr_output = proc.stderr.decode("latin-1", errors="replace")
        out_try = proc.stdout.decode("utf-8", errors="replace").strip()
        if proc.returncode != 0:
            try:
                parsed = json.loads(out_try) if out_try else {}
            except Exception:
                parsed = {}
            if isinstance(parsed, dict) and parsed.get("engine_fallback"):
                parsed.setdefault("rc", proc.returncode)
                return parsed
            ldd_out = None
            if DEBUG_ENABLE_LDD:
                try:
                    ldd = subprocess.run(["ldd", BRIDGE_BIN], capture_output=True, text=True, timeout=3)
                    ldd_out = ((ldd.stdout or "") + ("\n" + (ldd.stderr or "")).strip())[:4000]
                except Exception:
                    ldd_out = None
            err = {
                "engine_fallback": True,
                "error": f"bridge_failed_rc={proc.returncode}",
                "rc": proc.returncode,
                "stderr": stderr_output[:4000]
            }
            if ldd_out:
                err["ldd"] = ldd_out
            return err

        if not out_try:
            return {}
        try:
            return json.loads(out_try)
        except json.JSONDecodeError as e:
            return {"engine_fallback": True, "error": f"json_decode_error: {e}"}
    except Exception as e:
        return {"engine_fallback": True, "error": str(e)}

def call_bridge_simple_op(op: str) -> Dict[str, Any]:
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
