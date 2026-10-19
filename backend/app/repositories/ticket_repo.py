from typing import List, Optional, Tuple
from sqlalchemy import case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.support import SupportTicket, TicketPriority, TicketStatus


class TicketRepository:
    async def get_by_id(
        self, db: AsyncSession, ticket_id: str
    ) -> Optional[SupportTicket]:
        stmt = select(SupportTicket).where(SupportTicket.id == ticket_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_for_candidate(
        self,
        db: AsyncSession,
        *,
        user_id: str,
        team_id: Optional[str],
        status: Optional[str] = None,
        priority: Optional[str] = None,
        category: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Tuple[List[SupportTicket], int]:
        conditions = [SupportTicket.user_id == user_id]
        if team_id:
            conditions.append(SupportTicket.team_id == team_id)

        base_filter = or_(*conditions)
        stmt = select(SupportTicket).where(base_filter)
        count_stmt = select(func.count(SupportTicket.id)).where(base_filter)

        if status:
            stmt = stmt.where(SupportTicket.status == status)
            count_stmt = count_stmt.where(SupportTicket.status == status)
        if priority:
            stmt = stmt.where(SupportTicket.priority == priority)
            count_stmt = count_stmt.where(SupportTicket.priority == priority)
        if category:
            stmt = stmt.where(SupportTicket.category == category)
            count_stmt = count_stmt.where(SupportTicket.category == category)

        priority_order = case(
            (SupportTicket.priority == TicketPriority.URGENT.value, 1),
            (SupportTicket.priority == TicketPriority.HIGH.value, 2),
            (SupportTicket.priority == TicketPriority.NORMAL.value, 3),
            else_=4,
        )
        stmt = (
            stmt.order_by(priority_order.asc(), SupportTicket.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )

        total = (await db.execute(count_stmt)).scalar() or 0
        items = list((await db.execute(stmt)).scalars().all())
        return items, total

    async def list_for_staff(
        self,
        db: AsyncSession,
        *,
        role: str,
        user_id: str,
        status: Optional[str] = None,
        priority: Optional[str] = None,
        category: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Tuple[List[SupportTicket], int]:
        stmt = select(SupportTicket)
        count_stmt = select(func.count(SupportTicket.id))

        if role == "mentor":
            mentor_scope = or_(
                (SupportTicket.status == TicketStatus.OPEN.value)
                & (SupportTicket.assigned_to.is_(None)),
                SupportTicket.assigned_to == user_id,
            )
            stmt = stmt.where(mentor_scope)
            count_stmt = count_stmt.where(mentor_scope)

        if status:
            stmt = stmt.where(SupportTicket.status == status)
            count_stmt = count_stmt.where(SupportTicket.status == status)
        if priority:
            stmt = stmt.where(SupportTicket.priority == priority)
            count_stmt = count_stmt.where(SupportTicket.priority == priority)
        if category:
            stmt = stmt.where(SupportTicket.category == category)
            count_stmt = count_stmt.where(SupportTicket.category == category)

        priority_order = case(
            (SupportTicket.priority == TicketPriority.URGENT.value, 1),
            (SupportTicket.priority == TicketPriority.HIGH.value, 2),
            (SupportTicket.priority == TicketPriority.NORMAL.value, 3),
            else_=4,
        )
        stmt = (
            stmt.order_by(priority_order.asc(), SupportTicket.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )

        total = (await db.execute(count_stmt)).scalar() or 0
        items = list((await db.execute(stmt)).scalars().all())
        return items, total


ticket_repo = TicketRepository()
