from __future__ import annotations
import json
from typing import Any, Dict, List
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse

from .config import ENV_MODE, SKIP_LEXICON_CHECK
from .runtime import ensure_lexicon_ready
from .normalization import normalize_rack_flexible, normalize_board_for_bridge, grid_to_coordmap, is_coord_map, sanitize_none
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
        original_board_in = body.get("board")
        board_out = normalize_board_for_bridge(original_board_in)

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

        # Keep coordinate-map as provided (preserve blanks and assigned letters).
        if isinstance(original_board_in, dict) and is_coord_map(original_board_in):
            board_map = {k: v for k, v in original_board_in.items() if isinstance(k, str)}
        else:
            board_map = grid_to_coordmap(board_out.get("grid"))
        board_map = sanitize_none(board_map or {})
        payload: Dict[str, Any] = {"board": board_map, "rack": rack_norm}
        diff_raw = (body.get("difficulty") if isinstance(body, dict) else None) or None
        if isinstance(diff_raw, str) and diff_raw.strip().lower() in {"easy", "medium", "hard"}:
            payload["difficulty"] = diff_raw.strip().lower()

        try:
            top_n = int(body.get("top_n", 1))
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="invalid_input")
        if top_n < 1 or top_n > 10:
            raise HTTPException(status_code=400, detail="invalid_input")
        payload["top_n"] = top_n
        
        # Optional: pass-through bag_pool (list of single-letter strings, '?' for blanks)
        # bag_count is now derived internally from bag_pool length when needed
        try:
            bp = body.get("bag_pool") if isinstance(body, dict) else None
            if isinstance(bp, list) and all(isinstance(x, str) and len(x) >= 1 for x in bp):
                payload["bag_pool"] = [str(x)[:1] for x in bp]
                payload["bag_count"] = len(payload["bag_pool"])
        except Exception:
            pass

        result = _adapter_best_move(payload)
        # Nessun fallback artificiale: in caso di errore del motore, esponi l'errore
        if result.get("engine_fallback") or (isinstance(result, dict) and result.get("error")):
            err = (result.get("error") or "engine_error")
            rc_val = result.get("rc") if isinstance(result, dict) else None
            status = status_from_engine_result(err, rc_val if isinstance(rc_val, int) else None)
            took_ms = (_t.perf_counter() - _start) * 1000.0
            record_best_move_latency_ms(took_ms, {"path": "/best-move", "outcome": "engine_error", "rack_len": len(rack_norm), "err": err, "rc": rc_val})
            return json_error(err, status_code=status, engine=True, extra={k: v for k, v in result.items() if k in {"engine_fallback", "error", "stderr", "ldd", "rc"}})

        # Usa direttamente le tiles restituite dal bridge; nessuna ricostruzione raw_move
        tiles_out = result.get("tiles", []) or []
        # Normalizza solo numeri e bounds; nessun "snap to center"
        def _normalize_tiles_0based(tiles: list[dict]) -> list[dict]:
            if not isinstance(tiles, list):
                return []
            out: list[dict] = []
            for t in tiles:
                try:
                    r = int(t.get("row")); c = int(t.get("col"))
                except Exception:
                    continue
                if 0 <= r < 15 and 0 <= c < 15:
                    out.append({**t, "row": r, "col": c})
            return out
        tiles_out = _normalize_tiles_0based(tiles_out)

        # Opening normalization (requested): if original board was empty (coord map {})
        # and this is the first play, force tiles to pass through the center line.
        # We record whether we changed coordinates so we can recompute score.
        opening_adjusted = False
        try:
            if isinstance(original_board_in, dict) and len(original_board_in) == 0 and tiles_out:
                rows = {t.get('row') for t in tiles_out if isinstance(t, dict)}
                cols = {t.get('col') for t in tiles_out if isinstance(t, dict)}
                is_single = len(rows) == 1 and len(cols) == 1
                spans_cols = len(cols) > 1 and len(rows) == 1  # horizontal
                spans_rows = len(rows) > 1 and len(cols) == 1  # vertical
                if is_single:
                    for t in tiles_out:
                        t['row'] = 7
                        t['col'] = 7
                    opening_adjusted = True
                elif spans_cols:
                    for t in tiles_out:
                        t['row'] = 7
                    opening_adjusted = True
                elif spans_rows:
                    for t in tiles_out:
                        t['col'] = 7
                    opening_adjusted = True
                else:
                    for t in tiles_out:
                        t['row'] = 7
                    opening_adjusted = True
        except Exception:
            pass

        # Semplificazione del tipo di mossa
        declared = (result.get("move_type") if isinstance(result, dict) else None) or ""
        move_type = "play" if tiles_out else ("exchange" if declared == "exchange" else "pass")
        words_out = (result.get("words") if isinstance(result, dict) else []) if move_type == "play" else []
        score_out = result.get("score", 0) if move_type == "play" else 0

        # Recalculate score if we adjusted opening coordinates.
        if move_type == "play" and opening_adjusted and tiles_out:
            try:
                # Letter / word multiplier layout (English standard). Duplication kept localized.
                letter_m = [
                    [1,1,1,2,1,1,1,1,1,1,1,2,1,1,1],
                    [1,1,1,1,1,3,1,1,1,3,1,1,1,1,1],
                    [1,1,1,1,1,1,2,1,2,1,1,1,1,1,1],
                    [2,1,1,1,1,1,1,2,1,1,1,1,1,1,2],
                    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
                    [1,3,1,1,1,3,1,1,1,3,1,1,1,3,1],
                    [1,1,2,1,1,1,2,1,2,1,1,1,2,1,1],
                    [1,1,1,2,1,1,1,1,1,1,1,2,1,1,1],
                    [1,1,2,1,1,1,2,1,2,1,1,1,2,1,1],
                    [1,3,1,1,1,3,1,1,1,3,1,1,1,3,1],
                    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
                    [2,1,1,1,1,1,1,2,1,1,1,1,1,1,2],
                    [1,1,1,1,1,1,2,1,2,1,1,1,1,1,1],
                    [1,1,1,1,1,3,1,1,1,3,1,1,1,1,1],
                    [1,1,1,2,1,1,1,1,1,1,1,2,1,1,1],
                ]
                word_m = [
                    [3,1,1,1,1,1,1,3,1,1,1,1,1,1,3],
                    [1,2,1,1,1,1,1,1,1,1,1,1,1,2,1],
                    [1,1,2,1,1,1,1,1,1,1,1,1,2,1,1],
                    [1,1,1,2,1,1,1,1,1,1,1,2,1,1,1],
                    [1,1,1,1,2,1,1,1,1,1,2,1,1,1,1],
                    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
                    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
                    [3,1,1,1,1,1,1,2,1,1,1,1,1,1,3],
                    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
                    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
                    [1,1,1,1,2,1,1,1,1,1,2,1,1,1,1],
                    [1,1,1,2,1,1,1,1,1,1,1,2,1,1,1],
                    [1,1,2,1,1,1,1,1,1,1,1,1,2,1,1],
                    [1,2,1,1,1,1,1,1,1,1,1,1,1,2,1],
                    [3,1,1,1,1,1,1,3,1,1,1,1,1,1,3],
                ]
                def _lp(letter: str) -> int:
                    L = (letter or '').upper()[:1]
                    if L in {"A","E","I","L","N","O","R","S","T","U"}: return 1
                    if L in {"D","G"}: return 2
                    if L in {"B","C","M","P"}: return 3
                    if L in {"F","H","V","W","Y"}: return 4
                    if L == "K": return 5
                    if L in {"J","X"}: return 8
                    if L in {"Q","Z"}: return 10
                    if L in {"?","*"}: return 0
                    return 1
                word_mult = 1
                base_sum = 0
                for t in tiles_out:
                    r = int(t['row']); c = int(t['col'])
                    if not (0 <= r < 15 and 0 <= c < 15):
                        continue
                    letter = t.get('letter') or ''
                    is_blank = bool(t.get('isBlank'))
                    lp = 0 if is_blank else _lp(letter)
                    base_sum += lp * letter_m[r][c]
                    word_mult *= word_m[r][c]
                recalculated = base_sum * word_mult
                if recalculated > 0:
                    score_out = recalculated
            except Exception:
                pass
        # Include raw engine metadata without transformation
        raw_move = result.get("raw_move") or {}
        out = {
            "tiles": tiles_out,
            "score": score_out,
            "equity": result.get("equity", score_out) if isinstance(result, dict) else score_out,
            "words": words_out or [],
            "move_type": move_type,
            "engine_fallback": False,
            "start_row": raw_move.get("row"),
            "start_col": raw_move.get("col"),
            "direction": raw_move.get("dir"),
            "word": raw_move.get("word")
        }
        if opening_adjusted:
            out["opening_adjusted"] = True
        # Pass through engine telemetry if provided by the bridge
        try:
            eng_info = result.get("engine_info") if isinstance(result, dict) else None
            if isinstance(eng_info, dict):
                out["engine_info"] = eng_info
        except Exception:
            pass
        try:
            moves_in = result.get("moves") if isinstance(result, dict) else None
            if isinstance(moves_in, list):
                moves_out = []
                for move in moves_in:
                    if not isinstance(move, dict):
                        continue
                    normalized = dict(move)
                    if isinstance(normalized.get("tiles"), list):
                        normalized["tiles"] = _normalize_tiles_0based(normalized.get("tiles") or [])
                    moves_out.append(normalized)
                out["moves"] = moves_out
        except Exception:
            pass
        # Passa info exchange se presenti
        try:
            if move_type == "exchange":
                if "exchange_count" in result:
                    out["exchange_count"] = int(result.get("exchange_count") or 0)
                if isinstance(result.get("exchange_letters"), list):
                    out["exchange_letters"] = result.get("exchange_letters")
                if isinstance(result.get("exchange_blind"), bool):
                    out["exchange_blind"] = result.get("exchange_blind")
        except Exception:
            pass

        took_ms = (_t.perf_counter() - _start) * 1000.0
        record_best_move_latency_ms(took_ms, {"path": "/best-move", "outcome": move_type, "rack_len": len(rack_norm)})
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
