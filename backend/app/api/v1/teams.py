from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.core.security import get_current_user_payload
from app.models.team import Team, TeamMember
from app.schemas.team import (
    TeamCreateRequest,
    TeamResponse,
    TransferLeaderRequest,
    TeamMemberResponse,
)
from app.schemas.common import APIResponse
from app.services import team_service

router = APIRouter(prefix="/teams", tags=["Teams"])


@router.post("/", response_model=APIResponse[TeamResponse])
async def create_team(
    data: TeamCreateRequest,
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db),
):
    user_id = payload.get("sub")
    team = await team_service.create_team(db, data, user_id)
    return APIResponse(
        success=True,
        data=TeamResponse.model_validate(team),
        message="Tạo đội thi thành công. Vui lòng chờ Ban tổ chức phê duyệt.",
    )


@router.get("/my-team", response_model=APIResponse[Optional[TeamResponse]])
async def get_my_team(
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db),
):
    user_id = payload.get("sub")
    # Find active team member
    member = (
        await db.execute(
            select(TeamMember).where(
                TeamMember.user_id == user_id,
                TeamMember.status == "accepted",
            )
        )
    ).scalar_one_or_none()

    if not member:
        return APIResponse(success=True, data=None, message="Bạn chưa thuộc đội thi nào.")

    stmt = (
        select(Team)
        .where(Team.id == member.team_id)
        .options(
            selectinload(Team.members).selectinload(TeamMember.user),
            selectinload(Team.topic_selection),
        )
    )
    team = (await db.execute(stmt)).scalar_one()
    resp = TeamResponse.model_validate(team)
    if team.topic_selection:
        resp.selected_subtopic_id = team.topic_selection.subtopic_id

    return APIResponse(success=True, data=resp, message="Lấy thông tin đội thành công.")


@router.get("/", response_model=APIResponse[List[TeamResponse]])
async def list_teams(
    status_filter: Optional[str] = Query(None, alias="status"),
    # FIX C-02: Optional auth — unauthenticated hoặc participant không thấy members
    payload: Optional[dict] = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db),
):
    user_role = payload.get("role", "guest") if payload else "guest"

    stmt = select(Team).options(
        selectinload(Team.members).selectinload(TeamMember.user),
        selectinload(Team.topic_selection),
    )
    if status_filter:
        stmt = stmt.where(Team.status == status_filter)

    teams = (await db.execute(stmt)).scalars().all()
    results = []
    for t in teams:
        res = TeamResponse.model_validate(t)
        if t.topic_selection:
            res.selected_subtopic_id = t.topic_selection.subtopic_id
        # FIX C-02: Ẩn danh sách thành viên với guest/participant để tránh IDOR
        if user_role not in ("admin", "mentor", "judge"):
            res.members = []
        results.append(res)

    return APIResponse(success=True, data=results, message="Lấy danh sách đội thành công.")


@router.get("/{id}", response_model=APIResponse[TeamResponse])
async def get_team_detail(id: str, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(Team)
        .where(Team.id == id)
        .options(
            selectinload(Team.members).selectinload(TeamMember.user),
            selectinload(Team.topic_selection),
        )
    )
    team = (await db.execute(stmt)).scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Không tìm thấy đội thi.")

    resp = TeamResponse.model_validate(team)
    if team.topic_selection:
        resp.selected_subtopic_id = team.topic_selection.subtopic_id
    return APIResponse(success=True, data=resp, message="Lấy chi tiết đội thi thành công.")


@router.post("/{id}/join", response_model=APIResponse[TeamMemberResponse])
async def join_team(
    id: str,
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db),
):
    user_id = payload.get("sub")
    member = await team_service.request_join_team(db, id, user_id)
    return APIResponse(
        success=True,
        data=TeamMemberResponse.model_validate(member),
        message="Gửi yêu cầu tham gia đội thành công. Đang chờ Trưởng nhóm phê duyệt.",
    )


@router.post("/{id}/members/{member_id}/respond", response_model=APIResponse[TeamMemberResponse])
async def respond_join_request(
    id: str,
    member_id: str,
    accept: bool = Query(...),
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db),
):
    user_id = payload.get("sub")
    member = await team_service.respond_to_join_request(db, id, member_id, accept, user_id)
    msg = "Đã chấp nhận thành viên vào đội." if accept else "Đã từ chối yêu cầu tham gia."
    return APIResponse(success=True, data=TeamMemberResponse.model_validate(member), message=msg)


@router.post("/{id}/transfer-leader", response_model=APIResponse[TeamResponse])
async def transfer_leader(
    id: str,
    data: TransferLeaderRequest,
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db),
):
    user_id = payload.get("sub")
    team = await team_service.transfer_leadership(db, id, user_id, data.new_leader_id)
    return APIResponse(
        success=True,
        data=TeamResponse.model_validate(team),
        message="Chuyển quyền nhóm trưởng thành công.",
    )


@router.post("/{id}/leave", response_model=APIResponse[dict])
async def leave_team(
    id: str,
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db),
):
    user_id = payload.get("sub")
    await team_service.leave_team(db, id, user_id)
    return APIResponse(success=True, data={}, message="Rời đội thành công.")


@router.delete("/{id}/members/{target_user_id}", response_model=APIResponse[dict])
async def remove_member(
    id: str,
    target_user_id: str,
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db),
):
    user_id = payload.get("sub")
    await team_service.remove_member(db, id, user_id, target_user_id)
    return APIResponse(success=True, data={}, message="Đã xóa thành viên khỏi đội.")


@router.post("/join", response_model=APIResponse[TeamMemberResponse])
async def join_team_by_code(
    invite_code: str = Body(..., embed=True),
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db),
):
    """C-5 fix: tham gia đội bằng invite code (không cần duyệt của trưởng nhóm)."""
    user_id = payload.get("sub")
    member = await team_service.join_by_invite_code(db, invite_code, user_id)
    return APIResponse(
        success=True,
        data=TeamMemberResponse.model_validate(member),
        message="Tham gia đội thành công qua mã mời.",
    )
