from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.deps import get_current_user, require_role
from app.models.user import User, UserRole
from app.schemas.response import ApiResponse, success_response
from app.schemas.room import (
    AssignTeamRoomZoneRequest,
    AutoDivideZonesRequest,
    PeerEvaluationSubmitRequest,
    RoomCheckpointScheduleUpsertRequest,
    RoomCreateRequest,
    RoomStageAdvanceRequest,
    RoomUpdateRequest,
    ZoneCreateRequest,
)
from app.services.room_service import room_service

router = APIRouter()


@router.get(
    "",
    response_model=ApiResponse,
    summary="Lấy danh sách các Phòng / Lớp học AI Thực Chiến kèm Zone và cấu hình Checkpoint",
)
async def list_rooms(
    db: AsyncSession = Depends(get_db),
):
    data = await room_service.list_rooms(db)
    return success_response(
        data=[item.model_dump(mode="json") for item in data],
        message="Lấy danh sách phòng thi AI Thực Chiến thành công.",
    )


@router.get(
    "/standings/three-stages",
    response_model=ApiResponse,
    summary="Lấy bảng xếp hạng chấm chéo 3 giai đoạn (Trong Zone -> Cấp Phòng -> Liên Phòng)",
)
async def get_three_stage_standings(
    room_id: Optional[str] = Query(default=None, description="Lọc Giai đoạn 1 & 2 theo ID phòng"),
    db: AsyncSession = Depends(get_db),
):
    data = await room_service.get_three_stage_standings(db, room_id=room_id)
    return success_response(
        data=data.model_dump(mode="json"),
        message="Lấy bảng xếp hạng 3 giai đoạn chấm chéo thành công.",
    )


@router.get(
    "/peer-evaluations",
    response_model=ApiResponse,
    summary="Lấy danh sách phiếu chấm điểm chéo giữa các đội",
)
async def list_peer_evaluations(
    stage: Optional[str] = Query(default=None, description="Giai đoạn chấm: stage_1_zone | stage_2_room | stage_3_cross_room"),
    room_id: Optional[str] = Query(default=None),
    zone_id: Optional[str] = Query(default=None),
    evaluator_team_id: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    data = await room_service.list_peer_evaluations(
        db,
        stage=stage,
        room_id=room_id,
        zone_id=zone_id,
        evaluator_team_id=evaluator_team_id,
    )
    return success_response(
        data=[item.model_dump(mode="json") for item in data],
        message="Lấy danh sách phiếu chấm chéo thành công.",
    )


@router.post(
    "/peer-evaluations",
    response_model=ApiResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Gửi hoặc cập nhật phiếu chấm điểm chéo (Vòng 1 trong Zone, Vòng 2 cấp Phòng, Vòng 3 Liên Phòng)",
)
async def submit_peer_evaluation(
    payload: PeerEvaluationSubmitRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    data = await room_service.submit_peer_evaluation(db, current_user, payload)
    return success_response(
        data=data.model_dump(mode="json"),
        message="Gửi phiếu chấm điểm chéo thành công.",
        status_code=status.HTTP_201_CREATED,
    )


@router.get(
    "/{room_id}",
    response_model=ApiResponse,
    summary="Lấy chi tiết một Phòng thi AI Thực Chiến",
)
async def get_room(
    room_id: str,
    db: AsyncSession = Depends(get_db),
):
    data = await room_service.get_room(db, room_id)
    return success_response(
        data=data.model_dump(mode="json"),
        message="Lấy thông tin phòng thi thành công.",
    )


@router.post(
    "",
    response_model=ApiResponse,
    status_code=status.HTTP_201_CREATED,
    summary="[Admin] Tạo phòng/lớp học AI Thực Chiến mới kèm các Zone mặc định",
)
async def create_room(
    payload: RoomCreateRequest,
    _admin: User = Depends(require_role(UserRole.ADMIN.value)),
    db: AsyncSession = Depends(get_db),
):
    data = await room_service.create_room(db, payload)
    return success_response(
        data=data.model_dump(mode="json"),
        message="Tạo phòng thi AI Thực Chiến thành công.",
        status_code=status.HTTP_201_CREATED,
    )


@router.patch(
    "/{room_id}",
    response_model=ApiResponse,
    summary="[Admin] Cập nhật cấu hình phòng thi (khung giờ, người quản lý, Top 1/Top 3)",
)
async def update_room(
    room_id: str,
    payload: RoomUpdateRequest,
    _admin: User = Depends(require_role(UserRole.ADMIN.value)),
    db: AsyncSession = Depends(get_db),
):
    data = await room_service.update_room(db, room_id, payload)
    return success_response(
        data=data.model_dump(mode="json"),
        message="Cập nhật cấu hình phòng thi thành công.",
    )


@router.post(
    "/{room_id}/zones",
    response_model=ApiResponse,
    status_code=status.HTTP_201_CREATED,
    summary="[Admin] Tạo thêm một Zone mới trong Phòng thi",
)
async def create_zone(
    room_id: str,
    payload: ZoneCreateRequest,
    _admin: User = Depends(require_role(UserRole.ADMIN.value)),
    db: AsyncSession = Depends(get_db),
):
    data = await room_service.create_zone(db, room_id, payload)
    return success_response(
        data=data.model_dump(mode="json"),
        message="Tạo Zone mới trong phòng thành công.",
        status_code=status.HTTP_201_CREATED,
    )


@router.post(
    "/{room_id}/assign-team",
    response_model=ApiResponse,
    summary="[Admin] Phân bổ đội thi vào Phòng và Zone",
)
async def assign_team_to_room_zone(
    room_id: str,
    payload: AssignTeamRoomZoneRequest,
    _admin: User = Depends(require_role(UserRole.ADMIN.value)),
    db: AsyncSession = Depends(get_db),
):
    data = await room_service.assign_team_to_room_zone(db, room_id, payload)
    return success_response(
        data=data.model_dump(mode="json"),
        message="Phân bổ đội thi vào Phòng/Zone thành công.",
    )


@router.post(
    "/{room_id}/auto-divide-zones",
    response_model=ApiResponse,
    summary="[Admin] Tự động chia đều các đội trong Phòng vào các Zone để chấm chéo",
)
async def auto_divide_zones(
    room_id: str,
    payload: Optional[AutoDivideZonesRequest] = None,
    _admin: User = Depends(require_role(UserRole.ADMIN.value)),
    db: AsyncSession = Depends(get_db),
):
    data = await room_service.auto_divide_zones(db, room_id, payload)
    return success_response(
        data=data.model_dump(mode="json"),
        message="Tự động chia đều các đội vào các Zone thành công.",
    )


@router.put(
    "/{room_id}/checkpoint-schedules",
    response_model=ApiResponse,
    summary="[Admin] Cấu hình khung giờ nộp Checkpoint riêng cho Phòng",
)
async def upsert_room_checkpoint_schedule(
    room_id: str,
    payload: RoomCheckpointScheduleUpsertRequest,
    _admin: User = Depends(require_role(UserRole.ADMIN.value)),
    db: AsyncSession = Depends(get_db),
):
    data = await room_service.upsert_room_checkpoint_schedule(db, room_id, payload)
    return success_response(
        data=data.model_dump(mode="json"),
        message="Cập nhật lịch nộp Checkpoint riêng cho phòng thành công.",
    )


@router.post(
    "/{room_id}/advance-stage",
    response_model=ApiResponse,
    summary="[Admin] Chuyển giai đoạn chấm điểm của Phòng & tự động chốt Top 1 Zone / Top N Phòng",
)
async def advance_room_stage(
    room_id: str,
    payload: RoomStageAdvanceRequest,
    _admin: User = Depends(require_role(UserRole.ADMIN.value)),
    db: AsyncSession = Depends(get_db),
):
    data = await room_service.advance_room_stage(db, room_id, payload)
    return success_response(
        data=data.model_dump(mode="json"),
        message=f"Đã chuyển phòng sang giai đoạn '{payload.target_stage}' thành công.",
    )
