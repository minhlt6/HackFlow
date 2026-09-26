from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import get_current_user_payload
from app.models.submission import FinalSubmission
from app.schemas.submission import FinalSubmissionRequest, FinalSubmissionResponse
from app.schemas.common import APIResponse
from app.services import submission_service

router = APIRouter(prefix="/submissions", tags=["Submissions"])


@router.post("/final", response_model=APIResponse[FinalSubmissionResponse])
async def submit_final_product(
    data: FinalSubmissionRequest,
    team_id: str = Query(..., description="ID đội nộp sản phẩm"),
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db),
):
    user_id = payload.get("sub")
    sub = await submission_service.submit_final_product(db, team_id, user_id, data)
    return APIResponse(
        success=True,
        data=FinalSubmissionResponse.model_validate(sub),
        message="Nộp sản phẩm cuối cùng thành công. Commit SHA của bạn đã được đóng băng!",
    )


@router.get("/final/{team_id}", response_model=APIResponse[FinalSubmissionResponse])
async def get_final_submission(
    team_id: str,
    # FIX H-03: Thêm auth — chỉ admin/mentor/member của team mới xem được commit SHA
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db),
):
    user_id = payload.get("sub")
    user_role = payload.get("role", "participant")

    # Kiểm tra quyền truy cập
    if user_role == "participant":
        from sqlalchemy import select as sa_select
        from app.models.team import TeamMember

        member = (
            await db.execute(
                sa_select(TeamMember).where(
                    TeamMember.team_id == team_id,
                    TeamMember.user_id == user_id,
                    TeamMember.status == "accepted",
                )
            )
        ).scalar_one_or_none()
        if not member:
            raise HTTPException(
                status_code=403,
                detail="Bạn không có quyền xem thông tin nộp bài của đội này.",
            )

    # Check post-deadline changes if any
    try:
        sub = await submission_service.check_for_post_deadline_changes(db, team_id)
    except HTTPException:
        sub = (
            await db.execute(select(FinalSubmission).where(FinalSubmission.team_id == team_id))
        ).scalar_one_or_none()

    if not sub:
        raise HTTPException(status_code=404, detail="Đội thi chưa nộp sản phẩm cuối cùng.")

    return APIResponse(
        success=True,
        data=FinalSubmissionResponse.model_validate(sub),
        message="Lấy thông tin sản phẩm cuối cùng thành công.",
    )
