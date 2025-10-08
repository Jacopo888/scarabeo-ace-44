import os

ENGINE_BIN = os.getenv("QUACKLE_ENGINE_BIN", "/usr/local/bin/quackle_json_wrapper").strip()
LEXDIR = os.getenv("QUACKLE_LEXDIR", "/data/lexica").strip()
LEXICON = os.getenv("QUACKLE_LEXICON", "enable1.15").strip()
TIMEOUT_MS = int(os.getenv("QUACKLE_TIMEOUT_MS", "8000"))
