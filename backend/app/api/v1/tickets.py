from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.core.security import get_current_user_payload
from app.models.ticket import SupportTicket, TicketMessage
from app.models.team import Team, TeamMember
from app.models.user import User
from app.schemas.ticket import (
    TicketCreateRequest,
    TicketMessageCreateRequest,
    SupportTicketResponse,
    TicketMessageResponse,
)
from app.schemas.common import APIResponse
from app.services import ticket_service

router = APIRouter(prefix="/tickets", tags=["Tickets"])


def format_ticket_response(ticket: SupportTicket) -> SupportTicketResponse:
    team_name = ticket.team.name if ticket.team else None
    messages_resp = []
    if ticket.messages:
        for m in ticket.messages:
            messages_resp.append(
                TicketMessageResponse(
                    id=m.id,
                    ticket_id=m.ticket_id,
                    sender_id=m.sender_id,
                    content=m.content,
                    sent_at=m.sent_at,
                    sender=m.sender,
                )
            )
    return SupportTicketResponse(
        id=ticket.id,
        team_id=ticket.team_id,
        team_name=team_name,
        created_by=ticket.created_by,
        title=ticket.title,
        description=ticket.description,
        priority=ticket.priority,
        status=ticket.status,
        assigned_mentor_id=ticket.assigned_mentor_id,
        assigned_mentor=ticket.assigned_mentor,
        created_at=ticket.created_at,
        assigned_at=ticket.assigned_at,
        resolved_at=ticket.resolved_at,
        messages=messages_resp,
    )


# FIX B01: GET /tickets — filter theo role
# - participant: chỉ thấy ticket của team mình
# - mentor: ticket assigned cho mình + pending pool chưa ai nhận
# - admin: xem toàn bộ
@router.get("/", response_model=APIResponse[List[SupportTicketResponse]])
async def list_tickets(
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db),
):
    user_id = payload.get("sub")
    user_role = payload.get("role", "participant")

    if user_role == "admin":
        stmt = (
            select(SupportTicket)
            .options(
                selectinload(SupportTicket.team),
                selectinload(SupportTicket.assigned_mentor),
                selectinload(SupportTicket.messages).selectinload(TicketMessage.sender),
            )
            .order_by(SupportTicket.created_at.desc())
        )
    elif user_role == "mentor":
        stmt = (
            select(SupportTicket)
            .where(
                or_(
                    SupportTicket.assigned_mentor_id == user_id,
                    SupportTicket.status == "pending",
                )
            )
            .options(
                selectinload(SupportTicket.team),
                selectinload(SupportTicket.assigned_mentor),
                selectinload(SupportTicket.messages).selectinload(TicketMessage.sender),
            )
            .order_by(SupportTicket.created_at.desc())
        )
    else:
        # Participant: thấy ticket của team mình HOẶC ticket do chính mình tạo
        member = (
            await db.execute(
                select(TeamMember).where(
                    TeamMember.user_id == user_id,
                    TeamMember.status == "accepted",
                )
            )
        ).scalar_one_or_none()

        filters = [SupportTicket.created_by == user_id]
        if member:
            filters.append(SupportTicket.team_id == member.team_id)

        stmt = (
            select(SupportTicket)
            .where(or_(*filters))
            .options(
                selectinload(SupportTicket.team),
                selectinload(SupportTicket.assigned_mentor),
                selectinload(SupportTicket.messages).selectinload(TicketMessage.sender),
            )
            .order_by(SupportTicket.created_at.desc())
        )

    tickets = (await db.execute(stmt)).scalars().all()
    return APIResponse(
        success=True,
        data=[format_ticket_response(t) for t in tickets],
        message="Lấy danh sách ticket thành công.",
    )


@router.get("/pool", response_model=APIResponse[List[SupportTicketResponse]])
async def get_ticket_pool(
    priority: Optional[str] = Query(None),
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db),
):
    """Ticket pool: tất cả ticket status='open' chưa có mentor nhận. Yêu cầu đăng nhập."""
    user_role = payload.get("role", "participant")
    if user_role not in ["mentor", "admin"]:
        raise HTTPException(
            status_code=403,
            detail="Chỉ Mentor hoặc Admin mới xem được danh sách ticket chờ.",
        )
    stmt = (
        select(SupportTicket)
        .where(SupportTicket.status == "open")
        .options(
            selectinload(SupportTicket.team),
            selectinload(SupportTicket.assigned_mentor),
            selectinload(SupportTicket.messages).selectinload(TicketMessage.sender),
        )
        .order_by(SupportTicket.created_at.asc())
    )
    if priority:
        stmt = stmt.where(SupportTicket.priority == priority)
    tickets = (await db.execute(stmt)).scalars().all()
    return APIResponse(
        success=True,
        data=[format_ticket_response(t) for t in tickets],
        message="Lấy danh sách ticket chờ xử lý thành công.",
    )


@router.post("/{ticket_id}/cancel", response_model=APIResponse[SupportTicketResponse])
async def cancel_ticket(
    ticket_id: str,
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db),
):
    """Participant leader hủy ticket khi vấn đề đã tự giải quyết."""
    user_id = payload.get("sub")
    ticket = await ticket_service.cancel_ticket(db, ticket_id, user_id)
    return APIResponse(success=True, data=format_ticket_response(ticket), message="Đã hủy ticket.")


@router.get("/my-tickets", response_model=APIResponse[List[SupportTicketResponse]])
async def get_my_assigned_tickets(
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db),
):
    mentor_id = payload.get("sub")
    stmt = (
        select(SupportTicket)
        .where(SupportTicket.assigned_mentor_id == mentor_id)
        .options(
            selectinload(SupportTicket.team),
            selectinload(SupportTicket.assigned_mentor),
            selectinload(SupportTicket.messages).selectinload(TicketMessage.sender),
        )
        .order_by(SupportTicket.created_at.desc())
    )
    tickets = (await db.execute(stmt)).scalars().all()
    return APIResponse(
        success=True,
        data=[format_ticket_response(t) for t in tickets],
        message="Lấy danh sách ticket của tôi thành công.",
    )


@router.get("/team/{team_id}", response_model=APIResponse[List[SupportTicketResponse]])
async def get_team_tickets(team_id: str, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(SupportTicket)
        .where(SupportTicket.team_id == team_id)
        .options(
            selectinload(SupportTicket.team),
            selectinload(SupportTicket.assigned_mentor),
            selectinload(SupportTicket.messages).selectinload(TicketMessage.sender),
        )
        .order_by(SupportTicket.created_at.desc())
    )
    tickets = (await db.execute(stmt)).scalars().all()
    return APIResponse(
        success=True,
        data=[format_ticket_response(t) for t in tickets],
        message="Lấy danh sách ticket của đội thành công.",
    )


@router.post("/", response_model=APIResponse[SupportTicketResponse])
async def create_ticket(
    data: TicketCreateRequest,
    team_id: Optional[str] = Query(None, description="ID đội tạo ticket (nếu có)"),
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db),
):
    user_id = payload.get("sub")
    ticket = await ticket_service.create_ticket(db, team_id, user_id, data)
    stmt = (
        select(SupportTicket)
        .where(SupportTicket.id == ticket.id)
        .options(
            selectinload(SupportTicket.team),
            selectinload(SupportTicket.assigned_mentor),
            selectinload(SupportTicket.messages),
        )
    )
    loaded = (await db.execute(stmt)).scalar_one()
    return APIResponse(
        success=True,
        data=format_ticket_response(loaded),
        message="Gửi ticket hỗ trợ thành công. Mentor sẽ sớm tiếp nhận yêu cầu.",
    )


@router.post("/{id}/claim", response_model=APIResponse[SupportTicketResponse])
async def claim_ticket(
    id: str,
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db),
):
    user_id = payload.get("sub")
    ticket = await ticket_service.claim_ticket(db, id, user_id)
    stmt = (
        select(SupportTicket)
        .where(SupportTicket.id == ticket.id)
        .options(
            selectinload(SupportTicket.team),
            selectinload(SupportTicket.assigned_mentor),
            selectinload(SupportTicket.messages),
        )
    )
    loaded = (await db.execute(stmt)).scalar_one()
    return APIResponse(
        success=True,
        data=format_ticket_response(loaded),
        message="Tiếp nhận ticket thành công.",
    )


@router.post("/{id}/resolve", response_model=APIResponse[SupportTicketResponse])
async def resolve_ticket(
    id: str,
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db),
):
    user_id = payload.get("sub")
    ticket = await ticket_service.resolve_ticket(db, id, user_id)
    stmt = (
        select(SupportTicket)
        .where(SupportTicket.id == ticket.id)
        .options(
            selectinload(SupportTicket.team),
            selectinload(SupportTicket.assigned_mentor),
            selectinload(SupportTicket.messages),
        )
    )
    loaded = (await db.execute(stmt)).scalar_one()
    return APIResponse(
        success=True,
        data=format_ticket_response(loaded),
        message="Đã hoàn thành và đóng ticket hỗ trợ.",
    )


# FIX: PATCH /{id} — frontend TicketKanban gọi PATCH với {status: 'resolved'}
@router.patch("/{id}", response_model=APIResponse[SupportTicketResponse])
async def update_ticket_status(
    id: str,
    body: dict,
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db),
):
    user_id = payload.get("sub")
    new_status = body.get("status")
    if new_status == "resolved":
        ticket = await ticket_service.resolve_ticket(db, id, user_id)
    else:
        raise HTTPException(status_code=400, detail="Chỉ hỗ trợ cập nhật status='resolved'.")
    stmt = (
        select(SupportTicket)
        .where(SupportTicket.id == ticket.id)
        .options(
            selectinload(SupportTicket.team),
            selectinload(SupportTicket.assigned_mentor),
            selectinload(SupportTicket.messages),
        )
    )
    loaded = (await db.execute(stmt)).scalar_one()
    return APIResponse(
        success=True, data=format_ticket_response(loaded), message="Cập nhật ticket thành công."
    )


@router.post("/{id}/messages", response_model=APIResponse[TicketMessageResponse])
async def add_message(
    id: str,
    data: TicketMessageCreateRequest,
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db),
):
    user_id = payload.get("sub")
    msg = await ticket_service.add_ticket_message(db, id, user_id, data)
    return APIResponse(
        success=True,
        data=TicketMessageResponse(
            id=msg.id,
            ticket_id=msg.ticket_id,
            sender_id=msg.sender_id,
            content=msg.content,
            sent_at=msg.sent_at,
            sender=msg.sender,
        ),
        message="Gửi tin nhắn thành công.",
    )
