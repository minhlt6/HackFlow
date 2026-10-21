from datetime import datetime, timezone
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token
from app.models.checkpoint import Checkpoint
from app.models.team import Team, TeamMember, TeamMemberRole
from app.models.user import ApprovalStatus, User, UserRole


def _auth_header(user: User) -> dict:
    token = create_access_token(
        subject=str(user.id),
        claims={"role": user.role, "email": user.email},
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.anyio
async def test_ai_thuc_chien_rooms_zones_checkpoint_schedule_and_3_stage_peer_grading(
    client: AsyncClient,
    db_session: AsyncSession,
):
    # 1. Tạo Admin (Quản lý phòng) và các Đội trưởng ở Phòng 1 & Phòng 2
    admin = User(
        id="u-admin-1",
        email="manager1@hackflow.dev",
        full_name="TS. Lê Tiến Minh",
        role=UserRole.ADMIN.value,
        approval_status=ApprovalStatus.APPROVED.value,
        is_active=True,
    )
    u_a1 = User(
        id="u-a1",
        email="a1@team.dev",
        full_name="Leader A1",
        role=UserRole.CANDIDATE.value,
        approval_status=ApprovalStatus.APPROVED.value,
    )
    u_a2 = User(
        id="u-a2",
        email="a2@team.dev",
        full_name="Leader A2",
        role=UserRole.CANDIDATE.value,
        approval_status=ApprovalStatus.APPROVED.value,
    )
    u_b1 = User(
        id="u-b1",
        email="b1@team.dev",
        full_name="Leader B1",
        role=UserRole.CANDIDATE.value,
        approval_status=ApprovalStatus.APPROVED.value,
    )
    u_b2 = User(
        id="u-b2",
        email="b2@team.dev",
        full_name="Leader B2",
        role=UserRole.CANDIDATE.value,
        approval_status=ApprovalStatus.APPROVED.value,
    )
    u_r2 = User(
        id="u-r2",
        email="r2@team.dev",
        full_name="Leader Room 2",
        role=UserRole.CANDIDATE.value,
        approval_status=ApprovalStatus.APPROVED.value,
    )
    db_session.add_all([admin, u_a1, u_a2, u_b1, u_b2, u_r2])
    await db_session.flush()

    t_a1 = Team(id="team-a1", team_name="Alpha One", invite_code="ALP001")
    t_a2 = Team(id="team-a2", team_name="Alpha Two", invite_code="ALP002")
    t_b1 = Team(id="team-b1", team_name="Beta One", invite_code="BET001")
    t_b2 = Team(id="team-b2", team_name="Beta Two", invite_code="BET002")
    t_r2 = Team(id="team-r2", team_name="Omega Room2", invite_code="OMG002")
    db_session.add_all([t_a1, t_a2, t_b1, t_b2, t_r2])
    await db_session.flush()

    db_session.add_all(
        [
            TeamMember(team_id="team-a1", user_id="u-a1", role=TeamMemberRole.LEADER.value),
            TeamMember(team_id="team-a2", user_id="u-a2", role=TeamMemberRole.LEADER.value),
            TeamMember(team_id="team-b1", user_id="u-b1", role=TeamMemberRole.LEADER.value),
            TeamMember(team_id="team-b2", user_id="u-b2", role=TeamMemberRole.LEADER.value),
            TeamMember(team_id="team-r2", user_id="u-r2", role=TeamMemberRole.LEADER.value),
        ]
    )

    # Tạo 1 Checkpoint toàn cục đã ĐÓNG theo giờ mặc định (08:00 - 10:00)
    cp = Checkpoint(
        id="cp-01",
        title="Checkpoint 1: Kiến trúc AI Agent",
        start_time=datetime(2026, 5, 1, 8, 0, tzinfo=timezone.utc),
        deadline=datetime(2026, 5, 1, 10, 0, tzinfo=timezone.utc),
        is_active=True,
    )
    db_session.add(cp)
    await db_session.commit()

    admin_headers = _auth_header(admin)

    # 2. Tạo 2 Phòng thi (Lớp Ca Sáng & Lớp Ca Chiều) với khung giờ & người quản lý khác nhau
    r1_resp = await client.post(
        "/api/v1/rooms",
        headers=admin_headers,
        json={
            "code": "AI-TC-CA1",
            "name": "Lớp AI Thực Chiến - Ca Sáng",
            "manager_name": "TS. Lê Tiến Minh",
            "capacity": 40,
            "start_time": "2026-05-01T08:00:00Z",
            "end_time": "2026-05-01T12:00:00Z",
            "room_top_n": 1,
            "zone_count": 2,
            "zone_max_teams": 4,
        },
    )
    assert r1_resp.status_code == 201
    room1 = r1_resp.json()["data"]
    room1_id = room1["id"]
    assert len(room1["zones"]) == 2
    zone_a_id = room1["zones"][0]["id"]
    zone_b_id = room1["zones"][1]["id"]

    r2_resp = await client.post(
        "/api/v1/rooms",
        headers=admin_headers,
        json={
            "code": "AI-TC-CA2",
            "name": "Lớp AI Thực Chiến - Ca Chiều",
            "manager_name": "ThS. Trần Thùy Linh",
            "capacity": 60,
            "start_time": "2026-05-01T13:30:00Z",
            "end_time": "2026-05-01T17:30:00Z",
            "room_top_n": 1,
            "zone_count": 1,
            "zone_max_teams": 5,
        },
    )
    assert r2_resp.status_code == 201
    room2 = r2_resp.json()["data"]
    room2_id = room2["id"]
    zone_r2_id = room2["zones"][0]["id"]

    # 3. Phân bổ các đội vào Phòng & Zone
    for tid, zid in [
        ("team-a1", zone_a_id),
        ("team-a2", zone_a_id),
        ("team-b1", zone_b_id),
        ("team-b2", zone_b_id),
    ]:
        res = await client.post(
            f"/api/v1/rooms/{room1_id}/assign-team",
            headers=admin_headers,
            json={"team_id": tid, "zone_id": zid},
        )
        assert res.status_code == 200

    res_r2 = await client.post(
        f"/api/v1/rooms/{room2_id}/assign-team",
        headers=admin_headers,
        json={"team_id": "team-r2", "zone_id": zone_r2_id},
    )
    assert res_r2.status_code == 200

    # 4. Cấu hình giờ nộp Checkpoint riêng cho Phòng 2 (13:30 -> 15:30)
    sched_resp = await client.put(
        f"/api/v1/rooms/{room2_id}/checkpoint-schedules",
        headers=admin_headers,
        json={
            "checkpoint_id": "cp-01",
            "start_time": "2026-05-01T13:30:00Z",
            "deadline": "2026-05-01T15:30:00Z",
            "is_active": True,
        },
    )
    assert sched_resp.status_code == 200

    # Kiểm thử: Lúc 14:00 UTC, Đội ở Phòng 1 nộp bài bị từ chối (quá hạn 10:00), nhưng Đội ở Phòng 2 nộp bài THÀNH CÔNG!
    sub_r1 = await client.post(
        "/api/v1/submissions",
        headers=_auth_header(u_a1),
        json={
            "checkpoint_id": "cp-01",
            "repo_url": "https://github.com/hackflow/alpha-one",
            "simulate_time": "2026-05-01T14:00:00Z",
        },
    )
    assert sub_r1.status_code == 400
    assert sub_r1.json()["error_code"] == "DEADLINE_EXCEEDED"

    sub_r2 = await client.post(
        "/api/v1/submissions",
        headers=_auth_header(u_r2),
        json={
            "checkpoint_id": "cp-01",
            "repo_url": "https://github.com/hackflow/omega-two",
            "simulate_time": "2026-05-01T14:00:00Z",
        },
    )
    assert sub_r2.status_code == 200
    assert sub_r2.json()["data"]["status"] == "submitted"

    # 5. GIAI ĐOẠN 1 (stage_1_zone): Chấm điểm chéo trong cùng Zone
    # Chặn tự chấm đội mình
    self_eval = await client.post(
        "/api/v1/rooms/peer-evaluations",
        headers=_auth_header(u_a1),
        json={
            "stage": "stage_1_zone",
            "target_team_id": "team-a1",
            "total_score": 95,
        },
    )
    assert self_eval.status_code == 400
    assert self_eval.json()["error_code"] == "SELF_EVALUATION_FORBIDDEN"

    # Chặn chấm khác Zone ở Giai đoạn 1
    cross_zone_eval = await client.post(
        "/api/v1/rooms/peer-evaluations",
        headers=_auth_header(u_a1),
        json={
            "stage": "stage_1_zone",
            "target_team_id": "team-b1",
            "total_score": 88,
        },
    )
    assert cross_zone_eval.status_code == 400
    assert cross_zone_eval.json()["error_code"] == "CROSS_ZONE_NOT_ALLOWED_IN_STAGE_1"

    # Trong Zone A: A2 chấm A1 = 92 điểm, A1 chấm A2 = 80 điểm -> A1 là Top 1 Zone A
    assert (
        await client.post(
            "/api/v1/rooms/peer-evaluations",
            headers=_auth_header(u_a2),
            json={
                "stage": "stage_1_zone",
                "target_team_id": "team-a1",
                "criteria_scores": {"innovation": 45, "prototype": 47},
                "total_score": 92,
                "comment": "Giải pháp RAG rất tốt!",
            },
        )
    ).status_code == 201
    assert (
        await client.post(
            "/api/v1/rooms/peer-evaluations",
            headers=_auth_header(u_a1),
            json={
                "stage": "stage_1_zone",
                "target_team_id": "team-a2",
                "total_score": 80,
            },
        )
    ).status_code == 201

    # Trong Zone B: B2 chấm B1 = 89 điểm, B1 chấm B2 = 75 điểm -> B1 là Top 1 Zone B
    assert (
        await client.post(
            "/api/v1/rooms/peer-evaluations",
            headers=_auth_header(u_b2),
            json={
                "stage": "stage_1_zone",
                "target_team_id": "team-b1",
                "total_score": 89,
            },
        )
    ).status_code == 201
    assert (
        await client.post(
            "/api/v1/rooms/peer-evaluations",
            headers=_auth_header(u_b1),
            json={
                "stage": "stage_1_zone",
                "target_team_id": "team-b2",
                "total_score": 75,
            },
        )
    ).status_code == 201

    # 6. Chuyển Phòng 1 sang GIAI ĐOẠN 2 (stage_2_room) -> Hệ thống tự động chốt Top 1 mỗi Zone (team-a1 & team-b1)
    adv_s2 = await client.post(
        f"/api/v1/rooms/{room1_id}/advance-stage",
        headers=admin_headers,
        json={"target_stage": "stage_2_room"},
    )
    assert adv_s2.status_code == 200
    r1_s2_data = adv_s2.json()["data"]
    assert r1_s2_data["judging_stage"] == "stage_2_room"
    zone_winners = [t["id"] for t in r1_s2_data["teams"] if t["is_zone_winner"]]
    assert sorted(zone_winners) == ["team-a1", "team-b1"]

    # Ở Giai đoạn 2: Chặn chấm đội không phải Top 1 Zone (ví dụ team-a2)
    non_winner_eval = await client.post(
        "/api/v1/rooms/peer-evaluations",
        headers=_auth_header(u_b1),
        json={
            "stage": "stage_2_room",
            "target_team_id": "team-a2",
            "total_score": 85,
        },
    )
    assert non_winner_eval.status_code == 400
    assert non_winner_eval.json()["error_code"] == "TARGET_NOT_ZONE_WINNER"

    # Các đội trong Phòng 1 chấm 2 đội thuyết trình Top 1 Zone (team-a1 & team-b1)
    assert (
        await client.post(
            "/api/v1/rooms/peer-evaluations",
            headers=_auth_header(u_b2),
            json={
                "stage": "stage_2_room",
                "target_team_id": "team-a1",
                "total_score": 95,
            },
        )
    ).status_code == 201
    assert (
        await client.post(
            "/api/v1/rooms/peer-evaluations",
            headers=_auth_header(u_a2),
            json={
                "stage": "stage_2_room",
                "target_team_id": "team-b1",
                "total_score": 88,
            },
        )
    ).status_code == 201

    # 7. Chuyển Phòng 1 & Phòng 2 sang GIAI ĐOẠN 3 (stage_3_cross_room) -> Tự động chốt Top 1 Phòng
    adv_s3_r1 = await client.post(
        f"/api/v1/rooms/{room1_id}/advance-stage",
        headers=admin_headers,
        json={"target_stage": "stage_3_cross_room", "room_top_n": 1},
    )
    assert adv_s3_r1.status_code == 200
    room1_winners = [
        t["id"] for t in adv_s3_r1.json()["data"]["teams"] if t["is_room_winner"]
    ]
    assert room1_winners == ["team-a1"]

    adv_s3_r2 = await client.post(
        f"/api/v1/rooms/{room2_id}/advance-stage",
        headers=admin_headers,
        json={"target_stage": "stage_3_cross_room", "room_top_n": 1},
    )
    assert adv_s3_r2.status_code == 200

    # 8. Ở Giai đoạn 3 (Thuyết trình chéo Liên Phòng): Đội ở Phòng 2 chấm cho đại diện Phòng 1 (team-a1) và ngược lại!
    s3_eval_1 = await client.post(
        "/api/v1/rooms/peer-evaluations",
        headers=_auth_header(u_r2),
        json={
            "stage": "stage_3_cross_room",
            "target_team_id": "team-a1",
            "total_score": 97,
            "comment": "Phần thuyết trình liên phòng xuất sắc!",
        },
    )
    assert s3_eval_1.status_code == 201

    s3_eval_2 = await client.post(
        "/api/v1/rooms/peer-evaluations",
        headers=_auth_header(u_a2),
        json={
            "stage": "stage_3_cross_room",
            "target_team_id": "team-r2",
            "total_score": 91,
        },
    )
    assert s3_eval_2.status_code == 201

    # 9. Kiểm tra Bảng xếp hạng 3 giai đoạn
    standings_resp = await client.get("/api/v1/rooms/standings/three-stages")
    assert standings_resp.status_code == 200
    standings = standings_resp.json()["data"]
    assert len(standings["stage_3_cross_room_standings"]) == 2
    assert standings["stage_3_cross_room_standings"][0]["team_id"] == "team-a1"
    assert standings["stage_3_cross_room_standings"][0]["avg_score"] == 97.0
