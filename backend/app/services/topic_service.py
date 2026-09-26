import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status
from app.models.topic import Topic, Subtopic, TeamTopicSelection, TopicMentor
from app.models.team import Team, TeamMember
from app.models.config import HackathonConfig
from app.schemas.topic import TopicCreateRequest, SubtopicCreateRequest, SubtopicStatsResponse


async def get_all_topics(db: AsyncSession) -> List[Topic]:
    stmt = (
        select(Topic)
        .where(Topic.is_active == True)
        .order_by(Topic.display_order.asc())
        .options(
            selectinload(Topic.subtopics)
            .selectinload(Subtopic.mentors)
            .selectinload(TopicMentor.mentor)
        )
    )
    result = await db.execute(stmt)
    return result.scalars().all()


async def select_topic_with_lock(
    db: AsyncSession, team_id: str, subtopic_id: str, user_id: str
) -> TeamTopicSelection:
    # 1. Verify user is leader of an approved team
    team_stmt = select(Team).where(Team.id == team_id).options(selectinload(Team.members))
    team = (await db.execute(team_stmt)).scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Không tìm thấy đội thi.")

    if team.status != "approved":
        raise HTTPException(
            status_code=400,
            detail="Đội thi của bạn chưa được BTC phê duyệt. Không thể chọn đề tài lúc này.",
        )

    # Check leader role
    is_leader = any(
        m.user_id == user_id and m.role == "leader" and m.status == "accepted" for m in team.members
    )
    if not is_leader:
        raise HTTPException(status_code=403, detail="Chỉ nhóm trưởng mới có quyền chọn đề tài.")

    # 2. Check if team already selected a topic
    existing_selection = (
        await db.execute(select(TeamTopicSelection).where(TeamTopicSelection.team_id == team_id))
    ).scalar_one_or_none()
    if existing_selection:
        raise HTTPException(status_code=400, detail="Đội thi của bạn đã chọn một đề tài trước đó.")

    # 3. Check topic selection deadline
    config = (
        await db.execute(select(HackathonConfig).where(HackathonConfig.id == 1))
    ).scalar_one_or_none()
    if config and config.topic_selection_deadline:
        deadline = (
            config.topic_selection_deadline
            if config.topic_selection_deadline.tzinfo
            else config.topic_selection_deadline.replace(tzinfo=timezone.utc)
        )
        if datetime.now(timezone.utc) > deadline:
            raise HTTPException(status_code=400, detail="Đã hết hạn chọn đề tài.")

    # 4. Atomic Selection with Conditional Update to guarantee slot limit under high concurrency
    update_stmt = (
        update(Subtopic)
        .where(
            Subtopic.id == subtopic_id,
            Subtopic.is_active == True,
            Subtopic.current_registered_count < Subtopic.max_teams,
        )
        .values(current_registered_count=Subtopic.current_registered_count + 1)
    )
    res = await db.execute(update_stmt)
    if res.rowcount == 0:
        # Check whether subtopic exists or is just full
        subtopic_exists = (
            await db.execute(select(Subtopic).where(Subtopic.id == subtopic_id))
        ).scalar_one_or_none()
        if not subtopic_exists or not subtopic_exists.is_active:
            raise HTTPException(status_code=404, detail="Đề tài không tồn tại hoặc đã bị ẩn.")
        raise HTTPException(
            status_code=400,
            detail="Đề tài này đã đủ số nhóm đăng ký. Vui lòng chọn đề tài khác.",
        )

    # Create selection record
    selection = TeamTopicSelection(
        team_id=team_id,
        subtopic_id=subtopic_id,
        selected_by=user_id,
        selected_at=datetime.now(timezone.utc),
    )
    db.add(selection)
    await db.commit()
    await db.refresh(selection)

    return selection


async def get_topic_registration_stats(db: AsyncSession) -> List[dict]:
    stmt = (
        select(Subtopic)
        .options(
            selectinload(Subtopic.topic),
            selectinload(Subtopic.selections).selectinload(TeamTopicSelection.team),
        )
        .order_by(Subtopic.display_order.asc())
    )
    subtopics = (await db.execute(stmt)).scalars().all()

    results = []
    for st in subtopics:
        status_label = "empty"
        if st.current_registered_count == 0:
            status_label = "empty"
        elif st.current_registered_count >= st.max_teams:
            status_label = "full"
        elif st.current_registered_count == st.max_teams - 1:
            status_label = "almost_full"
        else:
            status_label = "available"

        registered_teams = [
            {
                "team_id": sel.team.id,
                "team_name": sel.team.name,
                "selected_at": sel.selected_at.isoformat(),
            }
            for sel in st.selections
            if sel.team
        ]

        results.append(
            {
                "topic_id": st.topic.id if st.topic else "",
                "topic_name": st.topic.name if st.topic else "",
                "subtopic_id": st.id,
                "subtopic_name": st.name,
                "max_teams": st.max_teams,
                "current_registered_count": st.current_registered_count,
                "status": status_label,
                "registered_teams": registered_teams,
            }
        )
    return results
