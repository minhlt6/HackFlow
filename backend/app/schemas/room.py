from datetime import datetime
from typing import Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


class ZoneCreateRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=32, description="Mã Zone (ví dụ: ZONE-A)")
    name: str = Field(..., min_length=1, max_length=128, description="Tên Zone (ví dụ: Zone A - AI Agent)")
    max_teams: int = Field(default=5, ge=2, le=20, description="Số đội tối đa trong Zone")


class ZoneResponse(BaseModel):
    id: str
    room_id: str
    code: str
    name: str
    max_teams: int
    team_count: int = 0
    winner_team_id: Optional[str] = None
    winner_team_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class RoomCheckpointScheduleUpsertRequest(BaseModel):
    checkpoint_id: str = Field(..., description="ID của Checkpoint toàn cục")
    start_time: datetime = Field(..., description="Thời điểm mở cổng nộp riêng cho phòng này (UTC)")
    deadline: datetime = Field(..., description="Hạn chót nộp bài riêng cho phòng này (UTC)")
    is_active: bool = Field(default=True, description="Trạng thái kích hoạt mốc nộp bài tại phòng này")


class RoomCheckpointScheduleResponse(BaseModel):
    id: str
    room_id: str
    checkpoint_id: str
    checkpoint_title: Optional[str] = None
    start_time: datetime
    deadline: datetime
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class RoomCreateRequest(BaseModel):
    code: str = Field(..., min_length=2, max_length=32, description="Mã phòng/lớp (ví dụ: AI-TC-CA1)")
    name: str = Field(..., min_length=3, max_length=128, description="Tên phòng/lớp học AI Thực Chiến")
    description: Optional[str] = Field(default=None, description="Mô tả khung giờ / ca thi / địa điểm")
    manager_id: Optional[str] = Field(default=None, description="ID người quản lý phòng (Admin)")
    manager_name: Optional[str] = Field(default=None, description="Họ tên người quản lý phòng")
    capacity: int = Field(default=40, ge=5, le=500, description="Sức chứa học viên/thí sinh của phòng")
    start_time: datetime = Field(..., description="Thời gian bắt đầu ca thi của phòng (UTC)")
    end_time: datetime = Field(..., description="Thời gian kết thúc ca thi của phòng (UTC)")
    room_top_n: int = Field(default=1, ge=1, le=5, description="Số đội đại diện phòng lên Vòng 3 Liên Phòng (1 hoặc 3)")
    zone_count: int = Field(default=3, ge=1, le=10, description="Số lượng Zone khởi tạo mặc định trong phòng")
    zone_max_teams: int = Field(default=5, ge=2, le=20, description="Số đội tối đa mỗi Zone")

    @field_validator("code")
    @classmethod
    def normalize_code(cls, v: str) -> str:
        return v.strip().upper()


class RoomUpdateRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=3, max_length=128)
    description: Optional[str] = None
    manager_id: Optional[str] = None
    manager_name: Optional[str] = None
    capacity: Optional[int] = Field(default=None, ge=5, le=500)
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    room_top_n: Optional[int] = Field(default=None, ge=1, le=5)
    judging_stage: Optional[str] = None
    is_active: Optional[bool] = None


class RoomTeamSummary(BaseModel):
    id: str
    team_name: str
    room_id: Optional[str] = None
    zone_id: Optional[str] = None
    zone_name: Optional[str] = None
    topic_name: Optional[str] = None
    is_zone_winner: bool = False
    is_room_winner: bool = False


class RoomResponse(BaseModel):
    id: str
    code: str
    name: str
    description: Optional[str] = None
    manager_id: Optional[str] = None
    manager_name: Optional[str] = None
    capacity: int
    start_time: datetime
    end_time: datetime
    judging_stage: str
    room_top_n: int
    is_active: bool
    team_count: int = 0
    zones: List[ZoneResponse] = []
    checkpoint_schedules: List[RoomCheckpointScheduleResponse] = []
    teams: List[RoomTeamSummary] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class AssignTeamRoomZoneRequest(BaseModel):
    team_id: str = Field(..., description="ID đội thi")
    zone_id: Optional[str] = Field(default=None, description="ID Zone trong phòng (tùy chọn)")


class AutoDivideZonesRequest(BaseModel):
    zone_count: Optional[int] = Field(
        default=None,
        ge=1,
        le=10,
        description="Nếu truyền vào, tạo thêm hoặc chia đều các đội trong phòng vào số lượng Zone tương ứng",
    )


class PeerEvaluationSubmitRequest(BaseModel):
    stage: str = Field(
        ...,
        description="Giai đoạn chấm chéo: 'stage_1_zone' | 'stage_2_room' | 'stage_3_cross_room'",
    )
    evaluator_team_id: Optional[str] = Field(
        default=None,
        description="ID đội chấm điểm (tự động suy ra từ user đăng nhập nếu là thí sinh)",
    )
    target_team_id: str = Field(..., description="ID đội được chấm điểm")
    criteria_scores: Dict[str, float] = Field(
        default_factory=dict,
        description="Điểm chi tiết từng tiêu chí {criterion_id_or_name: score}",
    )
    total_score: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=100.0,
        description="Tổng điểm phiếu chấm (0 - 100). Nếu không truyền sẽ tự tính từ criteria_scores.",
    )
    comment: Optional[str] = Field(default=None, max_length=1000, description="Nhận xét góp ý cho đội bạn")


class PeerEvaluationResponse(BaseModel):
    id: str
    stage: str
    room_id: Optional[str] = None
    zone_id: Optional[str] = None
    evaluator_team_id: str
    evaluator_team_name: Optional[str] = None
    target_team_id: str
    target_team_name: Optional[str] = None
    submitted_by: Optional[str] = None
    criteria_scores: Dict[str, float]
    total_score: float
    comment: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class RoomStageAdvanceRequest(BaseModel):
    target_stage: str = Field(
        ...,
        description="Trạng thái giai đoạn tiếp theo: 'stage_1_zone' | 'stage_2_room' | 'stage_3_cross_room' | 'completed'",
    )
    room_top_n: Optional[int] = Field(
        default=None,
        ge=1,
        le=5,
        description="Cập nhật cấu hình Top N của phòng lên thuyết trình chéo (1 hoặc 3)",
    )


class StageStandingItem(BaseModel):
    rank: int
    team_id: str
    team_name: str
    room_id: Optional[str] = None
    room_code: Optional[str] = None
    room_name: Optional[str] = None
    zone_id: Optional[str] = None
    zone_code: Optional[str] = None
    zone_name: Optional[str] = None
    ballots_count: int = 0
    avg_score: float = 0.0
    is_zone_winner: bool = False
    is_room_winner: bool = False


class ThreeStageStandingsResponse(BaseModel):
    room_id: Optional[str] = None
    stage_1_zone_standings: List[StageStandingItem] = []
    stage_2_room_standings: List[StageStandingItem] = []
    stage_3_cross_room_standings: List[StageStandingItem] = []
