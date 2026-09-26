import uuid
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import String, Integer, Float, Boolean, DateTime, ForeignKey, Text, Index, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.base import GUID, JSONList


class Checkpoint(Base):
    __tablename__ = "checkpoints"

    id: Mapped[str] = mapped_column(GUID, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    open_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    close_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_required: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Hệ thống điểm mốc & quy chế nộp muộn
    points: Mapped[float] = mapped_column(Float, default=10.0, nullable=False)
    late_penalty: Mapped[float] = mapped_column(Float, default=2.0, nullable=False)

    # Cơ chế block tự động khi không nộp nhiều checkpoint liên tiếp
    block_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    block_threshold: Mapped[int] = mapped_column(Integer, default=2, nullable=False)

    # Danh sách các trường dữ liệu bắt buộc nộp (VD: ["repo_url", "slide_url", "idea_summary"])
    required_fields: Mapped[list] = mapped_column(JSONList, default=lambda: ["repo_url"], nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    submissions = relationship(
        "CheckpointSubmission", back_populates="checkpoint", cascade="all, delete-orphan"
    )


class CheckpointSubmission(Base):
    __tablename__ = "checkpoint_submissions"
    __table_args__ = (Index("idx_cp_sub_team_checkpoint", "team_id", "checkpoint_id"),)

    id: Mapped[str] = mapped_column(GUID, primary_key=True, default=lambda: str(uuid.uuid4()))
    checkpoint_id: Mapped[str] = mapped_column(
        GUID, ForeignKey("checkpoints.id", ondelete="CASCADE"), index=True, nullable=False
    )
    team_id: Mapped[str] = mapped_column(
        GUID, ForeignKey("teams.id", ondelete="CASCADE"), index=True, nullable=False
    )
    submitted_by: Mapped[str] = mapped_column(
        GUID, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    submission_url: Mapped[str] = mapped_column(String(500), nullable=False)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Dữ liệu nộp động theo required_fields (VD: slide_url, video_url, project_title, idea_summary...)
    custom_fields: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

    # Điểm ghi nhận cho bài nộp và trạng thái nộp trễ
    score_awarded: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    is_late: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    is_latest: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    checkpoint = relationship("Checkpoint", back_populates="submissions")
    team = relationship("Team", back_populates="checkpoint_submissions")
    user = relationship("User")
