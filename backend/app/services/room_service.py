from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import (
    BadRequestException,
    ConflictException,
    ForbiddenException,
    NotFoundException,
)
from app.models.checkpoint import Checkpoint
from app.models.room import (
    JudgingStage,
    PeerEvaluation,
    Room,
    RoomCheckpointSchedule,
    Zone,
)
from app.models.team import Team, TeamMember
from app.models.user import User, UserRole
from app.schemas.room import (
    AssignTeamRoomZoneRequest,
    AutoDivideZonesRequest,
    PeerEvaluationResponse,
    PeerEvaluationSubmitRequest,
    RoomCheckpointScheduleResponse,
    RoomCheckpointScheduleUpsertRequest,
    RoomCreateRequest,
    RoomResponse,
    RoomStageAdvanceRequest,
    RoomTeamSummary,
    RoomUpdateRequest,
    StageStandingItem,
    ThreeStageStandingsResponse,
    ZoneCreateRequest,
    ZoneResponse,
)
from app.services.checkpoint_service import ensure_utc


class RoomService:
    """
    Business service layer for the AI Thực Chiến operational model:
    - Multi-Room management with independent start/end times, capacity, and Room Manager.
    - Zone partitioning inside each Room (auto-balanced or manual assignment).
    - Per-Room Checkpoint schedule overrides.
    - 3-Stage Peer Cross-Grading:
      * Stage 1 (stage_1_zone): Intra-Zone peer grading -> Top 1 per Zone advances.
      * Stage 2 (stage_2_room): Room-wide peer grading of Zone winners -> Top 1 or Top 3 per Room advances.
      * Stage 3 (stage_3_cross_room): Cross-Room peer grading of Room winners -> Final Leaderboard.
    """

    @staticmethod
    async def _load_room_full(db: AsyncSession, room_id: str) -> Optional[Room]:
        stmt = (
            select(Room)
            .where(Room.id == room_id)
            .options(
                selectinload(Room.zones).selectinload(Zone.teams),
                selectinload(Room.checkpoint_schedules),
                selectinload(Room.teams).selectinload(Team.topic),
            )
        )
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    @staticmethod
    async def build_room_response(db: AsyncSession, room: Room) -> RoomResponse:
        # Map checkpoint titles
        cp_ids = [s.checkpoint_id for s in (room.checkpoint_schedules or [])]
        cp_title_map: Dict[str, str] = {}
        if cp_ids:
            cp_res = await db.execute(
                select(Checkpoint).where(Checkpoint.id.in_(cp_ids))
            )
            for cp in cp_res.scalars().all():
                cp_title_map[str(cp.id)] = cp.title

        zone_map: Dict[str, str] = {}
        zones_resp: List[ZoneResponse] = []
        sorted_zones = sorted(room.zones or [], key=lambda z: z.code)
        for z in sorted_zones:
            zone_map[str(z.id)] = z.name
            z_teams = [t for t in (room.teams or []) if str(t.zone_id) == str(z.id)]
            winner = next((t for t in z_teams if t.is_zone_winner), None)
            zones_resp.append(
                ZoneResponse(
                    id=str(z.id),
                    room_id=str(z.room_id),
                    code=z.code,
                    name=z.name,
                    max_teams=z.max_teams,
                    team_count=len(z_teams),
                    winner_team_id=str(winner.id) if winner else None,
                    winner_team_name=winner.team_name if winner else None,
                )
            )

        schedules_resp = [
            RoomCheckpointScheduleResponse(
                id=str(s.id),
                room_id=str(s.room_id),
                checkpoint_id=str(s.checkpoint_id),
                checkpoint_title=cp_title_map.get(str(s.checkpoint_id)),
                start_time=ensure_utc(s.start_time),
                deadline=ensure_utc(s.deadline),
                is_active=bool(s.is_active),
            )
            for s in (room.checkpoint_schedules or [])
        ]

        teams_resp: List[RoomTeamSummary] = []
        for t in sorted(room.teams or [], key=lambda item: item.team_name):
            topic_obj = t.__dict__.get("topic")
            teams_resp.append(
                RoomTeamSummary(
                    id=str(t.id),
                    team_name=t.team_name,
                    room_id=str(t.room_id) if t.room_id else None,
                    zone_id=str(t.zone_id) if t.zone_id else None,
                    zone_name=zone_map.get(str(t.zone_id)) if t.zone_id else None,
                    topic_name=topic_obj.title if topic_obj else None,
                    is_zone_winner=bool(t.is_zone_winner),
                    is_room_winner=bool(t.is_room_winner),
                )
            )

        return RoomResponse(
            id=str(room.id),
            code=room.code,
            name=room.name,
            description=room.description,
            manager_id=room.manager_id,
            manager_name=room.manager_name,
            capacity=room.capacity,
            start_time=ensure_utc(room.start_time),
            end_time=ensure_utc(room.end_time),
            judging_stage=room.judging_stage,
            room_top_n=room.room_top_n,
            is_active=bool(room.is_active),
            team_count=len(teams_resp),
            zones=zones_resp,
            checkpoint_schedules=schedules_resp,
            teams=teams_resp,
            created_at=room.created_at,
            updated_at=room.updated_at,
        )

    async def list_rooms(self, db: AsyncSession) -> List[RoomResponse]:
        stmt = (
            select(Room)
            .order_by(Room.start_time.asc(), Room.code.asc())
            .options(
                selectinload(Room.zones).selectinload(Zone.teams),
                selectinload(Room.checkpoint_schedules),
                selectinload(Room.teams).selectinload(Team.topic),
            )
        )
        res = await db.execute(stmt)
        rooms = res.scalars().all()
        return [await self.build_room_response(db, r) for r in rooms]

    async def get_room(self, db: AsyncSession, room_id: str) -> RoomResponse:
        room = await self._load_room_full(db, room_id)
        if not room:
            raise NotFoundException(
                message=f"Không tìm thấy phòng thi với ID '{room_id}'.",
                error_code="ROOM_NOT_FOUND",
            )
        return await self.build_room_response(db, room)

    async def create_room(
        self, db: AsyncSession, data: RoomCreateRequest
    ) -> RoomResponse:
        start_utc = ensure_utc(data.start_time)
        end_utc = ensure_utc(data.end_time)
        if end_utc <= start_utc:
            raise BadRequestException(
                message="Thời gian kết thúc phòng thi (end_time) phải diễn ra sau thời gian bắt đầu (start_time).",
                error_code="INVALID_ROOM_TIME_WINDOW",
            )

        existing = await db.execute(select(Room).where(Room.code == data.code))
        if existing.scalar_one_or_none():
            raise ConflictException(
                message=f"Mã phòng '{data.code}' đã tồn tại trong hệ thống.",
                error_code="ROOM_CODE_TAKEN",
            )

        room = Room(
            code=data.code,
            name=data.name.strip(),
            description=data.description,
            manager_id=data.manager_id,
            manager_name=data.manager_name,
            capacity=data.capacity,
            start_time=start_utc,
            end_time=end_utc,
            judging_stage=JudgingStage.NOT_STARTED.value,
            room_top_n=data.room_top_n,
            is_active=True,
        )
        db.add(room)
        await db.flush()

        # Tự động khởi tạo các Zone mặc định (Zone A, Zone B, Zone C...)
        alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        for idx in range(data.zone_count):
            letter = alphabet[idx] if idx < len(alphabet) else str(idx + 1)
            zone = Zone(
                room_id=str(room.id),
                code=f"ZONE-{letter}",
                name=f"Zone {letter}",
                max_teams=data.zone_max_teams,
            )
            db.add(zone)

        await db.commit()
        loaded = await self._load_room_full(db, str(room.id))
        return await self.build_room_response(db, loaded)  # type: ignore

    async def update_room(
        self, db: AsyncSession, room_id: str, data: RoomUpdateRequest
    ) -> RoomResponse:
        room = await self._load_room_full(db, room_id)
        if not room:
            raise NotFoundException(
                message=f"Không tìm thấy phòng thi với ID '{room_id}'.",
                error_code="ROOM_NOT_FOUND",
            )

        if data.name is not None:
            room.name = data.name.strip()
        if data.description is not None:
            room.description = data.description
        if data.manager_id is not None:
            room.manager_id = data.manager_id
        if data.manager_name is not None:
            room.manager_name = data.manager_name
        if data.capacity is not None:
            room.capacity = data.capacity
        if data.room_top_n is not None:
            room.room_top_n = data.room_top_n
        if data.judging_stage is not None:
            room.judging_stage = data.judging_stage
        if data.is_active is not None:
            room.is_active = data.is_active

        new_start = ensure_utc(data.start_time) if data.start_time else ensure_utc(room.start_time)
        new_end = ensure_utc(data.end_time) if data.end_time else ensure_utc(room.end_time)
        if new_end <= new_start:
            raise BadRequestException(
                message="Thời gian kết thúc phòng thi (end_time) phải diễn ra sau thời gian bắt đầu (start_time).",
                error_code="INVALID_ROOM_TIME_WINDOW",
            )
        if data.start_time is not None:
            room.start_time = new_start
        if data.end_time is not None:
            room.end_time = new_end

        await db.commit()
        loaded = await self._load_room_full(db, room_id)
        return await self.build_room_response(db, loaded)  # type: ignore

    async def create_zone(
        self, db: AsyncSession, room_id: str, data: ZoneCreateRequest
    ) -> ZoneResponse:
        room = await self._load_room_full(db, room_id)
        if not room:
            raise NotFoundException(
                message=f"Không tìm thấy phòng thi với ID '{room_id}'.",
                error_code="ROOM_NOT_FOUND",
            )

        zone = Zone(
            room_id=str(room.id),
            code=data.code.strip().upper(),
            name=data.name.strip(),
            max_teams=data.max_teams,
        )
        db.add(zone)
        await db.commit()
        await db.refresh(zone)
        return ZoneResponse(
            id=str(zone.id),
            room_id=str(zone.room_id),
            code=zone.code,
            name=zone.name,
            max_teams=zone.max_teams,
            team_count=0,
        )

    async def assign_team_to_room_zone(
        self, db: AsyncSession, room_id: str, data: AssignTeamRoomZoneRequest
    ) -> RoomResponse:
        room = await self._load_room_full(db, room_id)
        if not room:
            raise NotFoundException(
                message=f"Không tìm thấy phòng thi với ID '{room_id}'.",
                error_code="ROOM_NOT_FOUND",
            )

        team_res = await db.execute(select(Team).where(Team.id == data.team_id))
        team = team_res.scalar_one_or_none()
        if not team:
            raise NotFoundException(
                message=f"Không tìm thấy đội thi với ID '{data.team_id}'.",
                error_code="TEAM_NOT_FOUND",
            )

        target_zone_id: Optional[str] = None
        if data.zone_id:
            zone = next((z for z in (room.zones or []) if str(z.id) == str(data.zone_id)), None)
            if not zone:
                raise BadRequestException(
                    message=f"Zone '{data.zone_id}' không thuộc phòng thi '{room.name}'.",
                    error_code="INVALID_ZONE_FOR_ROOM",
                )
            target_zone_id = str(zone.id)

        team.room_id = str(room.id)
        team.zone_id = target_zone_id
        await db.commit()
        db.expire_all()
        loaded = await self._load_room_full(db, room_id)
        return await self.build_room_response(db, loaded)  # type: ignore

    async def auto_divide_zones(
        self, db: AsyncSession, room_id: str, data: Optional[AutoDivideZonesRequest] = None
    ) -> RoomResponse:
        """
        Tự động chia đều (Round-Robin) các đội thi trong phòng vào các Zone để cân bằng số đội chấm chéo.
        """
        room = await self._load_room_full(db, room_id)
        if not room:
            raise NotFoundException(
                message=f"Không tìm thấy phòng thi với ID '{room_id}'.",
                error_code="ROOM_NOT_FOUND",
            )

        alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        desired_count = data.zone_count if (data and data.zone_count) else len(room.zones or [])
        if desired_count <= 0:
            desired_count = 2

        current_zones = sorted(room.zones or [], key=lambda z: z.code)
        while len(current_zones) < desired_count:
            idx = len(current_zones)
            letter = alphabet[idx] if idx < len(alphabet) else str(idx + 1)
            new_z = Zone(
                room_id=str(room.id),
                code=f"ZONE-{letter}",
                name=f"Zone {letter}",
                max_teams=5,
            )
            db.add(new_z)
            await db.flush()
            current_zones.append(new_z)

        active_zones = current_zones[:desired_count]
        teams_in_room = sorted(room.teams or [], key=lambda t: t.team_name)
        for idx, team in enumerate(teams_in_room):
            assigned_zone = active_zones[idx % len(active_zones)]
            team.zone_id = str(assigned_zone.id)

        await db.commit()
        db.expire_all()
        loaded = await self._load_room_full(db, room_id)
        return await self.build_room_response(db, loaded)  # type: ignore

    async def upsert_room_checkpoint_schedule(
        self,
        db: AsyncSession,
        room_id: str,
        data: RoomCheckpointScheduleUpsertRequest,
    ) -> RoomCheckpointScheduleResponse:
        room = await self._load_room_full(db, room_id)
        if not room:
            raise NotFoundException(
                message=f"Không tìm thấy phòng thi với ID '{room_id}'.",
                error_code="ROOM_NOT_FOUND",
            )

        cp_res = await db.execute(
            select(Checkpoint).where(Checkpoint.id == data.checkpoint_id)
        )
        cp = cp_res.scalar_one_or_none()
        if not cp:
            raise NotFoundException(
                message=f"Không tìm thấy Checkpoint với ID '{data.checkpoint_id}'.",
                error_code="CHECKPOINT_NOT_FOUND",
            )

        start_utc = ensure_utc(data.start_time)
        deadline_utc = ensure_utc(data.deadline)
        if deadline_utc <= start_utc:
            raise BadRequestException(
                message="Hạn chót (deadline) của phòng phải diễn ra sau thời điểm mở cổng (start_time).",
                error_code="INVALID_SCHEDULE_WINDOW",
            )

        stmt = select(RoomCheckpointSchedule).where(
            RoomCheckpointSchedule.room_id == str(room.id),
            RoomCheckpointSchedule.checkpoint_id == str(cp.id),
        )
        res = await db.execute(stmt)
        sched = res.scalar_one_or_none()
        if sched:
            sched.start_time = start_utc
            sched.deadline = deadline_utc
            sched.is_active = data.is_active
        else:
            sched = RoomCheckpointSchedule(
                room_id=str(room.id),
                checkpoint_id=str(cp.id),
                start_time=start_utc,
                deadline=deadline_utc,
                is_active=data.is_active,
            )
            db.add(sched)

        await db.commit()
        await db.refresh(sched)
        return RoomCheckpointScheduleResponse(
            id=str(sched.id),
            room_id=str(sched.room_id),
            checkpoint_id=str(sched.checkpoint_id),
            checkpoint_title=cp.title,
            start_time=ensure_utc(sched.start_time),
            deadline=ensure_utc(sched.deadline),
            is_active=bool(sched.is_active),
        )

    async def get_room_schedule_for_team_checkpoint(
        self, db: AsyncSession, team_id: str, checkpoint_id: str
    ) -> Optional[RoomCheckpointSchedule]:
        team_res = await db.execute(select(Team).where(Team.id == team_id))
        team = team_res.scalar_one_or_none()
        if not team or not team.room_id:
            return None

        stmt = select(RoomCheckpointSchedule).where(
            RoomCheckpointSchedule.room_id == str(team.room_id),
            RoomCheckpointSchedule.checkpoint_id == str(checkpoint_id),
        )
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    async def submit_peer_evaluation(
        self,
        db: AsyncSession,
        user: User,
        data: PeerEvaluationSubmitRequest,
    ) -> PeerEvaluationResponse:
        """
        Gửi phiếu chấm điểm chéo giữa các đội theo 3 giai đoạn:
        - Giai đoạn 1 (stage_1_zone): Các đội trong cùng Zone chấm chéo nhau -> Tìm Top 1 mỗi Zone.
        - Giai đoạn 2 (stage_2_room): Các đội trong cùng Phòng chấm các đội Top 1 Zone thuyết trình -> Tìm Top 1 hoặc Top 3 của Phòng.
        - Giai đoạn 3 (stage_3_cross_room): Các đội chấm chéo các đội đại diện Phòng (Top 1/Top 3 mỗi phòng) thuyết trình liên phòng.
        """
        valid_stages = {
            JudgingStage.STAGE_1_ZONE.value,
            JudgingStage.STAGE_2_ROOM.value,
            JudgingStage.STAGE_3_CROSS_ROOM.value,
        }
        if data.stage not in valid_stages:
            raise BadRequestException(
                message=f"Giai đoạn chấm '{data.stage}' không hợp lệ. Phải thuộc {sorted(valid_stages)}.",
                error_code="INVALID_JUDGING_STAGE",
            )

        # Xác định đội chấm điểm (evaluator_team_id)
        evaluator_team_id = data.evaluator_team_id
        if not evaluator_team_id:
            mem_res = await db.execute(
                select(TeamMember).where(TeamMember.user_id == str(user.id))
            )
            membership = mem_res.scalar_one_or_none()
            if not membership:
                raise ForbiddenException(
                    message="Bạn phải thuộc một đội thi để thực hiện chấm điểm chéo.",
                    error_code="EVALUATOR_TEAM_REQUIRED",
                )
            evaluator_team_id = str(membership.team_id)

        if str(evaluator_team_id) == str(data.target_team_id):
            raise BadRequestException(
                message="Đội thi không được phép tự chấm điểm cho chính đội của mình.",
                error_code="SELF_EVALUATION_FORBIDDEN",
            )

        eval_team_res = await db.execute(
            select(Team).where(Team.id == str(evaluator_team_id))
        )
        evaluator_team = eval_team_res.scalar_one_or_none()
        if not evaluator_team:
            raise NotFoundException(
                message="Không tìm thấy đội chấm điểm.",
                error_code="EVALUATOR_TEAM_NOT_FOUND",
            )

        target_team_res = await db.execute(
            select(Team).where(Team.id == str(data.target_team_id))
        )
        target_team = target_team_res.scalar_one_or_none()
        if not target_team:
            raise NotFoundException(
                message="Không tìm thấy đội được chấm điểm.",
                error_code="TARGET_TEAM_NOT_FOUND",
            )

        # Kiểm tra quy tắc theo từng giai đoạn chấm
        if data.stage == JudgingStage.STAGE_1_ZONE.value:
            if not evaluator_team.zone_id or evaluator_team.zone_id != target_team.zone_id:
                raise BadRequestException(
                    message="Ở Giai đoạn 1 (Chấm trong Zone), các đội chỉ được phép chấm chéo cho các đội khác trong cùng một Zone.",
                    error_code="CROSS_ZONE_NOT_ALLOWED_IN_STAGE_1",
                )
        elif data.stage == JudgingStage.STAGE_2_ROOM.value:
            if not evaluator_team.room_id or evaluator_team.room_id != target_team.room_id:
                raise BadRequestException(
                    message="Ở Giai đoạn 2 (Thuyết trình cấp Phòng), các đội chỉ chấm các đội đại diện Zone trong cùng Phòng học.",
                    error_code="CROSS_ROOM_NOT_ALLOWED_IN_STAGE_2",
                )
            if not target_team.is_zone_winner:
                raise BadRequestException(
                    message="Ở Giai đoạn 2, chỉ các đội Top 1 của mỗi Zone mới lên thuyết trình và nhận phiếu chấm điểm.",
                    error_code="TARGET_NOT_ZONE_WINNER",
                )
        elif data.stage == JudgingStage.STAGE_3_CROSS_ROOM.value:
            if not target_team.is_room_winner:
                raise BadRequestException(
                    message="Ở Giai đoạn 3 (Thuyết trình chéo Liên Phòng), chỉ các đội Top 1 / Top 3 đại diện mỗi Phòng mới nhận phiếu chấm điểm.",
                    error_code="TARGET_NOT_ROOM_WINNER",
                )

        # Tính tổng điểm
        calculated_total = sum(float(v) for v in (data.criteria_scores or {}).values())
        final_total = (
            float(data.total_score)
            if data.total_score is not None
            else round(calculated_total, 2)
        )
        if final_total < 0 or final_total > 100:
            raise BadRequestException(
                message="Tổng điểm phiếu chấm chéo phải nằm trong thang điểm 0 - 100.",
                error_code="INVALID_TOTAL_SCORE",
            )

        stmt = select(PeerEvaluation).where(
            PeerEvaluation.stage == data.stage,
            PeerEvaluation.evaluator_team_id == str(evaluator_team.id),
            PeerEvaluation.target_team_id == str(target_team.id),
        )
        existing_res = await db.execute(stmt)
        ballot = existing_res.scalar_one_or_none()

        if ballot:
            ballot.criteria_scores = dict(data.criteria_scores or {})
            ballot.total_score = final_total
            ballot.comment = data.comment
            ballot.submitted_by = str(user.id)
        else:
            ballot = PeerEvaluation(
                stage=data.stage,
                room_id=target_team.room_id,
                zone_id=target_team.zone_id,
                evaluator_team_id=str(evaluator_team.id),
                target_team_id=str(target_team.id),
                submitted_by=str(user.id),
                criteria_scores=dict(data.criteria_scores or {}),
                total_score=final_total,
                comment=data.comment,
            )
            db.add(ballot)

        await db.commit()
        await db.refresh(ballot)
        return PeerEvaluationResponse(
            id=str(ballot.id),
            stage=ballot.stage,
            room_id=ballot.room_id,
            zone_id=ballot.zone_id,
            evaluator_team_id=ballot.evaluator_team_id,
            evaluator_team_name=evaluator_team.team_name,
            target_team_id=ballot.target_team_id,
            target_team_name=target_team.team_name,
            submitted_by=ballot.submitted_by,
            criteria_scores=ballot.criteria_scores or {},
            total_score=ballot.total_score,
            comment=ballot.comment,
            created_at=ballot.created_at,
            updated_at=ballot.updated_at,
        )

    async def list_peer_evaluations(
        self,
        db: AsyncSession,
        stage: Optional[str] = None,
        room_id: Optional[str] = None,
        zone_id: Optional[str] = None,
        evaluator_team_id: Optional[str] = None,
    ) -> List[PeerEvaluationResponse]:
        stmt = select(PeerEvaluation).order_by(PeerEvaluation.created_at.desc())
        if stage:
            stmt = stmt.where(PeerEvaluation.stage == stage)
        if room_id:
            stmt = stmt.where(PeerEvaluation.room_id == room_id)
        if zone_id:
            stmt = stmt.where(PeerEvaluation.zone_id == zone_id)
        if evaluator_team_id:
            stmt = stmt.where(PeerEvaluation.evaluator_team_id == evaluator_team_id)

        res = await db.execute(stmt)
        ballots = res.scalars().all()

        team_res = await db.execute(select(Team))
        team_name_map = {str(t.id): t.team_name for t in team_res.scalars().all()}

        return [
            PeerEvaluationResponse(
                id=str(b.id),
                stage=b.stage,
                room_id=b.room_id,
                zone_id=b.zone_id,
                evaluator_team_id=b.evaluator_team_id,
                evaluator_team_name=team_name_map.get(str(b.evaluator_team_id)),
                target_team_id=b.target_team_id,
                target_team_name=team_name_map.get(str(b.target_team_id)),
                submitted_by=b.submitted_by,
                criteria_scores=b.criteria_scores or {},
                total_score=b.total_score,
                comment=b.comment,
                created_at=b.created_at,
                updated_at=b.updated_at,
            )
            for b in ballots
        ]

    async def advance_room_stage(
        self, db: AsyncSession, room_id: str, data: RoomStageAdvanceRequest
    ) -> RoomResponse:
        """
        Chuyển giai đoạn chấm điểm của Phòng học và tự động chốt danh sách đội đi tiếp:
        - Chuyển sang `stage_2_room`: Tự động tính điểm trung bình Giai đoạn 1 trong từng Zone và chọn **Top 1 mỗi Zone** (`is_zone_winner = True`) lên thuyết trình cấp Phòng.
        - Chuyển sang `stage_3_cross_room`: Tự động tính điểm trung bình Giai đoạn 2 của các đội Top 1 Zone trong Phòng và chọn **Top 1 hoặc Top 3 (`room_top_n`) của Phòng** (`is_room_winner = True`) lên thuyết trình chéo Liên Phòng.
        """
        room = await self._load_room_full(db, room_id)
        if not room:
            raise NotFoundException(
                message=f"Không tìm thấy phòng thi với ID '{room_id}'.",
                error_code="ROOM_NOT_FOUND",
            )

        if data.room_top_n is not None:
            room.room_top_n = data.room_top_n

        # Lấy toàn bộ phiếu chấm của phòng
        eval_res = await db.execute(
            select(PeerEvaluation).where(PeerEvaluation.room_id == str(room.id))
        )
        room_ballots = eval_res.scalars().all()

        def avg_score_for(team_id: str, stage_val: str) -> Tuple[float, int]:
            scores = [
                b.total_score
                for b in room_ballots
                if b.stage == stage_val and str(b.target_team_id) == str(team_id)
            ]
            if not scores:
                return 0.0, 0
            return round(sum(scores) / len(scores), 2), len(scores)

        # 1. Nếu chuyển sang Vòng 2 (stage_2_room) -> Chốt Top 1 của mỗi Zone
        if data.target_stage in (
            JudgingStage.STAGE_2_ROOM.value,
            JudgingStage.STAGE_3_CROSS_ROOM.value,
            JudgingStage.COMPLETED.value,
        ):
            for zone in room.zones or []:
                z_teams = [
                    t for t in (room.teams or []) if str(t.zone_id) == str(zone.id)
                ]
                if not z_teams:
                    continue
                # Nếu chưa có đội nào được gán winner hoặc đang chuyển sang stage_2_room thì tính lại
                if data.target_stage == JudgingStage.STAGE_2_ROOM.value or not any(
                    t.is_zone_winner for t in z_teams
                ):
                    ranked_z = sorted(
                        z_teams,
                        key=lambda t: (
                            avg_score_for(str(t.id), JudgingStage.STAGE_1_ZONE.value)[0],
                            avg_score_for(str(t.id), JudgingStage.STAGE_1_ZONE.value)[1],
                            t.team_name,
                        ),
                        reverse=True,
                    )
                    for idx, t in enumerate(ranked_z):
                        t.is_zone_winner = idx == 0

        # 2. Nếu chuyển sang Vòng 3 (stage_3_cross_room) hoặc completed -> Chốt Top N (1 hoặc 3) của Phòng
        if data.target_stage in (
            JudgingStage.STAGE_3_CROSS_ROOM.value,
            JudgingStage.COMPLETED.value,
        ):
            zone_winners = [t for t in (room.teams or []) if t.is_zone_winner]
            candidates = zone_winners if zone_winners else list(room.teams or [])
            ranked_room = sorted(
                candidates,
                key=lambda t: (
                    avg_score_for(str(t.id), JudgingStage.STAGE_2_ROOM.value)[0],
                    avg_score_for(str(t.id), JudgingStage.STAGE_1_ZONE.value)[0],
                    t.team_name,
                ),
                reverse=True,
            )
            top_n = max(1, int(room.room_top_n or 1))
            winner_ids = {str(t.id) for t in ranked_room[:top_n]}
            for t in room.teams or []:
                t.is_room_winner = str(t.id) in winner_ids

        room.judging_stage = data.target_stage
        await db.commit()
        db.expire_all()
        loaded = await self._load_room_full(db, room_id)
        return await self.build_room_response(db, loaded)  # type: ignore

    async def get_three_stage_standings(
        self, db: AsyncSession, room_id: Optional[str] = None
    ) -> ThreeStageStandingsResponse:
        rooms_stmt = select(Room).options(selectinload(Room.zones))
        if room_id:
            rooms_stmt = rooms_stmt.where(Room.id == room_id)
        rooms_res = await db.execute(rooms_stmt)
        rooms = rooms_res.scalars().all()
        room_map = {str(r.id): r for r in rooms}

        all_rooms_res = await db.execute(select(Room).options(selectinload(Room.zones)))
        all_rooms_map = {str(r.id): r for r in all_rooms_res.scalars().all()}
        zone_map: Dict[str, Zone] = {}
        for r in all_rooms_map.values():
            for z in r.zones or []:
                zone_map[str(z.id)] = z

        teams_res = await db.execute(select(Team))
        all_teams = teams_res.scalars().all()

        evals_res = await db.execute(select(PeerEvaluation))
        all_evals = evals_res.scalars().all()

        def calc_stats(team_id: str, stage_val: str) -> Tuple[float, int]:
            scores = [
                e.total_score
                for e in all_evals
                if e.stage == stage_val and str(e.target_team_id) == str(team_id)
            ]
            if not scores:
                return 0.0, 0
            return round(sum(scores) / len(scores), 2), len(scores)

        def build_item(rank: int, t: Team, stage_val: str) -> StageStandingItem:
            avg_sc, cnt = calc_stats(str(t.id), stage_val)
            r_obj = all_rooms_map.get(str(t.room_id)) if t.room_id else None
            z_obj = zone_map.get(str(t.zone_id)) if t.zone_id else None
            return StageStandingItem(
                rank=rank,
                team_id=str(t.id),
                team_name=t.team_name,
                room_id=str(t.room_id) if t.room_id else None,
                room_code=r_obj.code if r_obj else None,
                room_name=r_obj.name if r_obj else None,
                zone_id=str(t.zone_id) if t.zone_id else None,
                zone_code=z_obj.code if z_obj else None,
                zone_name=z_obj.name if z_obj else None,
                ballots_count=cnt,
                avg_score=avg_sc,
                is_zone_winner=bool(t.is_zone_winner),
                is_room_winner=bool(t.is_room_winner),
            )

        # Stage 1: Lọc theo room_id (nếu có), xếp hạng trong từng Zone
        stage1_teams = [
            t
            for t in all_teams
            if t.room_id and (not room_id or str(t.room_id) == str(room_id))
        ]
        stage1_sorted = sorted(
            stage1_teams,
            key=lambda t: (
                str(t.zone_id or ""),
                -calc_stats(str(t.id), JudgingStage.STAGE_1_ZONE.value)[0],
                t.team_name,
            ),
        )
        stage_1_items: List[StageStandingItem] = []
        current_zone = None
        zone_rank = 0
        for t in stage1_sorted:
            if t.zone_id != current_zone:
                current_zone = t.zone_id
                zone_rank = 1
            else:
                zone_rank += 1
            stage_1_items.append(
                build_item(zone_rank, t, JudgingStage.STAGE_1_ZONE.value)
            )

        # Stage 2: Các đội Top 1 Zone trong phòng thuyết trình cấp Phòng
        stage2_teams = [t for t in stage1_teams if t.is_zone_winner]
        stage2_sorted = sorted(
            stage2_teams,
            key=lambda t: (
                str(t.room_id or ""),
                -calc_stats(str(t.id), JudgingStage.STAGE_2_ROOM.value)[0],
                t.team_name,
            ),
        )
        stage_2_items = [
            build_item(idx + 1, t, JudgingStage.STAGE_2_ROOM.value)
            for idx, t in enumerate(stage2_sorted)
        ]

        # Stage 3: Các đội Top 1 / Top 3 của tất cả các phòng thuyết trình chéo Liên Phòng
        stage3_teams = [t for t in all_teams if t.is_room_winner]
        stage3_sorted = sorted(
            stage3_teams,
            key=lambda t: (
                -calc_stats(str(t.id), JudgingStage.STAGE_3_CROSS_ROOM.value)[0],
                -calc_stats(str(t.id), JudgingStage.STAGE_2_ROOM.value)[0],
                t.team_name,
            ),
        )
        stage_3_items = [
            build_item(idx + 1, t, JudgingStage.STAGE_3_CROSS_ROOM.value)
            for idx, t in enumerate(stage3_sorted)
        ]

        return ThreeStageStandingsResponse(
            room_id=room_id,
            stage_1_zone_standings=stage_1_items,
            stage_2_room_standings=stage_2_items,
            stage_3_cross_room_standings=stage_3_items,
        )


room_service = RoomService()
