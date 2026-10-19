from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.response import ApiResponse
from app.schemas.ticket import (
    TicketCreateRequest,
    TicketListResponse,
    TicketResponse,
    TicketUpdateRequest,
)
from app.services.ticket_service import ticket_service

router = APIRouter()


@router.post(
    "",
    response_model=ApiResponse[TicketResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Tạo yêu cầu hỗ trợ kỹ thuật mới (Thí sinh)",
)
async def create_ticket(
    payload: TicketCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ApiResponse[TicketResponse]:
    data = await ticket_service.create_ticket(db, current_user=current_user, payload=payload)
    return ApiResponse(success=True, data=data, message="Tạo yêu cầu hỗ trợ thành công.")


@router.get(
    "/me",
    response_model=ApiResponse[TicketListResponse],
    summary="Lấy danh sách ticket của tôi / đội tôi (Thí sinh)",
)
async def get_my_tickets(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    priority: Optional[str] = Query(default=None),
    category: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ApiResponse[TicketListResponse]:
    data = await ticket_service.get_my_tickets(
        db,
        current_user=current_user,
        status=status_filter,
        priority=priority,
        category=category,
        page=page,
        page_size=page_size,
    )
    return ApiResponse(success=True, data=data, message="Lấy danh sách ticket của đội thành công.")


@router.get(
    "",
    response_model=ApiResponse[TicketListResponse],
    summary="Lấy danh sách ticket hỗ trợ (Mentor & Admin)",
)
async def get_all_tickets(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    priority: Optional[str] = Query(default=None),
    category: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ApiResponse[TicketListResponse]:
    data = await ticket_service.get_all_tickets(
        db,
        current_user=current_user,
        status=status_filter,
        priority=priority,
        category=category,
        page=page,
        page_size=page_size,
    )
    return ApiResponse(success=True, data=data, message="Lấy danh sách ticket thành công.")


@router.get(
    "/{ticket_id}",
    response_model=ApiResponse[TicketResponse],
    summary="Xem chi tiết một ticket hỗ trợ",
)
async def get_ticket_detail(
    ticket_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ApiResponse[TicketResponse]:
    data = await ticket_service.get_ticket_detail(
        db, ticket_id=ticket_id, current_user=current_user
    )
    return ApiResponse(success=True, data=data, message="Lấy thông tin chi tiết ticket thành công.")


@router.patch(
    "/{ticket_id}",
    response_model=ApiResponse[TicketResponse],
    summary="Cập nhật trạng thái / phản hồi ticket (Mentor, Admin, Thí sinh)",
)
async def update_ticket(
    ticket_id: str,
    payload: TicketUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ApiResponse[TicketResponse]:
    data = await ticket_service.update_ticket(
        db, ticket_id=ticket_id, current_user=current_user, payload=payload
    )
    return ApiResponse(success=True, data=data, message="Cập nhật ticket thành công.")
