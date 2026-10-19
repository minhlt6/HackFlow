from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.models.support import TicketPriority, TicketStatus

VALID_TICKET_CATEGORIES = {
    "technical",
    "topic_clarification",
    "submission_issue",
    "account_team",
    "other",
}


class TicketCreateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=128)
    content: str = Field(..., min_length=1)
    category: str = Field(default="technical", max_length=64)
    priority: str = Field(default=TicketPriority.NORMAL.value)


class TicketUpdateRequest(BaseModel):
    action: Optional[str] = Field(
        default=None,
        description="accept | update_response | resolve | close | reopen | escalate",
    )
    response: Optional[str] = None
    note: Optional[str] = None
    target_admin_id: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None


class TicketResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    team_id: Optional[str] = None
    user_id: str
    assigned_to: Optional[str] = None
    title: str
    content: str
    category: Optional[str] = None
    priority: str
    status: str
    response: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class TicketListResponse(BaseModel):
    items: List[TicketResponse]
    page: int
    page_size: int
    total: int
