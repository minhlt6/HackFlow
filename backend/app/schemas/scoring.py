from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class ScoringCriteriaCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    max_score: float = Field(..., gt=0)
    weight: float = Field(..., gt=0, le=1.0)
    display_order: int = 0


class ScoringCriteriaResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: Optional[str] = None
    max_score: float
    weight: float
    display_order: int
    is_active: bool


class EvaluationDetailInput(BaseModel):
    criteria_id: str
    score: float
    note: Optional[str] = None


class EvaluationSubmitRequest(BaseModel):
    team_id: str
    details: List[EvaluationDetailInput]
    general_comment: Optional[str] = None
    is_draft: bool = False


class EvaluationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    judge_id: str
    team_id: str
    total_score: Optional[float] = None
    general_comment: Optional[str] = None
    status: str
    submitted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class LeaderboardEntry(BaseModel):
    rank: int
    team_id: str
    team_name: str
    topic_name: Optional[str] = None
    total_score: float
    evaluations_count: int
