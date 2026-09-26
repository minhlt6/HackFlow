"""
Mentor-specific API endpoints.
Prefix: /mentor
Auth: JWT required, role=mentor hoặc admin
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user_payload
from app.models.ticket import SupportTicket
from app.models.topic import TopicMentor, Subtopic, Topic, TeamTopicSelection
from app.models.checkpoint import Checkpoint, CheckpointSubmission
from app.models.team import Team, TeamMember
from app.models.user import User
from app.schemas.common import APIResponse

router = APIRouter(prefix="/mentor", tags=["Mentor"])


# ─── Dependency helper ────────────────────────────────────────────────────────

def require_mentor(payload: dict = Depends(get_current_user_payload)) -> dict:
    """Chỉ cho phép mentor hoặc admin truy cập."""
    if payload.get("role") not in ["mentor", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chỉ Mentor hoặc Admin mới truy cập được khu vực này.",
        )
    return payload


# ─── Endpoint 1: Dashboard stats ─────────────────────────────────────────────

@router.get("/stats", response_model=APIResponse[dict])
async def get_mentor_stats(
    payload: dict = Depends(require_mentor),
    db: AsyncSession = Depends(get_db),
):
    """
    Trả về 3 con số tổng quan cho mentor dashboard:
    - pool_count: Số ticket đang chờ có mentor nhận (status='open')
    - in_progress_count: Số ticket mentor này đang xử lý
    - resolved_count: Số ticket mentor này đã hoàn thành
    """
    mentor_id = payload["sub"]

    pool_count: int = (
        await db.scalar(
            select(func.count(SupportTicket.id)).where(SupportTicket.status == "open")
        )
    ) or 0

    in_progress_count: int = (
        await db.scalar(
            select(func.count(SupportTicket.id)).where(
                SupportTicket.assigned_mentor_id == mentor_id,
                SupportTicket.status == "in_progress",
            )
        )
    ) or 0

    resolved_count: int = (
        await db.scalar(
            select(func.count(SupportTicket.id)).where(
                SupportTicket.assigned_mentor_id == mentor_id,
                SupportTicket.status == "resolved",
            )
        )
    ) or 0

    return APIResponse(
        success=True,
        data={
            "pool_count": pool_count,
            "in_progress_count": in_progress_count,
            "resolved_count": resolved_count,
        },
        message="Lấy thống kê Mentor thành công.",
    )


# ─── Endpoint 2: Đề tài mentor phụ trách ────────────────────────────────────

@router.get("/my-topics", response_model=APIResponse[list])
async def get_my_topics(
    payload: dict = Depends(require_mentor),
    db: AsyncSession = Depends(get_db),
):
    """
    Trả về danh sách subtopics mà mentor này được phân công phụ trách,
    kèm danh sách đội đã chọn từng subtopic.

    Kết quả mỗi item: {subtopic_id, subtopic_name, topic_name, max_teams, teams: [...]}
    """
    mentor_id = payload["sub"]

    # Lấy các TopicMentor assignments của mentor này
    tm_rows = (
        await db.execute(
            select(TopicMentor)
            .where(TopicMentor.mentor_id == mentor_id)
            .options(
                selectinload(TopicMentor.subtopic).selectinload(Subtopic.topic),
                selectinload(TopicMentor.subtopic).selectinload(Subtopic.selections).selectinload(
                    TeamTopicSelection.team
                ).selectinload(Team.members).selectinload(TeamMember.user),
            )
        )
    ).scalars().all()

    result = []
    for tm in tm_rows:
        subtopic = tm.subtopic
        topic = subtopic.topic if subtopic else None

        teams_info = []
        for sel in (subtopic.selections if subtopic else []):
            team = sel.team
            if not team:
                continue
            # Tìm leader
            leader_name = None
            for m in team.members:
                if m.role_in_team == "leader" and m.user:
                    leader_name = m.user.full_name
                    break
                if m.user and not leader_name:
                    leader_name = m.user.full_name  # fallback: first member

            teams_info.append({
                "team_id": team.id,
                "team_name": team.name,
                "leader_name": leader_name or "—",
                "selected_at": sel.selected_at.isoformat() if sel.selected_at else None,
            })

        result.append({
            "subtopic_id": subtopic.id if subtopic else None,
            "subtopic_name": subtopic.name if subtopic else "—",
            "topic_name": topic.name if topic else "—",
            "max_teams": subtopic.max_teams if subtopic else 0,
            "registered_count": subtopic.current_registered_count if subtopic else 0,
            "teams": teams_info,
            "assigned_at": tm.assigned_at.isoformat() if tm.assigned_at else None,
        })

    return APIResponse(
        success=True,
        data=result,
        message=f"Bạn đang phụ trách {len(result)} đề tài.",
    )


# ─── Endpoint 3: Checkpoint overview (trạng thái, không có nội dung) ─────────

@router.get("/checkpoint-overview", response_model=APIResponse[dict])
async def get_checkpoint_overview(
    payload: dict = Depends(require_mentor),
    db: AsyncSession = Depends(get_db),
):
    """
    Trả về ma trận tiến độ nộp checkpoint của tất cả đội thi.

    QUAN TRỌNG: Endpoint này CHỈ trả về trạng thái đã nộp hay chưa (submitted: bool).
    Không trả về submission_url, commit_sha, hay bất kỳ nội dung bài nộp nào.
    Đây là quy định bảo mật để đảm bảo tính khách quan khi chấm điểm.

    Kết quả: {
        checkpoints: [{id, name, display_order}],
        teams: [{team_id, team_name, subtopic_name, checkpoints: [{checkpoint_id, submitted}]}]
    }
    """
    # 1. Lấy danh sách checkpoint (theo thứ tự hiển thị)
    checkpoints_raw = (
        await db.execute(
            select(Checkpoint).order_by(Checkpoint.display_order, Checkpoint.open_at)
        )
    ).scalars().all()

    # 2. Lấy tất cả team (không disqualified), kèm topic_selection để hiện subtopic name
    teams_raw = (
        await db.execute(
            select(Team)
            .where(Team.status.not_in(["disqualified", "rejected"]))
            .options(
                selectinload(Team.topic_selection).selectinload(TeamTopicSelection.subtopic),
            )
            .order_by(Team.name)
        )
    ).scalars().all()

    if not teams_raw:
        return APIResponse(
            success=True,
            data={"checkpoints": [], "teams": []},
            message="Chưa có đội thi nào.",
        )

    # 3. Lấy tất cả submissions is_latest=True (chỉ cần team_id + checkpoint_id, không lấy URL)
    submissions_raw = (
        await db.execute(
            select(
                CheckpointSubmission.team_id,
                CheckpointSubmission.checkpoint_id,
            ).where(CheckpointSubmission.is_latest == True)  # noqa: E712
        )
    ).all()

    # Build lookup set: (team_id, checkpoint_id) -> submitted
    submitted_set = {(row.team_id, row.checkpoint_id) for row in submissions_raw}

    # 4. Build checkpoint header list
    cp_headers = [
        {"id": cp.id, "name": cp.name, "display_order": cp.display_order}
        for cp in checkpoints_raw
    ]

    # 5. Build team rows
    team_rows = []
    for team in teams_raw:
        subtopic_name: Optional[str] = None
        if team.topic_selection and team.topic_selection.subtopic:
            subtopic_name = team.topic_selection.subtopic.name

        cp_status = [
            {
                "checkpoint_id": cp.id,
                "submitted": (team.id, cp.id) in submitted_set,
            }
            for cp in checkpoints_raw
        ]

        team_rows.append({
            "team_id": team.id,
            "team_name": team.name,
            "subtopic_name": subtopic_name,
            "checkpoints": cp_status,
        })

    return APIResponse(
        success=True,
        data={
            "checkpoints": cp_headers,
            "teams": team_rows,
        },
        message="Lấy tổng quan tiến độ checkpoint thành công.",
    )
