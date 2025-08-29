from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

app = FastAPI()
ORIGINS = os.getenv("CORS_ORIGINS", "https://preview--scarabeo-ace-44.lovable.app").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/best-move")
def best_move(_: dict):
    # MOCK: per sbloccare la preview (poi sostituirai con la vera Quackle)
    return {"tiles": [], "score": 0, "words": [], "move_type": "pass"}
