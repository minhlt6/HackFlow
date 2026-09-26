import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.base import GUID


class FinalSubmission(Base):
    __tablename__ = "final_submissions"

    id: Mapped[str] = mapped_column(GUID, primary_key=True, default=lambda: str(uuid.uuid4()))
    team_id: Mapped[str] = mapped_column(
        GUID, ForeignKey("teams.id", ondelete="CASCADE"), unique=True, index=True, nullable=False
    )
    submitted_by: Mapped[str] = mapped_column(
        GUID, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    github_url: Mapped[str] = mapped_column(String(500), nullable=False)
    github_repo_owner: Mapped[str] = mapped_column(String(100), nullable=False)
    github_repo_name: Mapped[str] = mapped_column(String(100), nullable=False)
    frozen_commit_sha: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    latest_commit_sha: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    has_post_deadline_changes: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    demo_video_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    slide_pdf_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    team = relationship("Team", back_populates="final_submission")
    user = relationship("User")
