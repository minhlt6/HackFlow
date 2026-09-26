from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import get_current_user_payload
from app.models.user import User
from app.schemas.user import UserResponse, UserProfileUpdate
from app.schemas.common import APIResponse
from app.services import auth_service

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=APIResponse[UserResponse])
async def get_my_profile(
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db),
):
    user_id = payload.get("sub")
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng.")

    return APIResponse(
        success=True,
        data=UserResponse.model_validate(user),
        message="Lấy thông tin người dùng thành công.",
    )


@router.put("/profile", response_model=APIResponse[UserResponse])
async def update_profile(
    data: UserProfileUpdate,
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db),
):
    user_id = payload.get("sub")
    updated_user = await auth_service.complete_profile(db, user_id, data)

    return APIResponse(
        success=True,
        data=UserResponse.model_validate(updated_user),
        message="Hoàn thiện hồ sơ thành công.",
    )
