from typing import Optional
from fastapi import APIRouter, Depends, Response, Request, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete as sql_delete
from app.core.database import get_db
from app.core.security import get_current_user_payload, get_password_hash
from app.core.config import settings
from app.models.user import User, RefreshToken
from app.schemas.auth import (
    LoginRequest,
    TokenResponse,
    GitHubAuthURLResponse,
    RegisterRequest,
    DevLoginRequest,
)
from app.schemas.common import APIResponse
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", response_model=APIResponse[dict], status_code=201)
async def register(data: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Đăng ký tài khoản participant mới — tự động approve nếu email trong whitelist, ngược lại pending."""
    existing = (await db.execute(select(User).where(User.email == data.email))).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email này đã được dùng để đăng ký tài khoản khác.",
        )

    # Kiểm tra whitelist — email trong whitelist → auto approve
    approval = await auth_service.resolve_approval_status(db, data.email)

    new_user = User(
        email=data.email,
        password_hash=get_password_hash(data.password),
        full_name=data.full_name,
        student_id=data.student_id,
        role="participant",
        approval_status=approval,
        profile_completed=False,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    if approval == "approved":
        msg = "Đăng ký thành công! Email của bạn đã có trong danh sách phê duyệt — tài khoản được kích hoạt ngay."
    else:
        msg = (
            "Đăng ký thành công! Tài khoản đang chờ Ban Tổ Chức phê duyệt. "
            "Vui lòng gửi email xác nhận đến BTC để được kích hoạt sớm."
        )

    return APIResponse(
        success=True,
        data={"user_id": new_user.id, "email": new_user.email, "approval_status": approval},
        message=msg,
    )


@router.post("/login", response_model=APIResponse[TokenResponse])
async def login(data: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    # Kiểm tra approval_status trước khi xác thực
    user_check = (
        await db.execute(select(User).where(User.email == data.email))
    ).scalar_one_or_none()
    if user_check:
        if user_check.approval_status == "pending":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="PENDING_APPROVAL: Tài khoản đang chờ Ban Tổ Chức phê duyệt. Vui lòng kiên nhẫn chờ hoặc liên hệ BTC.",
            )
        if user_check.approval_status == "rejected":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="ACCOUNT_REJECTED: Tài khoản đã bị từ chối bởi Ban Tổ Chức. Vui lòng liên hệ BTC để biết thêm chi tiết.",
            )

    access_token, refresh_token, user = await auth_service.authenticate_user(db, data)

    # Set httpOnly cookie for secure session
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        samesite="lax",
    )

    return APIResponse(
        success=True,
        data=TokenResponse(
            access_token=access_token,
            user_id=user.id,
            email=user.email,
            full_name=user.full_name,
            role=user.role,
            profile_completed=user.profile_completed,
        ),
        message="Đăng nhập thành công.",
    )


@router.get("/github/login", response_model=APIResponse[GitHubAuthURLResponse])
async def github_login():
    redirect_uri = settings.GITHUB_CALLBACK_URL
    auth_url = (
        f"https://github.com/login/oauth/authorize?client_id={settings.GITHUB_CLIENT_ID}"
        f"&redirect_uri={redirect_uri}&scope=read:user,user:email"
    )
    return APIResponse(
        success=True,
        data=GitHubAuthURLResponse(auth_url=auth_url),
    )


@router.get("/github/callback", response_model=APIResponse[TokenResponse])
async def github_callback(code: str, response: Response, db: AsyncSession = Depends(get_db)):
    access_token, refresh_token, user = await auth_service.handle_github_callback(db, code)

    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        samesite="lax",
    )

    return APIResponse(
        success=True,
        data=TokenResponse(
            access_token=access_token,
            user_id=user.id,
            email=user.email,
            full_name=user.full_name,
            role=user.role,
            profile_completed=user.profile_completed,
        ),
        message="Đăng nhập bằng GitHub thành công.",
    )


@router.post("/logout", response_model=APIResponse[None])
async def logout(
    response: Response,
    # FIX C-01: Optional auth — nếu có token thì revoke DB tokens
    payload: Optional[dict] = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db),
):
    if payload:
        user_id = payload.get("sub")
        # Xóa tất cả refresh token của user khỏi DB — invalidate mọi session
        await db.execute(sql_delete(RefreshToken).where(RefreshToken.user_id == user_id))
        await db.commit()
    response.delete_cookie(key="access_token")
    return APIResponse(
        success=True, message="Đăng xuất thành công. Tất cả phiên đăng nhập đã bị thu hồi."
    )


@router.post("/dev-login", response_model=APIResponse[TokenResponse])
async def dev_login(
    data: DevLoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """
    Đăng nhập nhanh một chạm theo vai trò (Role) cho mục đích kiểm thử và demo.
    Không yêu cầu mật khẩu hay chuẩn bị tài khoản trước.
    """
    access_token, refresh_token, user = await auth_service.dev_login(db, data.role)

    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        samesite="lax",
    )

    return APIResponse(
        success=True,
        data=TokenResponse(
            access_token=access_token,
            user_id=user.id,
            email=user.email,
            full_name=user.full_name,
            role=user.role,
            profile_completed=user.profile_completed,
        ),
        message=f"Đăng nhập nhanh vai trò {user.role} thành công.",
    )
