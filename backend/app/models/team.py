import uuid
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import String, DateTime, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.base import GUID


class Team(Base):
    __tablename__ = "teams"

    id: Mapped[str] = mapped_column(GUID, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="pending", index=True, nullable=False)
    blind_code: Mapped[Optional[str]] = mapped_column(String(20), unique=True, nullable=True)
    invite_code: Mapped[str] = mapped_column(
        String(8), unique=True, index=True,
        default=lambda: __import__('uuid').uuid4().hex[:8].upper(),
        nullable=False,
    )
    created_by: Mapped[str] = mapped_column(
        GUID, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    creator = relationship("User", foreign_keys=[created_by])
    members = relationship(
        "TeamMember", back_populates="team", cascade="all, delete-orphan", lazy="selectin"
    )
    topic_selection = relationship(
        "TeamTopicSelection",
        back_populates="team",
        uselist=False,
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    checkpoint_submissions = relationship(
        "CheckpointSubmission", back_populates="team", cascade="all, delete-orphan"
    )
    final_submission = relationship(
        "FinalSubmission", back_populates="team", uselist=False, cascade="all, delete-orphan"
    )
    evaluations = relationship("Evaluation", back_populates="team", cascade="all, delete-orphan")
    tickets = relationship("SupportTicket", back_populates="team", cascade="all, delete-orphan")


class TeamMember(Base):
    __tablename__ = "team_members"
    __table_args__ = (UniqueConstraint("team_id", "user_id", name="uq_team_user"),)

    id: Mapped[str] = mapped_column(GUID, primary_key=True, default=lambda: str(uuid.uuid4()))
    team_id: Mapped[str] = mapped_column(
        GUID, ForeignKey("teams.id", ondelete="CASCADE"), index=True, nullable=False
    )
    user_id: Mapped[str] = mapped_column(
        GUID, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    role: Mapped[str] = mapped_column(
        String(20), default="member", nullable=False
    )  # 'leader' or 'member'
    status: Mapped[str] = mapped_column(
        String(20), default="pending", nullable=False
    )  # 'pending', 'accepted', 'rejected', 'left'
    invited_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    responded_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    team = relationship("Team", back_populates="members")
    user = relationship("User", back_populates="team_memberships", lazy="selectin")
