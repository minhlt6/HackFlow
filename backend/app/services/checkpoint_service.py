from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status
from app.models.checkpoint import Checkpoint, CheckpointSubmission
from app.models.team import Team, TeamMember
from app.schemas.checkpoint import CheckpointSubmitRequest


async def submit_checkpoint(
    db: AsyncSession,
    checkpoint_id: str,
    team_id: str,
    user_id: str,
    data: CheckpointSubmitRequest,
) -> CheckpointSubmission:
    # 1. Verify user is leader of the team
    membership = (
        await db.execute(
            select(TeamMember).where(
                TeamMember.team_id == team_id,
                TeamMember.user_id == user_id,
                TeamMember.role == "leader",
                TeamMember.status == "accepted",
            )
        )
    ).scalar_one_or_none()
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chỉ nhóm trưởng mới có quyền nộp bài checkpoint.",
        )

    # 2. Get checkpoint and validate time server-side (Strict UTC Time-Gating)
    checkpoint = (
        await db.execute(select(Checkpoint).where(Checkpoint.id == checkpoint_id))
    ).scalar_one_or_none()
    if not checkpoint:
        raise HTTPException(status_code=404, detail="Không tìm thấy checkpoint.")

    now = datetime.now(timezone.utc)
    open_at = (
        checkpoint.open_at
        if checkpoint.open_at.tzinfo
        else checkpoint.open_at.replace(tzinfo=timezone.utc)
    )
    close_at = (
        checkpoint.close_at
        if checkpoint.close_at.tzinfo
        else checkpoint.close_at.replace(tzinfo=timezone.utc)
    )

    if now < open_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Checkpoint này chưa đến thời gian mở nộp bài.",
        )

    if now > close_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Đã quá hạn chót nộp checkpoint. Cổng nộp bài đã đóng.",
        )

    is_late = False
    score_awarded = float(checkpoint.points or 10.0)

    # Validate required fields if specified
    custom_data = data.custom_fields or {}
    if checkpoint.required_fields:
        missing = []
        for req_f in checkpoint.required_fields:
            if req_f == "repo_url" and not data.submission_url:
                missing.append("Link Github/Repository (repo_url)")
            elif req_f != "repo_url" and not custom_data.get(req_f):
                missing.append(req_f)
        if missing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Thiếu các trường bắt buộc nộp: {', '.join(missing)}",
            )

    # 3. Find previous submissions to manage versions
    prev_stmt = select(CheckpointSubmission).where(
        CheckpointSubmission.checkpoint_id == checkpoint_id,
        CheckpointSubmission.team_id == team_id,
        CheckpointSubmission.is_latest == True,
    )
    prev_sub = (await db.execute(prev_stmt)).scalar_one_or_none()

    new_version = 1
    if prev_sub:
        new_version = prev_sub.version + 1
        prev_sub.is_latest = False

    submission = CheckpointSubmission(
        checkpoint_id=checkpoint_id,
        team_id=team_id,
        submitted_by=user_id,
        submission_url=data.submission_url,
        note=data.note,
        custom_fields=custom_data,
        score_awarded=score_awarded,
        is_late=is_late,
        version=new_version,
        submitted_at=now,
        is_latest=True,
    )
    db.add(submission)
    await db.commit()
    await db.refresh(submission)
    return submission


async def get_checkpoints_for_team(db: AsyncSession, team_id: str) -> List[dict]:
    checkpoints = (
        (await db.execute(select(Checkpoint).order_by(Checkpoint.display_order.asc())))
        .scalars()
        .all()
    )

    now = datetime.now(timezone.utc)
    results = []

    for cp in checkpoints:
        open_at = cp.open_at if cp.open_at.tzinfo else cp.open_at.replace(tzinfo=timezone.utc)
        close_at = cp.close_at if cp.close_at.tzinfo else cp.close_at.replace(tzinfo=timezone.utc)

        # Get latest submission for this team
        sub_stmt = select(CheckpointSubmission).where(
            CheckpointSubmission.checkpoint_id == cp.id,
            CheckpointSubmission.team_id == team_id,
            CheckpointSubmission.is_latest == True,
        )
        latest_sub = (await db.execute(sub_stmt)).scalar_one_or_none()

        status_str = "locked"
        if latest_sub:
            status_str = "submitted"
        elif now < open_at:
            status_str = "locked"
        elif open_at <= now <= close_at:
            status_str = "open"
        else:
            status_str = "closed"

        results.append(
            {
                "id": cp.id,
                "name": cp.name,
                "description": cp.description,
                "open_at": open_at,
                "close_at": close_at,
                "display_order": cp.display_order,
                "is_required": cp.is_required,
                "points": cp.points,
                "late_penalty": cp.late_penalty,
                "block_enabled": cp.block_enabled,
                "block_threshold": cp.block_threshold,
                "required_fields": cp.required_fields or ["repo_url"],
                "status": status_str,
                "latest_submission": latest_sub,
            }
        )
    return results
