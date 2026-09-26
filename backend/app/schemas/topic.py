from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class SubtopicCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    sample_data_url: Optional[str] = None
    reference_links: List[str] = []
    max_teams: int = 3
    display_order: int = 0


class TopicCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    display_order: int = 0


class TopicUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    display_order: Optional[int] = None
    is_active: Optional[bool] = None


class SubtopicUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    sample_data_url: Optional[str] = None
    reference_links: Optional[List[str]] = None
    max_teams: Optional[int] = None
    display_order: Optional[int] = None
    is_active: Optional[bool] = None


class SubtopicResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    topic_id: str
    name: str
    description: Optional[str] = None
    sample_data_url: Optional[str] = None
    reference_links: List[str] = []
    max_teams: int
    current_registered_count: int
    display_order: int
    is_active: bool
    mentor_names: List[str] = []


class TopicResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: Optional[str] = None
    display_order: int
    is_active: bool
    subtopics: List[SubtopicResponse] = []


class SelectTopicRequest(BaseModel):
    subtopic_id: str


class SubtopicStatsResponse(BaseModel):
    topic_id: str
    topic_name: str
    subtopic_id: str
    subtopic_name: str
    max_teams: int
    current_registered_count: int
    status: str  # 'available', 'almost_full', 'full', 'empty'
    registered_teams: List[dict] = []
