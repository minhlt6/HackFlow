from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status
from app.models.ticket import SupportTicket, TicketMessage
from app.models.team import Team, TeamMember
from app.models.user import User
from app.models.config import HackathonConfig
from app.schemas.ticket import TicketCreateRequest, TicketMessageCreateRequest


async def create_ticket(
    db: AsyncSession, team_id: Optional[str], user_id: str, data: TicketCreateRequest
) -> SupportTicket:
    # 1. If team_id is provided, verify user is accepted member or leader of the team
    if team_id:
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
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bạn không thuộc danh sách thành viên chính thức của đội này.",
            )

    # 2. Check ticket enabled in config
    config = (
        await db.execute(select(HackathonConfig).where(HackathonConfig.id == 1))
    ).scalar_one_or_none()
    if config and not config.ticket_enabled:
        raise HTTPException(
            status_code=400, detail="Hệ thống Ticket hỗ trợ hiện đang tạm đóng bởi BTC."
        )

    ticket = SupportTicket(
        team_id=team_id,
        created_by=user_id,
        title=data.title,
        description=data.description,
        priority=data.priority,
        status="open",
        created_at=datetime.now(timezone.utc),
    )
    db.add(ticket)
    await db.commit()
    await db.refresh(ticket)
    return ticket


async def claim_ticket(db: AsyncSession, ticket_id: str, mentor_id: str) -> SupportTicket:
    # Check mentor role
    user = (await db.execute(select(User).where(User.id == mentor_id))).scalar_one_or_none()
    if not user or user.role not in ["mentor", "admin"]:
        raise HTTPException(
            status_code=403, detail="Chỉ Mentor hoặc Admin mới có quyền nhận ticket."
        )

    stmt = select(SupportTicket).where(SupportTicket.id == ticket_id)
    ticket = (await db.execute(stmt)).scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Không tìm thấy ticket.")

    if ticket.status != "open":
        raise HTTPException(
            status_code=400,
            detail="Ticket này đã được nhận bởi mentor khác hoặc đã được giải quyết.",
        )

    ticket.status = "in_progress"
    ticket.assigned_mentor_id = mentor_id
    ticket.assigned_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(ticket)
    return ticket


async def resolve_ticket(db: AsyncSession, ticket_id: str, mentor_id: str) -> SupportTicket:
    stmt = select(SupportTicket).where(SupportTicket.id == ticket_id)
    ticket = (await db.execute(stmt)).scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Không tìm thấy ticket.")

    if ticket.assigned_mentor_id != mentor_id:
        user = (await db.execute(select(User).where(User.id == mentor_id))).scalar_one_or_none()
        if not user or user.role != "admin":
            raise HTTPException(
                status_code=403, detail="Chỉ mentor đang phụ trách mới có thể hoàn thành ticket."
            )

    ticket.status = "resolved"
    ticket.resolved_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(ticket)
    return ticket


async def add_ticket_message(
    db: AsyncSession, ticket_id: str, sender_id: str, data: TicketMessageCreateRequest
) -> TicketMessage:
    ticket = (
        await db.execute(select(SupportTicket).where(SupportTicket.id == ticket_id))
    ).scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Không tìm thấy ticket.")

    # FIX BUG #6: Kiểm tra quyền truy cập ticket trước khi cho phép nhắn tin
    # Trước đây: bất kỳ user nào biết ticket_id đều có thể gửi message
    sender = (await db.execute(select(User).where(User.id == sender_id))).scalar_one_or_none()
    if not sender:
        raise HTTPException(status_code=401, detail="Người dùng không hợp lệ.")

    if sender.role == "admin":
        # Admin có thể nhắn vào mọi ticket
        pass
    elif sender.role == "mentor":
        # Mentor chỉ được nhắn vào ticket mình đang phụ trách
        if ticket.assigned_mentor_id != sender_id:
            raise HTTPException(
                status_code=403,
                detail="Bạn không được phân công phụ trách ticket này. Hãy claim ticket trước.",
            )
    else:
        # Participant chỉ được nhắn vào ticket của team mình
        is_team_member = (
            await db.execute(
                select(TeamMember).where(
                    TeamMember.team_id == ticket.team_id,
                    TeamMember.user_id == sender_id,
                    TeamMember.status == "accepted",
                )
            )
        ).scalar_one_or_none()
        if not is_team_member:
            raise HTTPException(
                status_code=403,
                detail="Bạn không phải thành viên của đội thi đã tạo ticket này.",
            )

    # Không cho phép nhắn tin vào ticket đã resolved (chỉ view)
    if ticket.status == "resolved":
        raise HTTPException(
            status_code=400,
            detail="Ticket đã được giải quyết. Không thể gửi thêm tin nhắn.",
        )

    msg = TicketMessage(
        ticket_id=ticket_id,
        sender_id=sender_id,
        content=data.content,
        sent_at=datetime.now(timezone.utc),
    )
    db.add(msg)
    await db.commit()

    # Eager load sender info
    stmt = (
        select(TicketMessage)
        .where(TicketMessage.id == msg.id)
        .options(selectinload(TicketMessage.sender))
    )
    return (await db.execute(stmt)).scalar_one()


async def cancel_ticket(db: AsyncSession, ticket_id: str, user_id: str) -> SupportTicket:
    ticket = (await db.execute(
        select(SupportTicket)
        .options(selectinload(SupportTicket.messages))
        .where(SupportTicket.id == ticket_id)
    )).scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Không tìm thấy ticket.")
    if ticket.status != 'open':
        raise HTTPException(status_code=400, detail="Chỉ có thể hủy ticket đang ở trạng thái 'Chờ xử lý'.")
    # Check: user phải là leader của đội tạo ticket
    from app.models.team import TeamMember
    leader_check = (await db.execute(
        select(TeamMember).where(
            TeamMember.team_id == ticket.team_id,
            TeamMember.user_id == user_id,
            TeamMember.role == 'leader',
            TeamMember.status == 'accepted',
        )
    )).scalar_one_or_none()
    if not leader_check:
        raise HTTPException(status_code=403, detail="Chỉ nhóm trưởng mới có quyền hủy ticket.")
    ticket.status = 'cancelled'
    await db.commit()
    await db.refresh(ticket)
    return ticket
