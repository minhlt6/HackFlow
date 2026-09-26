from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, ConfigDict, model_validator
from app.schemas.user import UserResponse


class TeamCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None


class TeamUpdateRequest(BaseModel):
    description: Optional[str] = None


class TransferLeaderRequest(BaseModel):
    new_leader_id: str


class TeamMemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    role: str
    role_in_team: str = ''  # alias cho role, populate bởi validator
    status: str
    invited_at: datetime
    user: Optional[UserResponse] = None

    @model_validator(mode='after')
    def populate_role_in_team(self) -> 'TeamMemberResponse':
        self.role_in_team = self.role
        return self


class TeamResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: Optional[str] = None
    status: str
    blind_code: Optional[str] = None
    invite_code: Optional[str] = None  # C-5 fix
    created_by: str
    leader_id: Optional[str] = None  # THÊM MỚI — populate từ members
    created_at: datetime
    members: List[TeamMemberResponse] = []
    selected_subtopic_id: Optional[str] = None

    @model_validator(mode='after')
    def populate_leader_id(self) -> 'TeamResponse':
        if self.members:
            leader = next((m for m in self.members if m.role == 'leader'), None)
            if leader:
                self.leader_id = leader.user_id
        return self
