from __future__ import annotations
import os
import re
import hashlib
import shutil
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from .config import LEXDIR, APPDATA, LEXICON_NAME, ENV_MODE

REQ_STRATEGY: List[tuple[str, str]] = [
    ("default_english", "syn2"),
    ("default_english", "vcplace"),
    ("default_english", "superleaves"),
    ("default_english", "worths"),
    ("default", "bogowin"),
]

def _hash_sha256(path: Path) -> Optional[str]:
    try:
        h = hashlib.sha256()
        with path.open("rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                h.update(chunk)
        return h.hexdigest()
    except Exception:
        return None

def _stat_strategy_file(p: Path) -> Dict[str, Any]:
    try:
        if p.exists() and p.is_file():
            st = p.stat()
            return {
                "exists": True,
                "path": str(p),
                "size": st.st_size,
                "sha256": _hash_sha256(p),
                "mode": oct(st.st_mode & 0o777),
            }
        else:
            return {"exists": False, "path": str(p)}
    except Exception as e:
        return {"exists": False, "path": str(p), "error": str(e)}

def strategy_inventory(base: Optional[Path] = None) -> Dict[str, Any]:
    base = base or (Path(APPDATA) / "strategy")
    items: Dict[str, Any] = {}
    for d, f in REQ_STRATEGY:
        p = base / d / f
        items[f"{d}/{f}"] = _stat_strategy_file(p)
    all_ok = all(v.get("exists") and (v.get("size") or 0) > 0 for v in items.values())
    return {"strategy": items, "all_ok": all_ok, "base": str(base)}

def lex_paths() -> tuple[str, str]:
    base = os.path.normpath(LEXDIR)
    dawg = os.path.join(base, f"{LEXICON_NAME}.dawg")
    gaddag = os.path.join(base, f"{LEXICON_NAME}.gaddag")
    return dawg, gaddag

def ensure_lexicon_ready() -> tuple[bool, str, str]:
    lexicon_name = os.getenv("LEXICON_NAME", os.getenv("QUACKLE_LEXICON", "enable1.15").strip()).strip()
    lexdir = os.getenv("QUACKLE_LEXDIR", "/data/lexica").strip()
    skip = os.getenv("QUACKLE_SKIP_LEXICON_CHECK", "").strip().lower() in {"1","true","yes","on"}
    base = os.path.normpath(lexdir)
    dawg = os.path.join(base, f"{lexicon_name}.dawg")
    gaddag = os.path.join(base, f"{lexicon_name}.gaddag")
    try:
        ok = (os.path.isfile(dawg) and os.path.getsize(dawg) > 0 and
              os.path.isfile(gaddag) and os.path.getsize(gaddag) > 0)
    except Exception:
        ok = False
    if not ok and (skip or (ENV_MODE and ENV_MODE.lower() in {"test", "dev", "development"})):
        return True, dawg, gaddag
    return ok, dawg, gaddag

from urllib.request import urlopen

def _download_to(url: str, dest: Path, timeout: int = 60) -> tuple[bool, Optional[str]]:
    try:
        tmp = dest.with_suffix(dest.suffix + ".part")
        tmp.parent.mkdir(parents=True, exist_ok=True)
        with urlopen(url, timeout=timeout) as r, open(tmp, "wb") as f:
            chunk = r.read(8192)
            while chunk:
                f.write(chunk)
                chunk = r.read(8192)
        tmp.replace(dest)
        return True, None
    except Exception as e:
        return False, str(e)

def ensure_lexicon_files() -> Dict[str, Any]:
    gaddag_url = os.getenv("GADDAG_URL", "").strip()
    dawg_url = os.getenv("DAWG_URL", "").strip()
    dawg_path_str, gaddag_path_str = lex_paths()
    dawg_p = Path(dawg_path_str)
    gaddag_p = Path(gaddag_path_str)
    errs: List[str] = []

    Path(LEXDIR).mkdir(parents=True, exist_ok=True)
    Path(APPDATA).mkdir(parents=True, exist_ok=True)

    if dawg_url:
        ok, err = _download_to(dawg_url, dawg_p)
        if not ok:
            errs.append(f"dawg_download_failed: {err}")
    if gaddag_url:
        ok, err = _download_to(gaddag_url, gaddag_p)
        if not ok:
            errs.append(f"gaddag_download_failed: {err}")

    dawg_sz = dawg_p.stat().st_size if dawg_p.exists() else 0
    gaddag_sz = gaddag_p.stat().st_size if gaddag_p.exists() else 0
    ok = (dawg_sz > 0 and gaddag_sz > 0)

    return {
        "ok": ok,
        "dawg_path": str(dawg_p),
        "gaddag_path": str(gaddag_p),
        "dawg_size": dawg_sz,
        "gaddag_size": gaddag_sz,
        "errors": errs,
    }

def ensure_strategy_files() -> Dict[str, Any]:
    candidates: List[Path] = []
    env_src = os.getenv("QUACKLE_STRATEGY_SRC", "").strip()
    if env_src:
        candidates.append(Path(env_src).resolve())
    candidates.append(Path("/usr/share/quackle/data/strategy").resolve())
    src_base = next((c for c in candidates if c.exists()), candidates[0])
    dest_base = Path(APPDATA) / "strategy"
    required: Dict[str, List[str]] = {
        "default": ["bogowin"],
        "default_english": ["syn2", "vcplace", "superleaves", "worths"],
    }
    result: Dict[str, Any] = {
        "ok": False,
        "src": str(src_base),
        "dest": str(dest_base),
        "files": {},
        "errors": [],
    }

    if not src_base.exists():
        result["errors"].append("strategy_src_missing")
        return result

    try:
        shutil.copytree(src_base, dest_base, dirs_exist_ok=True)
    except Exception as e:
        result["errors"].append(f"copy_failed:{e}")

    missing: List[str] = []
    for subset, names in required.items():
        for name in names:
            key = f"{subset}/{name}"
            target = dest_base / subset / name
            exists = target.exists() and target.is_file()
            size = target.stat().st_size if exists else 0
            is_ready = exists and size > 0
            result["files"][key] = {"exists": is_ready, "size": size}
            if not is_ready:
                missing.append(key)

    if missing:
        result["errors"].append("missing:" + ",".join(missing))

    result["ok"] = not result["errors"]
    return result
