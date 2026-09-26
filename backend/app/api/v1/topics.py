from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import get_current_user_payload
from app.schemas.topic import TopicResponse, SubtopicStatsResponse, SubtopicResponse
from app.schemas.common import APIResponse
from app.services import topic_service

router = APIRouter(prefix="/topics", tags=["Topics"])


@router.get("/", response_model=APIResponse[List[TopicResponse]])
async def get_topics(db: AsyncSession = Depends(get_db)):
    topics = await topic_service.get_all_topics(db)
    results = []
    for t in topics:
        subtopics_res = []
        for st in t.subtopics:
            mentor_names = [m.mentor.full_name for m in st.mentors if m.mentor]
            subtopics_res.append(
                SubtopicResponse(
                    id=st.id,
                    topic_id=st.topic_id,
                    name=st.name,
                    description=st.description,
                    sample_data_url=st.sample_data_url,
                    reference_links=st.reference_links or [],
                    max_teams=st.max_teams,
                    current_registered_count=st.current_registered_count,
                    display_order=st.display_order,
                    is_active=st.is_active,
                    mentor_names=mentor_names,
                )
            )
        results.append(
            TopicResponse(
                id=t.id,
                name=t.name,
                description=t.description,
                display_order=t.display_order,
                is_active=t.is_active,
                subtopics=subtopics_res,
            )
        )
    return APIResponse(success=True, data=results, message="Lấy danh sách đề tài thành công.")


@router.post("/subtopics/{subtopic_id}/select", response_model=APIResponse[dict])
async def select_topic(
    subtopic_id: str,
    team_id: str = Query(..., description="ID đội thi chọn đề tài"),
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db),
):
    user_id = payload.get("sub")
    selection = await topic_service.select_topic_with_lock(db, team_id, subtopic_id, user_id)
    return APIResponse(
        success=True,
        data={
            "selection_id": selection.id,
            "team_id": selection.team_id,
            "subtopic_id": selection.subtopic_id,
            "selected_at": selection.selected_at.isoformat(),
        },
        message="Chọn đề tài thành công.",
    )


@router.get("/stats", response_model=APIResponse[List[SubtopicStatsResponse]])
async def get_topic_stats(db: AsyncSession = Depends(get_db)):
    stats = await topic_service.get_topic_registration_stats(db)
    return APIResponse(
        success=True,
        data=[SubtopicStatsResponse.model_validate(s) for s in stats],
        message="Lấy thống kê lựa chọn đề tài thành công.",
    )
