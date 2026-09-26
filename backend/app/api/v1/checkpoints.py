from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import get_current_user_payload
from app.schemas.checkpoint import (
    CheckpointResponse,
    CheckpointSubmitRequest,
    CheckpointSubmissionResponse,
)
from app.schemas.common import APIResponse
from app.services import checkpoint_service

router = APIRouter(prefix="/checkpoints", tags=["Checkpoints"])


@router.get("/", response_model=APIResponse[List[CheckpointResponse]])
async def list_checkpoints(
    team_id: Optional[str] = Query(None, description="ID đội thi để lấy trạng thái nộp bài"),
    db: AsyncSession = Depends(get_db),
):
    team_id_clean = team_id or ""
    cps = await checkpoint_service.get_checkpoints_for_team(db, team_id_clean)
    results = []
    for c in cps:
        sub_resp = None
        if c["latest_submission"]:
            sub_resp = CheckpointSubmissionResponse.model_validate(c["latest_submission"])
        results.append(
            CheckpointResponse(
                id=c["id"],
                name=c["name"],
                description=c["description"],
                open_at=c["open_at"],
                close_at=c["close_at"],
                display_order=c["display_order"],
                is_required=c["is_required"],
                status=c["status"],
                latest_submission=sub_resp,
            )
        )
    return APIResponse(success=True, data=results, message="Lấy danh sách checkpoint thành công.")


@router.post("/{id}/submit", response_model=APIResponse[CheckpointSubmissionResponse])
async def submit_checkpoint(
    id: str,
    data: CheckpointSubmitRequest,
    team_id: str = Query(..., description="ID đội thi nộp bài"),
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db),
):
    user_id = payload.get("sub")
    sub = await checkpoint_service.submit_checkpoint(db, id, team_id, user_id, data)
    return APIResponse(
        success=True,
        data=CheckpointSubmissionResponse.model_validate(sub),
        message="Nộp bài checkpoint thành công.",
    )
