import uuid
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status
from app.models.team import Team, TeamMember
from app.models.user import User
from app.models.config import HackathonConfig
from app.schemas.team import TeamCreateRequest, TeamUpdateRequest


async def create_team(db: AsyncSession, data: TeamCreateRequest, creator_id: str) -> Team:
    # 1. Check if creator is already in an active team
    existing_membership = (
        await db.execute(
            select(TeamMember).where(
                TeamMember.user_id == creator_id,
                TeamMember.status == "accepted",
            )
        )
    ).scalar_one_or_none()
    if existing_membership:
        raise HTTPException(status_code=400, detail="Bạn đã là thành viên của một đội thi khác.")

    # 2. Check duplicate team name
    existing_team = (
        await db.execute(select(Team).where(func.lower(Team.name) == func.lower(data.name)))
    ).scalar_one_or_none()
    if existing_team:
        raise HTTPException(
            status_code=400,
            detail="Tên đội đã tồn tại. Vui lòng chọn tên khác.",
        )

    # 3. Create team
    team = Team(
        name=data.name,
        description=data.description,
        status="pending",
        created_by=creator_id,
    )
    db.add(team)
    await db.flush()

    # 4. Add creator as Leader
    leader_member = TeamMember(
        team_id=team.id,
        user_id=creator_id,
        role="leader",
        status="accepted",
        responded_at=datetime.now(timezone.utc),
    )
    db.add(leader_member)
    await db.commit()

    # Load with members
    stmt = (
        select(Team)
        .where(Team.id == team.id)
        .options(selectinload(Team.members).selectinload(TeamMember.user))
    )
    return (await db.execute(stmt)).scalar_one()


async def request_join_team(db: AsyncSession, team_id: str, user_id: str) -> TeamMember:
    team = (await db.execute(select(Team).where(Team.id == team_id))).scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Không tìm thấy đội thi.")

    # Check existing membership
    existing_membership = (
        await db.execute(
            select(TeamMember).where(
                TeamMember.user_id == user_id,
                TeamMember.status == "accepted",
            )
        )
    ).scalar_one_or_none()
    if existing_membership:
        raise HTTPException(status_code=400, detail="Bạn đã thuộc một đội thi khác.")

    # Check pending request to this team
    pending = (
        await db.execute(
            select(TeamMember).where(
                TeamMember.team_id == team_id,
                TeamMember.user_id == user_id,
            )
        )
    ).scalar_one_or_none()
    if pending:
        if pending.status == "pending":
            raise HTTPException(status_code=400, detail="Bạn đã gửi yêu cầu gia nhập đội này rồi.")
        elif pending.status == "accepted":
            raise HTTPException(status_code=400, detail="Bạn đã là thành viên của đội.")
        # If previously rejected/left, reset to pending
        pending.status = "pending"
        pending.invited_at = datetime.now(timezone.utc)
        await db.commit()
        return pending

    # Check team capacity
    config = (
        await db.execute(select(HackathonConfig).where(HackathonConfig.id == 1))
    ).scalar_one_or_none()
    max_size = config.max_team_size if config else 5
    current_count = (
        await db.execute(
            select(func.count(TeamMember.id)).where(
                TeamMember.team_id == team_id,
                TeamMember.status == "accepted",
            )
        )
    ).scalar_one()
    if current_count >= max_size:
        raise HTTPException(status_code=400, detail="Đội thi này đã đủ số lượng thành viên tối đa.")

    member = TeamMember(
        team_id=team_id,
        user_id=user_id,
        role="member",
        status="pending",
    )
    db.add(member)
    await db.commit()
    await db.refresh(member)
    return member


async def respond_to_join_request(
    db: AsyncSession, team_id: str, member_id: str, accept: bool, leader_id: str
) -> TeamMember:
    # 1. Verify leader
    leader_check = (
        await db.execute(
            select(TeamMember).where(
                TeamMember.team_id == team_id,
                TeamMember.user_id == leader_id,
                TeamMember.role == "leader",
                TeamMember.status == "accepted",
            )
        )
    ).scalar_one_or_none()
    if not leader_check:
        raise HTTPException(
            status_code=403, detail="Chỉ nhóm trưởng mới có quyền phê duyệt thành viên."
        )

    # 2. Get member record
    member = (
        await db.execute(
            select(TeamMember).where(TeamMember.id == member_id, TeamMember.team_id == team_id)
        )
    ).scalar_one_or_none()
    if not member or member.status != "pending":
        raise HTTPException(
            status_code=400, detail="Yêu cầu tham gia không tồn tại hoặc đã được xử lý."
        )

    if accept:
        # Check team limit
        config = (
            await db.execute(select(HackathonConfig).where(HackathonConfig.id == 1))
        ).scalar_one_or_none()
        max_size = config.max_team_size if config else 5
        count = (
            await db.execute(
                select(func.count(TeamMember.id)).where(
                    TeamMember.team_id == team_id,
                    TeamMember.status == "accepted",
                )
            )
        ).scalar_one()
        if count >= max_size:
            raise HTTPException(status_code=400, detail="Đội đã đủ số lượng thành viên tối đa.")

        member.status = "accepted"
        member.responded_at = datetime.now(timezone.utc)
    else:
        member.status = "rejected"
        member.responded_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(member)
    return member


async def transfer_leadership(
    db: AsyncSession, team_id: str, current_leader_id: str, new_leader_id: str
) -> Team:
    if current_leader_id == new_leader_id:
        raise HTTPException(status_code=400, detail="Bạn đã là nhóm trưởng của đội này.")

    # Verify current leader
    current_leader = (
        await db.execute(
            select(TeamMember).where(
                TeamMember.team_id == team_id,
                TeamMember.user_id == current_leader_id,
                TeamMember.role == "leader",
                TeamMember.status == "accepted",
            )
        )
    ).scalar_one_or_none()
    if not current_leader:
        raise HTTPException(status_code=403, detail="Bạn không phải nhóm trưởng của đội này.")

    # Verify target member is accepted in team
    new_leader = (
        await db.execute(
            select(TeamMember).where(
                TeamMember.team_id == team_id,
                TeamMember.user_id == new_leader_id,
                TeamMember.status == "accepted",
            )
        )
    ).scalar_one_or_none()
    if not new_leader:
        raise HTTPException(
            status_code=400, detail="Thành viên mới phải thuộc danh sách chính thức của đội."
        )

    current_leader.role = "member"
    new_leader.role = "leader"
    await db.commit()

    # Fetch updated team
    stmt = (
        select(Team)
        .where(Team.id == team_id)
        .options(selectinload(Team.members).selectinload(TeamMember.user))
    )
    return (await db.execute(stmt)).scalar_one()


async def leave_team(db: AsyncSession, team_id: str, user_id: str) -> None:
    member = (
        await db.execute(
            select(TeamMember).where(
                TeamMember.team_id == team_id,
                TeamMember.user_id == user_id,
                TeamMember.status == "accepted",
            )
        )
    ).scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Bạn không thuộc đội thi này.")
    if member.role == "leader":
        raise HTTPException(
            status_code=400,
            detail="Nhóm trưởng phải chuyển quyền cho thành viên khác trước khi rời đội.",
        )
    member.status = "left"
    await db.commit()


async def remove_member(
    db: AsyncSession, team_id: str, leader_id: str, target_user_id: str
) -> None:
    # Verify leader
    leader_check = (
        await db.execute(
            select(TeamMember).where(
                TeamMember.team_id == team_id,
                TeamMember.user_id == leader_id,
                TeamMember.role == "leader",
                TeamMember.status == "accepted",
            )
        )
    ).scalar_one_or_none()
    if not leader_check:
        raise HTTPException(status_code=403, detail="Chỉ nhóm trưởng mới có quyền xóa thành viên.")
    if leader_id == target_user_id:
        raise HTTPException(status_code=400, detail="Nhóm trưởng không thể tự xóa mình.")
    # Get target member
    target = (
        await db.execute(
            select(TeamMember).where(
                TeamMember.team_id == team_id,
                TeamMember.user_id == target_user_id,
                TeamMember.status == "accepted",
            )
        )
    ).scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Không tìm thấy thành viên này trong đội.")
    target.status = "left"
    await db.commit()


async def join_by_invite_code(
    db: AsyncSession, invite_code: str, user_id: str
) -> TeamMember:
    """C-5 fix: tham gia đội trực tiếp bằng invite_code (auto accept, không qua duyệt)."""
    # Tìm team theo invite_code
    team = (
        await db.execute(select(Team).where(Team.invite_code == invite_code.upper()))
    ).scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Mã mời không hợp lệ hoặc đã hết hạn.")

    # Check: team phải approved mới cho join
    if team.status not in ("approved", "pending"):
        raise HTTPException(status_code=400, detail="Đội thi này chưa được phê duyệt.")

    # Check existing membership
    existing_membership = (
        await db.execute(
            select(TeamMember).where(
                TeamMember.user_id == user_id,
                TeamMember.status == "accepted",
            )
        )
    ).scalar_one_or_none()
    if existing_membership:
        raise HTTPException(status_code=400, detail="Bạn đã thuộc một đội thi khác.")

    # Check already in this team
    existing = (
        await db.execute(
            select(TeamMember).where(
                TeamMember.team_id == team.id,
                TeamMember.user_id == user_id,
                TeamMember.status == "accepted",
            )
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Bạn đã là thành viên của đội này.")

    # Check team capacity
    config = (
        await db.execute(select(HackathonConfig).where(HackathonConfig.id == 1))
    ).scalar_one_or_none()
    max_size = config.max_team_size if config else 5
    current_count = (
        await db.execute(
            select(func.count(TeamMember.id)).where(
                TeamMember.team_id == team.id,
                TeamMember.status == "accepted",
            )
        )
    ).scalar_one()
    if current_count >= max_size:
        raise HTTPException(status_code=400, detail="Đội thi đã đủ số lượng thành viên tối đa.")

    # Auto-accept (no leader approval needed for invite code)
    from datetime import datetime, timezone
    member = TeamMember(
        team_id=team.id,
        user_id=user_id,
        role="member",
        status="accepted",
        responded_at=datetime.now(timezone.utc),
    )
    db.add(member)
    await db.commit()
    await db.refresh(member)
    return member
