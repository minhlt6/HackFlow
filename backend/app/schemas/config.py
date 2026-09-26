from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class HackathonConfigUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    logo_url: Optional[str] = None
    banner_url: Optional[str] = None
    rules: Optional[str] = None
    prizes: Optional[List[Dict[str, Any]]] = None
    contact_channels: Optional[Dict[str, Any]] = None
    min_team_size: Optional[int] = None
    max_team_size: Optional[int] = None
    topic_mode: Optional[str] = None
    registration_start: Optional[datetime] = None
    registration_end: Optional[datetime] = None
    topic_selection_deadline: Optional[datetime] = None
    contest_start: Optional[datetime] = None
    contest_end: Optional[datetime] = None
    blind_judging: Optional[bool] = None
    results_published: Optional[bool] = None
    ticket_enabled: Optional[bool] = None


class HackathonConfigResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: Optional[str] = None
    logo_url: Optional[str] = None
    banner_url: Optional[str] = None
    rules: Optional[str] = None
    prizes: List[Dict[str, Any]] = []
    contact_channels: Dict[str, Any] = {}
    min_team_size: int
    max_team_size: int
    topic_mode: str
    registration_start: datetime
    registration_end: datetime
    topic_selection_deadline: Optional[datetime] = None
    contest_start: datetime
    contest_end: datetime
    blind_judging: bool
    results_published: bool
    ticket_enabled: bool


class AnnouncementCreateRequest(BaseModel):
    title: str
    content: str
    cover_url: Optional[str] = None
    is_pinned: bool = False
    is_published: bool = True


class AnnouncementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    created_by: str
    title: str
    content: str
    cover_url: Optional[str] = None
    is_pinned: bool
    is_published: bool
    published_at: Optional[datetime] = None
    created_at: datetime
