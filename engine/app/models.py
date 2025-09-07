from pydantic import BaseModel, Field, conint, constr
from typing import List, Literal, Optional

Dir = Literal["H", "V"]


class Move(BaseModel):
    word: constr(min_length=1)
    row: conint(ge=0, le=14)
    col: conint(ge=0, le=14)
    dir: Dir
    score: int
    positions: Optional[List[List[int]]] = None


class MoveRequest(BaseModel):
    board: List[List[str]] = Field(..., description="15x15, stringa vuota per casella vuota")
    rack: constr(min_length=0, max_length=15)
    bag: Optional[str] = ""
    turn: Literal["me", "opponent"] = "me"
    limit_ms: conint(ge=100, le=10000) = 1500
    ruleset: str = "it"
    top_n: conint(ge=1, le=50) = 10


class MoveResponse(BaseModel):
    moves: List[Move]
    elapsed_ms: int


