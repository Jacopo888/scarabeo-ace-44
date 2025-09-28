from __future__ import annotations
import os
import sys
import logging
import os.path as _p

# Configure logging to stderr (kept here so all modules share same setup)
logging.basicConfig(stream=sys.stderr, level=logging.INFO, format='[%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

# Environment flags
ENV_MODE = os.getenv("ENV", "").lower()
SKIP_LEXICON_CHECK = os.getenv("QUACKLE_SKIP_LEXICON_CHECK", "").strip().lower() in {"1","true","yes","on"}

# CORS from env (comma-separated) → list
ALLOW_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]

# Runtime configuration (volume-first)
LEXICON_NAME = os.getenv("LEXICON_NAME", os.getenv("QUACKLE_LEXICON", "enable1.15").strip()).strip()
LEXDIR = os.getenv("QUACKLE_LEXDIR", "/data/lexica").strip()
APPDATA = os.getenv("QUACKLE_APPDATA_DIR", "/data/appdata").strip()
TIMEOUT_MS = int(os.getenv("QUACKLE_TIMEOUT_MS", "8000"))

BRIDGE_BIN = os.getenv(
    "QUACKLE_BRIDGE_BIN",
    _p.abspath(_p.join(_p.dirname(__file__), "..", "bridge", "engine_wrapper"))
).strip()

# Canonical names used by native bridge
QUACKLE_LEXICON = LEXICON_NAME
QUACKLE_LEXDIR = LEXDIR

DEBUG_ENABLE_LDD = os.getenv("DEBUG_ENABLE_LDD", "").strip().lower() in {"1", "true", "yes", "y", "on", "dev"}
BRIDGE_TIMEOUT_MS = TIMEOUT_MS
