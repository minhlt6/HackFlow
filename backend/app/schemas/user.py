from typing import Optional, List
from datetime import date, datetime
from pydantic import BaseModel, EmailStr, ConfigDict


class UserProfileUpdate(BaseModel):
    full_name: str
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    province: Optional[str] = None
    district: Optional[str] = None
    phone: Optional[str] = None
    school: Optional[str] = None
    student_id: Optional[str] = None
    github_username: Optional[str] = None
    skills: List[str] = []
    major_direction: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    github_username: Optional[str] = None
    role: str
    full_name: str
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    province: Optional[str] = None
    district: Optional[str] = None
    phone: Optional[str] = None
    school: Optional[str] = None
    student_id: Optional[str] = None
    skills: List[str] = []
    major_direction: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    is_active: bool
    profile_completed: bool
    approval_status: str = 'approved'
    created_at: datetime
