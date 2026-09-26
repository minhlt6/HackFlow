from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class CheckpointCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    open_at: datetime
    close_at: datetime
    display_order: int = 0
    is_required: bool = True
    points: float = 10.0
    late_penalty: float = 2.0
    block_enabled: bool = False
    block_threshold: int = 2
    required_fields: List[str] = ["repo_url"]


class CheckpointUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    open_at: Optional[datetime] = None
    close_at: Optional[datetime] = None
    display_order: Optional[int] = None
    is_required: Optional[bool] = None
    points: Optional[float] = None
    late_penalty: Optional[float] = None
    block_enabled: Optional[bool] = None
    block_threshold: Optional[int] = None
    required_fields: Optional[List[str]] = None


class CheckpointSubmitRequest(BaseModel):
    submission_url: str
    note: Optional[str] = None
    custom_fields: Optional[Dict[str, Any]] = None


class CheckpointSubmissionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    checkpoint_id: str
    team_id: str
    submitted_by: str
    submission_url: str
    note: Optional[str] = None
    custom_fields: Dict[str, Any] = {}
    score_awarded: Optional[float] = None
    is_late: bool = False
    version: int
    submitted_at: datetime
    is_latest: bool


class CheckpointResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: Optional[str] = None
    open_at: datetime
    close_at: datetime
    display_order: int
    is_required: bool
    points: float = 10.0
    late_penalty: float = 2.0
    block_enabled: bool = False
    block_threshold: int = 2
    required_fields: List[str] = ["repo_url"]
    status: str = "locked"  # 'locked', 'open', 'closed', 'submitted'
    latest_submission: Optional[CheckpointSubmissionResponse] = None
