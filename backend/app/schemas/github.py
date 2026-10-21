from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class VerifyGitHubRepoRequest(BaseModel):
    """
    Request model for validating GitHub repository URL.
    """
    repo_url: str = Field(
        ...,
        min_length=5,
        max_length=255,
        examples=["https://github.com/torvalds/linux"],
        description="Đường dẫn repository GitHub (vd: https://github.com/owner/repo hoặc đuôi .git)",
    )
    branch: Optional[str] = Field(
        None,
        max_length=64,
        description="Tên nhánh (tùy chọn).",
    )


class VerifyGitHubRepoResponse(BaseModel):
    """
    Response model returning validated GitHub repository metadata.
    """
    repo_url: str
    owner: str
    repo: str
    branch: Optional[str] = None
    commit_sha: Optional[str] = Field(
        None, description="Trường lưu trữ tương thích ngược (luôn là None sau khi bỏ cơ chế Commit SHA)"
    )
    commit_message: Optional[str] = Field(None, description="Tiêu đề commit (nếu có)")
    author: Optional[str] = Field(None, description="Tên tác giả (nếu có)")
    committed_at: Optional[datetime] = Field(None, description="Thời điểm (nếu có)")
    html_url: Optional[str] = Field(None, description="Link repository trên GitHub")
    status: str = Field(
        "submitted",
        description="Trạng thái xác thực: 'submitted'",
    )
    error_code: Optional[str] = Field(
        None,
        description="Mã lỗi nghiệp vụ (nếu có)",
    )
    retry_attempts: int = Field(
        0,
        ge=0,
        description="Số lần gọi thử API (0 khi chỉ kiểm tra định dạng URL nội bộ)",
    )
    is_verified: bool = Field(..., description="True nếu xác thực định dạng URL hợp lệ")
    is_fallback: bool = Field(
        False,
        description="Cờ tương thích ngược",
    )
    message: str = Field(..., description="Thông báo chi tiết kết quả xác thực")


class GitHubFreezeResult(BaseModel):
    """
    Internal result schema used by Checkpoint & Submission services.
    """
    freeze_required: bool = False
    should_freeze: bool = False
    commit_sha: Optional[str] = None
    repo_url: Optional[str] = None
    status: str = "submitted"
    error_code: Optional[str] = None
    commit_message: Optional[str] = None
    author: Optional[str] = None
    committed_at: Optional[datetime] = None
    retry_attempts: int = 0
    is_fallback: bool = False
    incident_note: Optional[str] = None
