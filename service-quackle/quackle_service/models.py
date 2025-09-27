from __future__ import annotations
from typing import Any, Optional, List
from pydantic import BaseModel, Field, field_validator, ConfigDict
import re


class BoardCell(BaseModel):
    letter: str
    isBlank: bool = False


class BestMoveRequest(BaseModel):
    board: Any
    rack: Any
    difficulty: Optional[str] = Field(default=None)

    @field_validator("difficulty")
    @classmethod
    def _norm_diff(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        s = str(v).strip().lower()
        return s if s in {"easy", "medium", "hard"} else None


class PlacedTile(BaseModel):
    row: int
    col: int
    letter: str
    points: int = 0
    isBlank: bool = False


class BestMoveResponse(BaseModel):
    tiles: List[PlacedTile] = Field(default_factory=list)
    score: int = 0
    words: List[str] = Field(default_factory=list)
    move_type: str = Field(default="pass")
    engine_fallback: bool = False


# Lightweight reusable normalization utilities (opt-in)
class RackString(BaseModel):
    value: str

    @field_validator("value")
    @classmethod
    def _check(cls, v: str) -> str:
        s = str(v or "").replace(" ", "").upper()
        if re.fullmatch(r"[A-Z\?\*]{0,7}", s or "") is None:
            raise ValueError("invalid_rack_format")
        return s


class BagSummaryRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    board: Any
    rack: Any
    opponent_rack: Optional[Any] = Field(default=None, alias="opponentRack")
    distribution: Optional[dict] = None
