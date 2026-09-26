from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.core.security import get_current_user_payload
from app.models.scoring import ScoringCriteria, Evaluation, JudgeAssignment, EvaluationDetail
from app.models.team import Team, TeamMember
from app.models.topic import TeamTopicSelection
from app.models.config import HackathonConfig
from app.schemas.scoring import (
    ScoringCriteriaResponse,
    EvaluationSubmitRequest,
    EvaluationResponse,
    LeaderboardEntry,
)
from app.schemas.common import APIResponse
from app.services import scoring_service

router = APIRouter(prefix="/scoring", tags=["Scoring"])


@router.get("/criteria", response_model=APIResponse[List[ScoringCriteriaResponse]])
async def list_criteria(db: AsyncSession = Depends(get_db)):
    stmt = (
        select(ScoringCriteria)
        .where(ScoringCriteria.is_active == True)
        .order_by(ScoringCriteria.display_order.asc())
    )
    criteria = (await db.execute(stmt)).scalars().all()
    return APIResponse(
        success=True,
        data=[ScoringCriteriaResponse.model_validate(c) for c in criteria],
        message="Lấy danh sách tiêu chí chấm điểm thành công.",
    )


# FIX B02: GET /scoring/assigned-teams — Judge chỉ thấy team được phân công
@router.get("/assigned-teams", response_model=APIResponse[List[dict]])
async def get_assigned_teams(
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db),
):
    judge_id = payload.get("sub")
    user_role = payload.get("role", "judge")

    if user_role == "admin":
        # Admin thấy tất cả teams
        stmt = (
            select(Team)
            .options(
                selectinload(Team.topic_selection).selectinload(TeamTopicSelection.subtopic)
            )
            .order_by(Team.name)
        )
        teams = (await db.execute(stmt)).scalars().all()
    else:
        # Judge: chỉ lấy teams được phân công
        assignments = (
            (await db.execute(select(JudgeAssignment).where(JudgeAssignment.judge_id == judge_id)))
            .scalars()
            .all()
        )
        team_ids = [a.team_id for a in assignments]
        if not team_ids:
            return APIResponse(
                success=True, data=[], message="Bạn chưa được phân công chấm đội nào."
            )
        stmt = (
            select(Team)
            .where(Team.id.in_(team_ids))
            .options(
                selectinload(Team.topic_selection).selectinload(TeamTopicSelection.subtopic)
            )
            .order_by(Team.name)
        )
        teams = (await db.execute(stmt)).scalars().all()

    # Query all evaluations made by this judge
    evals = (
        await db.execute(
            select(Evaluation).where(Evaluation.judge_id == judge_id)
        )
    ).scalars().all()
    eval_map = {e.team_id: e for e in evals}

    data = []
    for t in teams:
        sub_title = (
            t.topic_selection.subtopic.title
            if t.topic_selection and t.topic_selection.subtopic
            else "Chưa chọn đề tài"
        )
        ev = eval_map.get(t.id)
        scoring_status = "not_scored"
        total_score = None
        if ev:
            scoring_status = "draft" if ev.is_draft else "submitted"
            total_score = ev.total_score

        data.append({
            "id": t.id,
            "name": t.name,
            "status": t.status,
            "subtopic_title": sub_title,
            "scoring_status": scoring_status,
            "total_score": total_score,
        })

    return APIResponse(
        success=True,
        data=data,
        message="Lấy danh sách đội được phân công thành công.",
    )


@router.get("/evaluations/team/{team_id}", response_model=APIResponse[Optional[dict]])
async def get_team_evaluation(
    team_id: str,
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db),
):
    judge_id = payload.get("sub")
    eval_record = (
        await db.execute(
            select(Evaluation)
            .options(selectinload(Evaluation.details))
            .where(Evaluation.team_id == team_id, Evaluation.judge_id == judge_id)
        )
    ).scalar_one_or_none()

    if not eval_record:
        return APIResponse(success=True, data=None, message="Chưa có điểm đánh giá cho đội này.")

    details_data = [
        {
            "criteria_id": d.criteria_id,
            "score": d.score,
            "note": d.note,
        }
        for d in eval_record.details
    ]

    return APIResponse(
        success=True,
        data={
            "id": eval_record.id,
            "team_id": eval_record.team_id,
            "judge_id": eval_record.judge_id,
            "total_score": eval_record.total_score,
            "general_comment": eval_record.general_comment,
            "is_draft": eval_record.is_draft,
            "submitted_at": eval_record.submitted_at.isoformat() if eval_record.submitted_at else None,
            "details": details_data,
        },
        message="Lấy điểm đánh giá của đội thành công.",
    )


@router.post("/evaluate", response_model=APIResponse[EvaluationResponse])
async def submit_evaluation(
    data: EvaluationSubmitRequest,
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db),
):
    judge_id = payload.get("sub")

    # FIX B03: Lock evaluation khi results đã published
    config = (await db.execute(select(HackathonConfig))).scalar_one_or_none()
    if config and config.results_published:
        raise HTTPException(
            status_code=403,
            detail="Kết quả đã được công bố. Không thể chỉnh sửa điểm sau khi publish.",
        )

    eval_record = await scoring_service.submit_evaluation(db, judge_id, data)
    return APIResponse(
        success=True,
        data=EvaluationResponse.model_validate(eval_record),
        message="Lưu kết quả chấm điểm thành công.",
    )


@router.get("/leaderboard", response_model=APIResponse[List[LeaderboardEntry]])
async def get_leaderboard(
    payload: Optional[dict] = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db),
):
    user_role = payload.get("role") if payload else "guest"
    user_id = payload.get("sub") if payload else None

    user_team_id = None
    if user_id:
        member = (
            await db.execute(
                select(TeamMember).where(
                    TeamMember.user_id == user_id, TeamMember.status == "accepted"
                )
            )
        ).scalar_one_or_none()
        if member:
            user_team_id = member.team_id

    entries = await scoring_service.get_leaderboard(db, user_role, user_team_id)
    return APIResponse(
        success=True,
        data=entries,
        message="Lấy bảng xếp hạng thành công.",
    )
