from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    BadRequestException,
    ConflictException,
    ForbiddenException,
    NotFoundException,
    UnprocessableEntityException,
)
from app.models.support import SupportTicket, TicketPriority, TicketStatus
from app.models.team import TeamMember
from app.models.user import ApprovalStatus, User, UserRole
from app.repositories.ticket_repo import ticket_repo
from app.schemas.ticket import (
    VALID_TICKET_CATEGORIES,
    TicketCreateRequest,
    TicketListResponse,
    TicketResponse,
    TicketUpdateRequest,
)


class TicketService:
    async def _get_user_team_id(self, db: AsyncSession, user_id: str) -> Optional[str]:
        res = await db.execute(select(TeamMember.team_id).where(TeamMember.user_id == user_id))
        return res.scalar_one_or_none()

    async def create_ticket(
        self,
        db: AsyncSession,
        *,
        current_user: User,
        payload: TicketCreateRequest,
    ) -> TicketResponse:
        if current_user.role not in (UserRole.CANDIDATE.value, UserRole.ADMIN.value):
            raise ForbiddenException(
                message="Chỉ Thí sinh hoặc Ban Tổ Chức mới được tạo ticket hỗ trợ.",
                error_code="FORBIDDEN_ROLE",
            )
        if (
            current_user.role == UserRole.CANDIDATE.value
            and current_user.approval_status != ApprovalStatus.APPROVED.value
        ):
            raise ForbiddenException(
                message="Tài khoản chưa được phê duyệt để tạo ticket hỗ trợ.",
                error_code="ACCOUNT_NOT_APPROVED",
            )

        category = (payload.category or "").strip()
        if category not in VALID_TICKET_CATEGORIES:
            raise UnprocessableEntityException(
                message=f"Danh mục ticket không hợp lệ: {category}",
                error_code="INVALID_TICKET_CATEGORY",
            )

        valid_priorities = {p.value for p in TicketPriority}
        priority = (payload.priority or "").strip().lower()
        if priority == "medium":
            priority = TicketPriority.NORMAL.value
        if priority not in valid_priorities:
            raise UnprocessableEntityException(
                message=f"Mức độ ưu tiên không hợp lệ: {payload.priority}",
                error_code="INVALID_TICKET_PRIORITY",
            )

        team_id = await self._get_user_team_id(db, current_user.id)
        ticket = SupportTicket(
            team_id=team_id,
            user_id=current_user.id,
            assigned_to=None,
            title=payload.title.strip(),
            content=payload.content.strip(),
            category=category,
            priority=priority,
            status=TicketStatus.OPEN.value,
            response=None,
        )
        db.add(ticket)
        await db.flush()
        await db.refresh(ticket)
        return TicketResponse.model_validate(ticket)

    async def get_my_tickets(
        self,
        db: AsyncSession,
        *,
        current_user: User,
        status: Optional[str] = None,
        priority: Optional[str] = None,
        category: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> TicketListResponse:
        if current_user.role == UserRole.JUDGE.value:
            raise ForbiddenException(
                message="Giám khảo không có quyền truy cập phân hệ Support Ticket.",
                error_code="FORBIDDEN_ROLE",
            )
        team_id = await self._get_user_team_id(db, current_user.id)
        items, total = await ticket_repo.list_for_candidate(
            db,
            user_id=current_user.id,
            team_id=team_id,
            status=status,
            priority=priority,
            category=category,
            page=page,
            page_size=page_size,
        )
        return TicketListResponse(
            items=[TicketResponse.model_validate(item) for item in items],
            page=page,
            page_size=page_size,
            total=total,
        )

    async def get_all_tickets(
        self,
        db: AsyncSession,
        *,
        current_user: User,
        status: Optional[str] = None,
        priority: Optional[str] = None,
        category: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> TicketListResponse:
        if current_user.role not in (UserRole.MENTOR.value, UserRole.ADMIN.value):
            raise ForbiddenException(
                message="Chỉ Mentor hoặc Ban Tổ Chức mới được xem danh sách ticket.",
                error_code="FORBIDDEN_ROLE",
            )
        items, total = await ticket_repo.list_for_staff(
            db,
            role=current_user.role,
            user_id=current_user.id,
            status=status,
            priority=priority,
            category=category,
            page=page,
            page_size=page_size,
        )
        return TicketListResponse(
            items=[TicketResponse.model_validate(item) for item in items],
            page=page,
            page_size=page_size,
            total=total,
        )

    async def get_ticket_detail(
        self,
        db: AsyncSession,
        *,
        ticket_id: str,
        current_user: User,
    ) -> TicketResponse:
        if current_user.role == UserRole.JUDGE.value:
            raise ForbiddenException(
                message="Giám khảo không có quyền truy cập phân hệ Support Ticket.",
                error_code="FORBIDDEN_ROLE",
            )
        ticket = await ticket_repo.get_by_id(db, ticket_id)
        if not ticket:
            raise NotFoundException(
                message="Không tìm thấy ticket yêu cầu.",
                error_code="TICKET_NOT_FOUND",
            )

        if current_user.role == UserRole.CANDIDATE.value:
            team_id = await self._get_user_team_id(db, current_user.id)
            is_owner = ticket.user_id == current_user.id
            is_teammate = bool(team_id and ticket.team_id == team_id)
            if not (is_owner or is_teammate):
                raise ForbiddenException(
                    message="Bạn không có quyền xem ticket của đội khác.",
                    error_code="FORBIDDEN_ROLE",
                )
        elif current_user.role == UserRole.MENTOR.value:
            can_view = (
                ticket.status == TicketStatus.OPEN.value and ticket.assigned_to is None
            ) or (ticket.assigned_to == current_user.id)
            if not can_view:
                raise ForbiddenException(
                    message="Mentor chỉ được xem ticket chờ tiếp nhận hoặc ticket được phân công cho mình.",
                    error_code="FORBIDDEN_ROLE",
                )

        return TicketResponse.model_validate(ticket)

    async def update_ticket(
        self,
        db: AsyncSession,
        *,
        ticket_id: str,
        current_user: User,
        payload: TicketUpdateRequest,
    ) -> TicketResponse:
        if current_user.role == UserRole.JUDGE.value:
            raise ForbiddenException(
                message="Giám khảo không có quyền xử lý ticket.",
                error_code="FORBIDDEN_ROLE",
            )

        ticket = await ticket_repo.get_by_id(db, ticket_id)
        if not ticket:
            raise NotFoundException(
                message="Không tìm thấy ticket yêu cầu.",
                error_code="TICKET_NOT_FOUND",
            )

        action = (payload.action or "").strip().lower()
        if not action:
            if payload.status == TicketStatus.IN_PROGRESS.value and ticket.status == TicketStatus.OPEN.value:
                action = "accept"
            elif payload.status == TicketStatus.RESOLVED.value:
                action = "resolve"
            elif payload.status == TicketStatus.CLOSED.value:
                action = "close"
            elif payload.response is not None:
                action = "update_response"
            else:
                raise BadRequestException(
                    message="Hành động cập nhật ticket không hợp lệ.",
                    error_code="INVALID_TICKET_TRANSITION",
                )

        is_admin = current_user.role == UserRole.ADMIN.value
        is_mentor = current_user.role == UserRole.MENTOR.value
        is_candidate = current_user.role == UserRole.CANDIDATE.value

        if action == "accept":
            if not (is_mentor or is_admin):
                raise ForbiddenException(
                    message="Chỉ Mentor hoặc Admin mới được tiếp nhận ticket.",
                    error_code="FORBIDDEN_ROLE",
                )
            if ticket.assigned_to and ticket.assigned_to != current_user.id and not is_admin:
                raise ConflictException(
                    message="Ticket này đã được người khác tiếp nhận xử lý.",
                    error_code="TICKET_ALREADY_ASSIGNED",
                )
            if ticket.status != TicketStatus.OPEN.value and not is_admin:
                raise BadRequestException(
                    message="Chỉ có thể tiếp nhận ticket đang ở trạng thái chờ xử lý (open).",
                    error_code="INVALID_TICKET_TRANSITION",
                )
            ticket.assigned_to = current_user.id
            ticket.status = TicketStatus.IN_PROGRESS.value

        elif action == "update_response":
            if not (is_mentor or is_admin):
                raise ForbiddenException(
                    message="Chỉ Mentor hoặc Admin mới được cập nhật phản hồi.",
                    error_code="FORBIDDEN_ROLE",
                )
            if is_mentor and ticket.assigned_to != current_user.id:
                raise ForbiddenException(
                    message="Mentor chỉ được phản hồi ticket được phân công cho mình.",
                    error_code="FORBIDDEN_ROLE",
                )
            if ticket.status != TicketStatus.IN_PROGRESS.value and not is_admin:
                raise BadRequestException(
                    message="Ticket phải ở trạng thái đang xử lý (in_progress) để cập nhật phản hồi tạm.",
                    error_code="INVALID_TICKET_TRANSITION",
                )
            resp_text = (payload.response or "").strip()
            if not resp_text:
                raise UnprocessableEntityException(
                    message="Nội dung phản hồi không được để trống.",
                    error_code="MISSING_TICKET_RESPONSE",
                )
            ticket.response = resp_text

        elif action == "resolve":
            if not (is_mentor or is_admin):
                raise ForbiddenException(
                    message="Chỉ Mentor hoặc Admin mới được hoàn tất xử lý ticket.",
                    error_code="FORBIDDEN_ROLE",
                )
            if is_mentor and ticket.assigned_to not in (current_user.id, None):
                raise ForbiddenException(
                    message="Mentor chỉ được giải quyết ticket được phân công cho mình.",
                    error_code="FORBIDDEN_ROLE",
                )
            if ticket.status not in (TicketStatus.OPEN.value, TicketStatus.IN_PROGRESS.value) and not is_admin:
                raise BadRequestException(
                    message="Không thể chuyển ticket sang trạng thái resolved từ trạng thái hiện tại.",
                    error_code="INVALID_TICKET_TRANSITION",
                )
            resp_text = (payload.response or "").strip()
            if not resp_text:
                raise UnprocessableEntityException(
                    message="Vui lòng nhập nội dung phản hồi trước khi đánh dấu đã giải quyết.",
                    error_code="MISSING_TICKET_RESPONSE",
                )
            if not ticket.assigned_to:
                ticket.assigned_to = current_user.id
            ticket.response = resp_text
            ticket.status = TicketStatus.RESOLVED.value

        elif action == "escalate":
            if not (is_mentor or is_admin):
                raise ForbiddenException(
                    message="Chỉ Mentor hoặc Admin mới được chuyển giao ticket.",
                    error_code="FORBIDDEN_ROLE",
                )
            if is_mentor and ticket.assigned_to != current_user.id:
                raise ForbiddenException(
                    message="Mentor chỉ được chuyển giao ticket mình đang phụ trách.",
                    error_code="FORBIDDEN_ROLE",
                )
            note = (payload.note or "").strip()
            if not note:
                raise UnprocessableEntityException(
                    message="Vui lòng nhập lý do chuyển giao ticket lên Admin.",
                    error_code="INVALID_TICKET_PAYLOAD",
                )
            ticket.assigned_to = payload.target_admin_id or None
            ticket.status = TicketStatus.IN_PROGRESS.value

        elif action == "close":
            if is_mentor:
                raise ForbiddenException(
                    message="Mentor không được đóng ticket trực tiếp.",
                    error_code="FORBIDDEN_ROLE",
                )
            if is_candidate and ticket.user_id != current_user.id:
                raise ForbiddenException(
                    message="Chỉ người tạo ticket mới được đóng ticket.",
                    error_code="FORBIDDEN_ROLE",
                )
            if ticket.status != TicketStatus.RESOLVED.value and not is_admin:
                raise BadRequestException(
                    message="Chỉ có thể đóng ticket đã được giải quyết (resolved).",
                    error_code="INVALID_TICKET_TRANSITION",
                )
            ticket.status = TicketStatus.CLOSED.value

        elif action == "reopen":
            if is_mentor:
                raise ForbiddenException(
                    message="Mentor không được tự mở lại ticket.",
                    error_code="FORBIDDEN_ROLE",
                )
            if is_candidate:
                if ticket.user_id != current_user.id:
                    raise ForbiddenException(
                        message="Chỉ người tạo ticket mới được mở lại ticket.",
                        error_code="FORBIDDEN_ROLE",
                    )
                if ticket.status != TicketStatus.RESOLVED.value:
                    raise BadRequestException(
                        message="Thí sinh chỉ có thể mở lại ticket ở trạng thái đã giải quyết (resolved).",
                        error_code="INVALID_TICKET_TRANSITION",
                    )
                updated_at = ticket.updated_at
                if updated_at.tzinfo is None:
                    updated_at = updated_at.replace(tzinfo=timezone.utc)
                hours_elapsed = (datetime.now(timezone.utc) - updated_at).total_seconds() / 3600.0
                if hours_elapsed > 48:
                    raise ConflictException(
                        message="Đã quá thời hạn 48 giờ để mở lại ticket.",
                        error_code="REOPEN_WINDOW_EXPIRED",
                    )
            elif is_admin:
                if ticket.status not in (TicketStatus.RESOLVED.value, TicketStatus.CLOSED.value):
                    raise BadRequestException(
                        message="Chỉ có thể mở lại ticket ở trạng thái resolved hoặc closed.",
                        error_code="INVALID_TICKET_TRANSITION",
                    )
            ticket.status = TicketStatus.IN_PROGRESS.value

        else:
            raise BadRequestException(
                message=f"Hành động '{action}' không được hỗ trợ.",
                error_code="INVALID_TICKET_TRANSITION",
            )

        await db.flush()
        await db.refresh(ticket)
        return TicketResponse.model_validate(ticket)


ticket_service = TicketService()
