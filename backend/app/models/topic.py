import uuid
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.base import GUID, JSONList


class Topic(Base):
    __tablename__ = "topics"

    id: Mapped[str] = mapped_column(GUID, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    subtopics = relationship("Subtopic", back_populates="topic", cascade="all, delete-orphan")


class Subtopic(Base):
    __tablename__ = "subtopics"

    id: Mapped[str] = mapped_column(GUID, primary_key=True, default=lambda: str(uuid.uuid4()))
    topic_id: Mapped[str] = mapped_column(
        GUID, ForeignKey("topics.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    sample_data_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    reference_links: Mapped[list] = mapped_column(JSONList, default=list, nullable=False)
    max_teams: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    current_registered_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    topic = relationship("Topic", back_populates="subtopics")
    mentors = relationship("TopicMentor", back_populates="subtopic", cascade="all, delete-orphan")
    selections = relationship("TeamTopicSelection", back_populates="subtopic")


class TopicMentor(Base):
    __tablename__ = "topic_mentors"
    __table_args__ = (UniqueConstraint("subtopic_id", "mentor_id", name="uq_subtopic_mentor"),)

    id: Mapped[str] = mapped_column(GUID, primary_key=True, default=lambda: str(uuid.uuid4()))
    subtopic_id: Mapped[str] = mapped_column(
        GUID, ForeignKey("subtopics.id", ondelete="CASCADE"), nullable=False
    )
    mentor_id: Mapped[str] = mapped_column(
        GUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    subtopic = relationship("Subtopic", back_populates="mentors")
    mentor = relationship("User")


class TeamTopicSelection(Base):
    __tablename__ = "team_topic_selection"

    id: Mapped[str] = mapped_column(GUID, primary_key=True, default=lambda: str(uuid.uuid4()))
    team_id: Mapped[str] = mapped_column(
        GUID, ForeignKey("teams.id", ondelete="CASCADE"), unique=True, index=True, nullable=False
    )
    subtopic_id: Mapped[str] = mapped_column(
        GUID, ForeignKey("subtopics.id", ondelete="RESTRICT"), index=True, nullable=False
    )
    selected_by: Mapped[str] = mapped_column(
        GUID, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    selected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    team = relationship("Team", back_populates="topic_selection")
    subtopic = relationship("Subtopic", back_populates="selections")
    user = relationship("User")


class TeamProposal(Base):
    __tablename__ = "team_proposals"

    id: Mapped[str] = mapped_column(GUID, primary_key=True, default=lambda: str(uuid.uuid4()))
    team_id: Mapped[str] = mapped_column(
        GUID, ForeignKey("teams.id", ondelete="CASCADE"), unique=True, index=True, nullable=False
    )
    submitted_by: Mapped[str] = mapped_column(
        GUID, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    problem_statement: Mapped[str] = mapped_column(Text, nullable=False)
    proposed_solution: Mapped[str] = mapped_column(Text, nullable=False)
    tech_stack: Mapped[list] = mapped_column(JSONList, default=list, nullable=False)
    expected_outcome: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="draft", index=True, nullable=False)
    btc_feedback: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    assigned_mentor_id: Mapped[Optional[str]] = mapped_column(
        GUID, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    submitted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    reviewed_by: Mapped[Optional[str]] = mapped_column(
        GUID, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    team = relationship("Team")
