from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Any, List, Optional
from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.team import Team


class JudgingStage(str, Enum):
    NOT_STARTED = "not_started"
    STAGE_1_ZONE = "stage_1_zone"
    STAGE_2_ROOM = "stage_2_room"
    STAGE_3_CROSS_ROOM = "stage_3_cross_room"
    COMPLETED = "completed"


class Room(BaseModel):
    """
    AI Thực Chiến classroom / competition room with its own schedule, manager, and zones.
    """

    __tablename__ = "rooms"

    code: Mapped[str] = mapped_column(
        String(32), unique=True, index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    manager_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    manager_name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    capacity: Mapped[int] = mapped_column(Integer, default=40, nullable=False)
    start_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    judging_stage: Mapped[str] = mapped_column(
        String(32), default=JudgingStage.NOT_STARTED.value, nullable=False
    )
    room_top_n: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    zones: Mapped[List["Zone"]] = relationship(
        back_populates="room", cascade="all, delete-orphan"
    )
    checkpoint_schedules: Mapped[List["RoomCheckpointSchedule"]] = relationship(
        back_populates="room", cascade="all, delete-orphan"
    )
    teams: Mapped[List["Team"]] = relationship(back_populates="room")


class Zone(BaseModel):
    """
    Sub-group (Zone) inside a Room where teams peer-grade each other in Stage 1.
    """

    __tablename__ = "zones"

    room_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("rooms.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    code: Mapped[str] = mapped_column(String(32), nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    max_teams: Mapped[int] = mapped_column(Integer, default=5, nullable=False)

    # Relationships
    room: Mapped["Room"] = relationship(back_populates="zones")
    teams: Mapped[List["Team"]] = relationship(back_populates="zone")


class RoomCheckpointSchedule(BaseModel):
    """
    Per-room custom start_time and deadline override for a global Checkpoint.
    """

    __tablename__ = "room_checkpoint_schedules"
    __table_args__ = (
        UniqueConstraint(
            "room_id", "checkpoint_id", name="uq_room_checkpoint_schedule"
        ),
    )

    room_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("rooms.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    checkpoint_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("checkpoints.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    start_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    deadline: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    room: Mapped["Room"] = relationship(back_populates="checkpoint_schedules")


class PeerEvaluation(BaseModel):
    """
    Team-to-team peer evaluation ballot across the 3 stages:
    - stage_1_zone: teams within the same Zone grade each other -> Top 1 per Zone advances
    - stage_2_room: teams within the same Room grade the Zone Top 1 presenters -> Top 1 or Top 3 per Room advances
    - stage_3_cross_room: cross-room teams grade the Room Top N presenters -> Grand Final ranking
    """

    __tablename__ = "peer_evaluations"
    __table_args__ = (
        UniqueConstraint(
            "stage",
            "evaluator_team_id",
            "target_team_id",
            name="uq_peer_eval_stage_evaluator_target",
        ),
    )

    stage: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    room_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("rooms.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    zone_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("zones.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    evaluator_team_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("teams.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    target_team_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("teams.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    submitted_by: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    criteria_scores: Mapped[Any] = mapped_column(JSON, nullable=False)
    total_score: Mapped[float] = mapped_column(Float, nullable=False)
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
