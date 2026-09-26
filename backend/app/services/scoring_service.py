from datetime import datetime, timezone
from typing import List, Dict, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status
from app.models.scoring import ScoringCriteria, JudgeAssignment, Evaluation, EvaluationDetail
from app.models.topic import TeamTopicSelection, TopicMentor
from app.models.team import Team
from app.models.config import HackathonConfig
from app.schemas.scoring import EvaluationSubmitRequest, LeaderboardEntry


def calculate_weighted_score(criteria_list: List[ScoringCriteria], details_input: list) -> float:
    """Tính tổng điểm theo trọng số: total = Σ (score * weight)"""
    criteria_map = {c.id: c for c in criteria_list}
    total = 0.0

    for item in details_input:
        crit = criteria_map.get(item.criteria_id)
        if not crit:
            continue
        if item.score > crit.max_score or item.score < 0:
            raise HTTPException(
                status_code=400,
                detail=f"Điểm cho tiêu chí '{crit.name}' phải từ 0 đến {crit.max_score}.",
            )
        total += item.score * crit.weight

    return round(total, 3)


async def submit_evaluation(
    db: AsyncSession, judge_id: str, data: EvaluationSubmitRequest
) -> Evaluation:
    # 1. Check if judge is assigned to this team
    assignment = (
        await db.execute(
            select(JudgeAssignment).where(
                JudgeAssignment.judge_id == judge_id,
                JudgeAssignment.team_id == data.team_id,
            )
        )
    ).scalar_one_or_none()
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không được phân công chấm điểm đội thi này.",
        )

    # 2. Conflict of interest check: Judge cannot be mentor of team's topic
    selection = (
        await db.execute(
            select(TeamTopicSelection).where(TeamTopicSelection.team_id == data.team_id)
        )
    ).scalar_one_or_none()
    if selection:
        mentor_check = (
            await db.execute(
                select(TopicMentor).where(
                    TopicMentor.subtopic_id == selection.subtopic_id,
                    TopicMentor.mentor_id == judge_id,
                )
            )
        ).scalar_one_or_none()
        if mentor_check:
            raise HTTPException(
                status_code=400,
                detail="Xung đột quyền lợi: Bạn đang là Mentor phụ trách đề tài của đội này nên không được chấm điểm.",
            )

    # 3. Load active criteria
    criteria = (
        (await db.execute(select(ScoringCriteria).where(ScoringCriteria.is_active == True)))
        .scalars()
        .all()
    )
    if not criteria:
        raise HTTPException(
            status_code=400, detail="Chưa có tiêu chí chấm điểm nào được thiết lập."
        )

    # FIX M-08: Validate điểm từng tiêu chí — score phải nằm trong [0, max_score]
    criteria_map = {c.id: c for c in criteria}
    for item in data.details:
        crit = criteria_map.get(item.criteria_id)
        if not crit:
            raise HTTPException(
                status_code=400,
                detail=f"Tiêu chí ID '{item.criteria_id}' không tồn tại hoặc đã bị vô hiệu hóa.",
            )
        if item.score < 0:
            raise HTTPException(
                status_code=400,
                detail=f"Điểm tiêu chí '{crit.name}' không được âm (nhận: {item.score}).",
            )
        if item.score > crit.max_score:
            raise HTTPException(
                status_code=400,
                detail=f"Điểm tiêu chí '{crit.name}' không được vượt quá {crit.max_score} (nhận: {item.score}).",
            )

    total_score = calculate_weighted_score(criteria, data.details)

    # 4. Upsert evaluation
    eval_stmt = (
        select(Evaluation)
        .where(Evaluation.judge_id == judge_id, Evaluation.team_id == data.team_id)
        .options(selectinload(Evaluation.details))
    )
    evaluation = (await db.execute(eval_stmt)).scalar_one_or_none()

    now = datetime.now(timezone.utc)
    eval_status = "draft" if data.is_draft else "submitted"

    if not evaluation:
        evaluation = Evaluation(
            judge_id=judge_id,
            team_id=data.team_id,
            total_score=total_score,
            general_comment=data.general_comment,
            status=eval_status,
            submitted_at=now if not data.is_draft else None,
            created_at=now,
            updated_at=now,
        )
        db.add(evaluation)
        await db.flush()
    else:
        evaluation.total_score = total_score
        evaluation.general_comment = data.general_comment
        evaluation.status = eval_status
        if not data.is_draft:
            evaluation.submitted_at = now
        evaluation.updated_at = now

        # FIX B06: Thay N+1 delete loop bằng 1 câu DELETE — hiệu quả hơn nhiều
        from sqlalchemy import delete as _sql_delete

        await db.execute(
            _sql_delete(EvaluationDetail).where(EvaluationDetail.evaluation_id == evaluation.id)
        )
        await db.flush()

    for item in data.details:
        detail = EvaluationDetail(
            evaluation_id=evaluation.id,
            criteria_id=item.criteria_id,
            score=item.score,
            note=item.note,
        )
        db.add(detail)

    await db.commit()
    await db.refresh(evaluation)
    return evaluation


async def get_leaderboard(
    db: AsyncSession, current_user_role: str, user_team_id: Optional[str] = None
) -> List[LeaderboardEntry]:
    config = (
        await db.execute(select(HackathonConfig).where(HackathonConfig.id == 1))
    ).scalar_one_or_none()
    results_published = config.results_published if config else False

    # FIX BUG #9: Dùng coalesce để tránh NULL avg
    stmt = (
        select(
            Team.id.label("team_id"),
            Team.name.label("team_name"),
            Team.blind_code.label("blind_code"),
            func.coalesce(func.avg(Evaluation.total_score), 0.0).label("avg_score"),
            func.count(Evaluation.id).label("eval_count"),
        )
        .join(Evaluation, Evaluation.team_id == Team.id)
        .where(Evaluation.status == "submitted")
        .group_by(Team.id, Team.name, Team.blind_code)
        .order_by(func.avg(Evaluation.total_score).desc())
    )
    rows = (await db.execute(stmt)).all()

    # FIX H-05: Tính rank TRƯỚC khi filter — participant thấy rank thực của mình
    all_entries = []
    for rank, row in enumerate(rows, start=1):
        display_name = row.team_name
        if (
            config
            and config.blind_judging
            and not results_published
            and current_user_role == "judge"
        ):
            display_name = row.blind_code or f"Đội #{rank:02d}"

        all_entries.append(
            LeaderboardEntry(
                rank=rank,
                team_id=row.team_id,
                team_name=display_name,
                total_score=round(float(row.avg_score), 2),
                evaluations_count=row.eval_count,
            )
        )

    # Filter sau khi đã gán rank — participant chỉ thấy đội mình với rank chính xác
    if not results_published and current_user_role == "participant":
        all_entries = [e for e in all_entries if e.team_id == user_team_id]

    return all_entries
