import uuid
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete as sql_delete, update as sql_update
from fastapi import HTTPException, status
from app.core.config import settings
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.models.user import User, RefreshToken, RegistrationWhitelist
from app.schemas.auth import LoginRequest, TokenResponse
from app.schemas.user import UserProfileUpdate


async def resolve_approval_status(db: AsyncSession, email: str) -> str:
    """
    Kiểm tra email trong whitelist.
    - Nếu có → trả về 'approved' và đánh dấu whitelist entry là used=True.
    - Nếu không → trả về 'pending' (cần BTC duyệt thủ công).
    """
    entry = (
        await db.execute(
            select(RegistrationWhitelist).where(RegistrationWhitelist.email == email.lower())
        )
    ).scalar_one_or_none()

    if entry:
        # Đánh dấu đã sử dụng
        await db.execute(
            sql_update(RegistrationWhitelist)
            .where(RegistrationWhitelist.id == entry.id)
            .values(used=True)
        )
        return "approved"

    return "pending"


async def authenticate_user(db: AsyncSession, data: LoginRequest) -> Tuple[str, str, User]:
    stmt = select(User).where(User.email == data.email)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user or not user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email hoặc mật khẩu không chính xác.",
        )

    if not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email hoặc mật khẩu không chính xác.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tài khoản đã bị vô hiệu hóa.",
        )

    # FIX BUG #2: Revoke tất cả refresh token cũ trước khi tạo mới
    # Ngăn chặn token tích lũy và đảm bảo login mới nhất có thể revoke session cũ
    await db.execute(sql_delete(RefreshToken).where(RefreshToken.user_id == user.id))

    # Generate tokens
    access_token = create_access_token(
        data={"sub": user.id, "email": user.email, "role": user.role, "name": user.full_name}
    )
    refresh_token = create_refresh_token(data={"sub": user.id})

    # FIX BUG #1: Hash refresh token bằng SHA-256 thực sự trước khi lưu DB
    # Không bao giờ lưu token dạng plaintext — chỉ lưu hash để so sánh sau
    token_hash = hashlib.sha256(refresh_token.encode("utf-8")).hexdigest()

    rt_record = RefreshToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(rt_record)
    await db.commit()

    return access_token, refresh_token, user


async def handle_github_callback(db: AsyncSession, code: str) -> Tuple[str, str, User]:
    # In mock/offline mode when credentials are mock or empty
    if not settings.GITHUB_CLIENT_ID or "mock" in settings.GITHUB_CLIENT_ID:
        mock_github_id = f"mock_gh_{code}"
        mock_username = f"github_user_{code[:6]}"
        mock_email = f"{mock_username}@mock-github.local"

        stmt = select(User).where(User.github_id == mock_github_id)
        user = (await db.execute(stmt)).scalar_one_or_none()

        if not user:
            # Whitelist check cho GitHub OAuth — email mock không bao giờ trong whitelist
            # nhưng giữ logic nhất quán với live flow
            approval = await resolve_approval_status(db, mock_email)
            user = User(
                github_id=mock_github_id,
                github_username=mock_username,
                email=mock_email,
                full_name=f"GitHub User ({mock_username})",
                role="participant",
                approval_status=approval,
                profile_completed=False,
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)

        access_token = create_access_token(
            data={"sub": user.id, "email": user.email, "role": user.role, "name": user.full_name}
        )
        refresh_token = create_refresh_token(data={"sub": user.id})

        # FIX B09: Mock flow cũng phải lưu refresh token vào DB — nhất quán với live flow
        # Thiếu đoạn này → client nhận refresh token nhưng server không nhận ra khi refresh
        await db.execute(sql_delete(RefreshToken).where(RefreshToken.user_id == user.id))
        token_hash = hashlib.sha256(refresh_token.encode("utf-8")).hexdigest()
        rt_record = RefreshToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=datetime.now(timezone.utc)
            + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        )
        db.add(rt_record)
        await db.commit()

        return access_token, refresh_token, user

    # Live GitHub OAuth Flow
    async with httpx.AsyncClient() as client:
        # Step 1: Exchange code for access token
        token_res = await client.post(
            "https://github.com/login/oauth/access_token",
            headers={"Accept": "application/json"},
            data={
                "client_id": settings.GITHUB_CLIENT_ID,
                "client_secret": settings.GITHUB_CLIENT_SECRET,
                "code": code,
                "redirect_uri": settings.GITHUB_CALLBACK_URL,
            },
        )
        token_data = token_res.json()
        gh_access_token = token_data.get("access_token")
        if not gh_access_token:
            raise HTTPException(status_code=400, detail="Không thể xác thực với GitHub.")

        # Step 2: Fetch user profile
        user_res = await client.get(
            "https://api.github.com/user",
            headers={"Authorization": f"Bearer {gh_access_token}", "Accept": "application/json"},
        )
        gh_user = user_res.json()
        gh_id = str(gh_user.get("id"))
        gh_login = gh_user.get("login")
        gh_email = gh_user.get("email") or f"{gh_login}@users.noreply.github.com"
        gh_name = gh_user.get("name") or gh_login
        avatar = gh_user.get("avatar_url")

    # Step 3: Find or create user
    stmt = select(User).where((User.github_id == gh_id) | (User.email == gh_email))
    user = (await db.execute(stmt)).scalar_one_or_none()

    if not user:
        # Whitelist check — email GitHub trong whitelist → auto approve
        approval = await resolve_approval_status(db, gh_email)
        user = User(
            github_id=gh_id,
            github_username=gh_login,
            email=gh_email,
            full_name=gh_name,
            avatar_url=avatar,
            role="participant",
            approval_status=approval,
            profile_completed=False,
        )
        db.add(user)
    else:
        user.github_id = gh_id
        user.github_username = gh_login
        if avatar:
            user.avatar_url = avatar

    await db.commit()
    await db.refresh(user)

    access_token = create_access_token(
        data={"sub": user.id, "email": user.email, "role": user.role, "name": user.full_name}
    )
    refresh_token = create_refresh_token(data={"sub": user.id})
    return access_token, refresh_token, user


async def complete_profile(db: AsyncSession, user_id: str, data: UserProfileUpdate) -> User:
    stmt = select(User).where(User.id == user_id)
    user = (await db.execute(stmt)).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng.")

    user.full_name = data.full_name
    user.date_of_birth = data.date_of_birth
    user.gender = data.gender
    user.province = data.province
    user.district = data.district
    user.phone = data.phone
    user.school = data.school
    user.skills = data.skills
    user.major_direction = data.major_direction
    user.bio = data.bio
    if data.student_id is not None:
        user.student_id = data.student_id
    if data.github_username is not None:
        user.github_username = data.github_username
    if data.avatar_url:
        user.avatar_url = data.avatar_url
    user.profile_completed = True

    await db.commit()
    await db.refresh(user)
    return user


async def dev_login(db: AsyncSession, role: str) -> Tuple[str, str, User]:
    """
    Hỗ trợ đăng nhập nhanh một chạm theo role (Admin, Judge, Mentor, Leader, Member).
    Không cần mật khẩu hay tài khoản tạo trước.
    Tự động tìm kiếm hoặc khởi tạo tài khoản hợp lệ, active và approved.
    """
    clean_role = role.strip().lower()

    role_accounts = {
        "admin": {
            "email": "admin@hackflow.local",
            "full_name": "Quản Trị Viên HackFlow",
            "role": "admin",
            "skills": ["System Admin", "Management"],
            "school": "Ban Tổ Chức HackFlow",
        },
        "judge": {
            "email": "judge@hackflow.local",
            "full_name": "TS. Trần Giám Khảo",
            "role": "judge",
            "skills": ["Software Architecture", "AI/ML", "Cloud"],
            "school": "Viện Nghiên Cứu CNTT",
        },
        "mentor": {
            "email": "mentor@hackflow.local",
            "full_name": "ThS. Nguyễn Văn Hướng Dẫn",
            "role": "mentor",
            "skills": ["AI/ML", "Backend", "Python", "System Design"],
            "school": "Đại học Bách Khoa",
        },
        "leader": {
            "email": "leader@hackflow.local",
            "full_name": "Lê Trưởng Nhóm",
            "role": "participant",
            "skills": ["React", "FastAPI", "UI/UX"],
            "school": "Đại học CNTT",
        },
        "member": {
            "email": "member1@hackflow.local",
            "full_name": "Phạm Thành Viên 1",
            "role": "participant",
            "skills": ["Frontend", "Tailwind CSS", "TypeScript"],
            "school": "Đại học CNTT",
        },
        "participant": {
            "email": "leader@hackflow.local",
            "full_name": "Lê Trưởng Nhóm",
            "role": "participant",
            "skills": ["React", "FastAPI", "UI/UX"],
            "school": "Đại học CNTT",
        },
    }

    acc_info = role_accounts.get(clean_role)
    if not acc_info:
        if "admin" in clean_role:
            acc_info = role_accounts["admin"]
        elif "judge" in clean_role:
            acc_info = role_accounts["judge"]
        elif "mentor" in clean_role:
            acc_info = role_accounts["mentor"]
        elif "member" in clean_role:
            acc_info = role_accounts["member"]
        else:
            acc_info = role_accounts["participant"]

    # 1. Tìm user theo email định danh
    stmt = select(User).where(User.email == acc_info["email"])
    user = (await db.execute(stmt)).scalar_one_or_none()

    # 2. Nếu chưa có theo email, tìm user bất kỳ có cùng role tương ứng (với admin/judge/mentor)
    if not user and acc_info["role"] != "participant":
        stmt_role = select(User).where(User.role == acc_info["role"])
        user = (await db.execute(stmt_role)).scalars().first()

    # 3. Nếu chưa có trong DB, tự động tạo mới
    if not user:
        user = User(
            email=acc_info["email"],
            password_hash=get_password_hash("DevRole@123"),
            full_name=acc_info["full_name"],
            role=acc_info["role"],
            skills=acc_info.get("skills", []),
            school=acc_info.get("school"),
            profile_completed=True,
            is_active=True,
            approval_status="approved",
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    else:
        # Đảm bảo user demo luôn active và approved
        changed = False
        if not user.is_active:
            user.is_active = True
            changed = True
        if user.approval_status != "approved":
            user.approval_status = "approved"
            changed = True
        if changed:
            await db.commit()
            await db.refresh(user)

    # 4. Invalidate refresh token cũ và tạo token mới
    await db.execute(sql_delete(RefreshToken).where(RefreshToken.user_id == user.id))

    access_token = create_access_token(
        data={"sub": user.id, "email": user.email, "role": user.role, "name": user.full_name}
    )
    refresh_token = create_refresh_token(data={"sub": user.id})

    token_hash = hashlib.sha256(refresh_token.encode("utf-8")).hexdigest()
    rt_record = RefreshToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(rt_record)
    await db.commit()

    return access_token, refresh_token, user
