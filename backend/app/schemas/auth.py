from typing import Optional
from pydantic import BaseModel, Field, field_validator
import re


def _validate_email_loose(v: str) -> str:
    """Validate email loosely — cho phép .local, .test và các TLD nội bộ."""
    v = v.strip().lower()
    if not v or '@' not in v:
        raise ValueError('Email không hợp lệ.')
    local, _, domain = v.partition('@')
    if not local or not domain or '.' not in domain:
        raise ValueError('Email không hợp lệ.')
    return v


class RegisterRequest(BaseModel):
    email: str
    password: str = Field(..., min_length=6, description="Mật khẩu tối thiểu 6 ký tự")
    full_name: str = Field(..., min_length=2, max_length=255)
    student_id: Optional[str] = Field(None, max_length=20)

    @field_validator('email')
    @classmethod
    def validate_email(cls, v: str) -> str:
        return _validate_email_loose(v)


class LoginRequest(BaseModel):
    email: str
    password: str = Field(..., min_length=1)

    @field_validator('email')
    @classmethod
    def validate_email(cls, v: str) -> str:
        return _validate_email_loose(v)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    email: str
    full_name: str
    role: str
    profile_completed: bool


class GitHubAuthURLResponse(BaseModel):
    auth_url: str


class RefreshTokenRequest(BaseModel):
    refresh_token: Optional[str] = None


class DevLoginRequest(BaseModel):
    role: str = Field(
        "admin",
        description="Vai trò muốn đăng nhập: admin, judge, mentor, leader, member, participant",
    )
