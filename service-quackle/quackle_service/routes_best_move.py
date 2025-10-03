from __future__ import annotations
import json
from typing import Any, Dict, List
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse

from .config import ENV_MODE, SKIP_LEXICON_CHECK
from .runtime import ensure_lexicon_ready
from .normalization import normalize_rack_flexible, normalize_board_for_bridge, grid_to_coordmap, reconstruct_tiles_from_raw_move
from .errors import json_error, from_http_exc, status_from_engine_result
from .adapters.quackle import best_move as _adapter_best_move
from .metrics import record_best_move_latency_ms, local_latency_snapshot

router = APIRouter()

@router.post("/best-move")
async def best_move(req: Request):
    try:
        import time as _t
        _start = _t.perf_counter()
        raw = await req.body()
        body = json.loads(raw.decode("utf-8"))
        if "rack" not in body:
            raise HTTPException(status_code=400, detail="invalid_rack_format")

        rack_norm = normalize_rack_flexible(body.get("rack"))
        board_out = normalize_board_for_bridge(body.get("board"))

        if len(rack_norm) == 0:
            out = {"tiles": [], "score": 0, "words": [], "move_type": "pass", "engine_fallback": False}
            # Record as a fast-return (no engine call)
            took_ms = (_t.perf_counter() - _start) * 1000.0
            record_best_move_latency_ms(took_ms, {"path": "/best-move", "outcome": "pass_empty_rack", "rack_len": 0})
            return out

        if ENV_MODE == 'prod' and not SKIP_LEXICON_CHECK:
            ok, dawg, gaddag = ensure_lexicon_ready()
            if not ok:
                raise HTTPException(status_code=500, detail="lexicon_not_ready")

        board_map = grid_to_coordmap(board_out.get("grid"))
        board_is_empty = (not bool(board_map))
        payload: Dict[str, Any] = {"board": (board_map if board_map else {}), "rack": rack_norm}
        diff_raw = (body.get("difficulty") if isinstance(body, dict) else None) or None
        if isinstance(diff_raw, str) and diff_raw.strip().lower() in {"easy", "medium", "hard"}:
            payload["difficulty"] = diff_raw.strip().lower()
        # Bag info: prefer bag_pool (array) and derive bag_count server-side; fall back to legacy bag_count if provided alone
        try:
            bp = body.get("bag_pool") if isinstance(body, dict) else None
            if isinstance(bp, list) and all(isinstance(x, str) and len(x) >= 1 for x in bp):
                norm_pool = [str(x)[:1] for x in bp]
                payload["bag_pool"] = norm_pool
                payload["bag_count"] = len(norm_pool)
            else:
                # Legacy: accept bag_count for compatibility when bag_pool is absent
                bc = body.get("bag_count") if isinstance(body, dict) else None
                if isinstance(bc, int):
                    payload["bag_count"] = bc
        except Exception:
            pass

        result = _adapter_best_move(payload)
        if result.get("engine_fallback") or (isinstance(result, dict) and result.get("error")):
            err = (result.get("error") or "engine_error")
            rc_val = result.get("rc") if isinstance(result, dict) else None
            status = status_from_engine_result(err, rc_val if isinstance(rc_val, int) else None)
            if len(rack_norm) < 7:
                out = {"tiles": [], "score": 0, "words": [], "move_type": "pass", "engine_fallback": False}
                took_ms = (_t.perf_counter() - _start) * 1000.0
                record_best_move_latency_ms(took_ms, {"path": "/best-move", "outcome": "pass_short_rack", "rack_len": len(rack_norm), "err": err, "rc": rc_val})
                return out
            body_out = {k: v for k, v in result.items() if k in {"engine_fallback", "error", "stderr", "ldd", "rc"}}
            took_ms = (_t.perf_counter() - _start) * 1000.0
            record_best_move_latency_ms(took_ms, {"path": "/best-move", "outcome": "engine_error", "rack_len": len(rack_norm), "err": err, "rc": rc_val})
            return json_error(err, status_code=status, engine=True, extra=body_out or None)

        # Prefer tiles provided directly by the bridge. Only reconstruct from raw_move if tiles are missing.
        tiles_out = result.get("tiles", [])
        raw_move = result.get("raw_move") if isinstance(result, dict) else None
        if (not tiles_out) and isinstance(raw_move, dict):
            rebuilt = reconstruct_tiles_from_raw_move(raw_move, result.get("words"))
            if rebuilt:
                tiles_out = rebuilt

        # Centralized normalization of tile coordinates (0-based, 15x15)
        def _normalize_tiles_0based(tiles: list[dict], empty_board: bool) -> list[dict]:
            if not isinstance(tiles, list):
                return []
            # 1) force ints and drop malformed
            norm: list[dict] = []
            for t in tiles:
                try:
                    r = int(t.get("row"))
                    c = int(t.get("col"))
                except Exception:
                    continue
                norm.append({**t, "row": r, "col": c})
            if not norm:
                return []
            # 2) If span sfora, shifta indietro per rientrare (no wrap)
            rows = [t["row"] for t in norm]
            cols = [t["col"] for t in norm]
            minr, maxr = min(rows), max(rows)
            minc, maxc = min(cols), max(cols)
            dr = 0
            dc = 0
            if maxr > 14: dr = max(0, maxr - 14)
            if maxc > 14: dc = max(0, maxc - 14)
            if minr < 0: dr = min(dr, minr)  # minr is negative → shift up by -minr later
            if minc < 0: dc = min(dc, minc)
            # Applica shift correttivo
            tmp = []
            for t in norm:
                rr = t["row"] - (dr if dr > 0 else 0)
                cc = t["col"] - (dc if dc > 0 else 0)
                tmp.append({**t, "row": rr, "col": cc})
            norm = tmp
            # 3) Clamp finale e drop out-of-bounds
            norm = [t for t in norm if 0 <= t["row"] < 15 and 0 <= t["col"] < 15]
            if not norm:
                return []
            # 4) Optional: micro-centering della prima mossa (se copre il centro lungo l'asse)
            if empty_board:
                rows = [t["row"] for t in norm]
                cols = [t["col"] for t in norm]
                CENTER = 7
                if len(set(rows)) == 1 and any(c == CENTER for c in cols):
                    r0 = rows[0]
                    shift = CENTER - r0
                    if shift:
                        cand = [{**t, "row": t["row"] + shift} for t in norm]
                        if all(0 <= tt["row"] < 15 for tt in cand):
                            norm = cand
                elif len(set(cols)) == 1 and any(r == CENTER for r in rows):
                    c0 = cols[0]
                    shift = CENTER - c0
                    if shift:
                        cand = [{**t, "col": t["col"] + shift} for t in norm]
                        if all(0 <= tt["col"] < 15 for tt in cand):
                            norm = cand
            return norm

        tiles_out = _normalize_tiles_0based(tiles_out, board_is_empty and result.get("move_type") == "play")

        out = {
            "tiles": tiles_out,
            "score": result.get("score", 0),
            "words": result.get("words", []),
            "move_type": result.get("move_type", "play" if result.get("tiles") else "pass"),
            "engine_fallback": False
        }
        # Pass through engine telemetry if provided by the bridge
        try:
            eng_info = result.get("engine_info") if isinstance(result, dict) else None
            if isinstance(eng_info, dict):
                out["engine_info"] = eng_info
        except Exception:
            pass
        took_ms = (_t.perf_counter() - _start) * 1000.0
        record_best_move_latency_ms(took_ms, {"path": "/best-move", "outcome": out.get("move_type", "play"), "rack_len": len(rack_norm)})
        return out
    except HTTPException as e:
        return from_http_exc(e, engine=True)
    except Exception as e:
        try:
            raw = await req.body()
            raw_head = raw[:400].decode("utf-8", errors="replace")
        except Exception:
            raw_head = ""
        try:
            import time as _t
            took_ms = (_t.perf_counter() - _start) * 1000.0  # type: ignore[name-defined]
            record_best_move_latency_ms(took_ms, {"path": "/best-move", "outcome": "exception"})
        except Exception:
            pass
        return json_error(str(e), status_code=500, engine=True, extra={"raw_head": raw_head})

@router.get("/debug/latency")
def debug_latency_snapshot():
    """Return local latency percentiles for /best-move.

    Useful in CI or local debugging when OTel backend is not configured.
    """
    return JSONResponse(local_latency_snapshot())

@router.post("/bag/summary")
async def bag_summary(req: Request):
    try:
        raw = await req.body()
        body = json.loads(raw.decode("utf-8")) if raw else {}
        from .models import BagSummaryRequest
        try:
            dto = BagSummaryRequest(**body)
        except Exception:
            dto = None
        rack_norm = normalize_rack_flexible((dto.rack if dto else body.get("rack")))
        board_out = normalize_board_for_bridge((dto.board if dto else body.get("board")))

        # Distribution helpers (inline to avoid an extra module)
        def _english_tile_distribution():
            return {
                'A': 9, 'B': 2, 'C': 2, 'D': 4, 'E': 12, 'F': 2, 'G': 3, 'H': 2, 'I': 9,
                'J': 1, 'K': 1, 'L': 4, 'M': 2, 'N': 6, 'O': 8, 'P': 2, 'Q': 1, 'R': 6,
                'S': 4, 'T': 6, 'U': 4, 'V': 2, 'W': 2, 'X': 1, 'Y': 2, 'Z': 1, '?': 2
            }
        def _merge_distribution_override(base, override):
            if not isinstance(override, dict):
                return dict(base)
            out = dict(base)
            import re as _re
            for k, v in override.items():
                if not isinstance(k, str) or len(k) != 1:
                    continue
                K = k.upper()
                if K in {'*', '.'}:
                    K = '?'
                if _re.fullmatch(r"[A-Z\?]", K) is None:
                    continue
                try:
                    n = int(v)
                except Exception:
                    continue
                out[K] = max(0, n)
            return out
        def _count_unseen(grid: List[str], rack: str, dist: Dict[str, int]):
            remain: Dict[str, int] = {k: int(v) for k, v in dist.items()}
            import re as _re
            for row in grid:
                if not isinstance(row, str):
                    continue
                for ch in row:
                    if ch == '.':
                        continue
                    if ch in {'?', '*'}:
                        remain['?'] = max(0, remain.get('?', 0) - 1)
                    else:
                        L = str(ch).upper()[:1]
                        if _re.fullmatch(r"[A-Z]", L):
                            remain[L] = max(0, remain.get(L, 0) - 1)
            for ch in str(rack or '').upper():
                K = '?' if ch in {'?', '*'} else ch
                if _re.fullmatch(r"[A-Z\?]", K):
                    remain[K] = max(0, remain.get(K, 0) - 1)
            total_left = sum(remain.values())
            return total_left, remain

        base = _english_tile_distribution()
        dist = _merge_distribution_override(base, (dto.distribution if dto else body.get("distribution")))
        unseen_count, unseen_by_letter = _count_unseen(board_out["grid"], rack_norm, dist)

        opp_raw = (dto.opponent_rack if dto else (body.get("opponent_rack") if isinstance(body, dict) else None))
        if opp_raw is None and isinstance(body, dict):
            opp_raw = body.get("opponentRack")
        opp_rack = normalize_rack_flexible(opp_raw)

        bag_by_letter = dict(unseen_by_letter)
        import re as _re
        if opp_rack:
            for ch in opp_rack:
                K = '?' if ch in {'?', '*'} else ch
                if _re.fullmatch(r"[A-Z\?]", K):
                    bag_by_letter[K] = max(0, bag_by_letter.get(K, 0) - 1)
        bag_count = sum(int(v) for v in bag_by_letter.values())
        order = [chr(c) for c in range(ord('A'), ord('Z') + 1)] + ['?']
        unseen_pool: List[str] = []
        bag_pool: List[str] = []
        for k in order:
            u = int(unseen_by_letter.get(k, 0))
            b = int(bag_by_letter.get(k, 0))
            if u > 0:
                unseen_pool.extend([k] * u)
            if b > 0:
                bag_pool.extend([k] * b)
        return {
            "remaining_count": unseen_count,
            "remaining_by_letter": unseen_by_letter,
            "pool": unseen_pool,
            "unseen_count": unseen_count,
            "unseen_by_letter": unseen_by_letter,
            "unseen_pool": unseen_pool,
            "bag_count": bag_count,
            "bag_by_letter": bag_by_letter,
            "bag_pool": bag_pool,
        }
    except HTTPException as e:
        return from_http_exc(e, engine=False)
    except Exception as e:
        return json_error(str(e), status_code=500, engine=False)
