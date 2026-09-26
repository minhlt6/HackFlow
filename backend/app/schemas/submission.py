from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict, HttpUrl


class FinalSubmissionRequest(BaseModel):
    github_url: Optional[str] = None
    repo_url: Optional[str] = None
    commit_sha: Optional[str] = None
    demo_video_url: Optional[str] = None
    demo_url: Optional[str] = None
    video_url: Optional[str] = None
    slide_pdf_url: Optional[str] = None
    slide_url: Optional[str] = None
    description: Optional[str] = None


class FinalSubmissionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    team_id: str
    submitted_by: str
    github_url: str
    github_repo_owner: str
    github_repo_name: str
    frozen_commit_sha: Optional[str] = None
    latest_commit_sha: Optional[str] = None
    has_post_deadline_changes: bool
    demo_video_url: Optional[str] = None
    slide_pdf_url: Optional[str] = None
    description: Optional[str] = None
    submitted_at: datetime
    updated_at: datetime
    version: int
