from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os, logging

# Prova ad importare i binding Python di Quackle
try:
    import quackle
    HAVE_QUACKLE = True
except Exception:
    HAVE_QUACKLE = False

app = FastAPI()
ORIGINS = os.getenv("CORS_ORIGINS", "https://preview--scarabeo-ace-44.lovable.app").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Config
LEXICON = os.getenv("QUACKLE_LEXICON", "en-enable")   # ENABLE
LAYOUT  = os.getenv("QUACKLE_LAYOUT", "scrabble")     # tavola classica
DIFF_MAP = {"easy": 0, "medium": 300, "hard": 800}

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("quackle-service")

class Tile(BaseModel):
    row: int
    col: int
    letter: str
    points: int | None = None
    isBlank: bool | None = False

class BestMoveRequest(BaseModel):
    board: dict  # es: {"7,7":{"letter":"A","isBlank":False}}
    rack: list[dict]  # es: [{"letter":"A","isBlank":False}, ...]
    difficulty: str = "medium"

def board_to_quackle_format(board: dict):
    g = [[' ']*15 for _ in range(15)]
    for key, tile in board.items():
        r, c = map(int, key.split(','))
        ch = tile.get('letter') or ' '
        g[r][c] = ch.upper()
    return g

def rack_to_quackle_format(rack: list[dict]):
    s = []
    for t in rack:
        if t.get("isBlank"):
            s.append("?")
        else:
            s.append((t.get("letter") or "").upper())
    return "".join(s)

@app.get("/health")
def health():
    return {
        "status": "ok",
        "engine": "quackle" if HAVE_QUACKLE else "mock-missing",
        "lexicon": LEXICON,
        "layout": LAYOUT
    }

@app.post("/best-move")
def best_move(req: BestMoveRequest):
    if not HAVE_QUACKLE:
        return {"tiles": [], "score": 0, "words": [], "move_type": "pass", "note": "quackle not available"}

    try:
        game = quackle.Game()
        game.setLayout(LAYOUT)
        game.setLexicon(LEXICON)

        game.setBoard(board_to_quackle_format(req.board))
        game.setRack(rack_to_quackle_format(req.rack))

        sims = DIFF_MAP.get(req.difficulty, 300)
        if sims > 0:
            mv = game.getBestMove(sims)
        else:
            mv = game.getBestMoveGreedy()

        # mv atteso come dict da Quackle; adattiamo al formato del frontend
        out = {
            "tiles": [],
            "score": mv.get("score", 0),
            "words": mv.get("words", []),
            "move_type": "place"
        }
        for t in mv.get("tiles", []):
            out["tiles"].append({
                "row": t["row"],
                "col": t["col"],
                "letter": t["letter"],
                "points": t.get("points", 0),
                "isBlank": t.get("isBlank", False),
            })
        return out

    except Exception as e:
        log.exception("best_move error")
        return {"error": str(e)}

