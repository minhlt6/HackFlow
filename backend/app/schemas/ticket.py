from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, ConfigDict
from app.schemas.user import UserResponse


class TicketCreateRequest(BaseModel):
    title: str
    description: str
    priority: str = "medium"  # 'low', 'medium', 'high'


class TicketMessageCreateRequest(BaseModel):
    content: str


class TicketMessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    ticket_id: str
    sender_id: str
    content: str
    sent_at: datetime
    sender: Optional[UserResponse] = None


class SupportTicketResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    team_id: Optional[str] = None
    team_name: Optional[str] = None
    created_by: str
    title: str
    description: str
    priority: str
    status: str
    assigned_mentor_id: Optional[str] = None
    assigned_mentor: Optional[UserResponse] = None
    created_at: datetime
    assigned_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    messages: List[TicketMessageResponse] = []
