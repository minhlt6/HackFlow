import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.models.team import Team, TeamMember
from app.models.scoring import ScoringCriteria, JudgeAssignment
from app.core.security import get_password_hash, create_access_token


@pytest.mark.asyncio
async def test_ticket_support_flow(client: AsyncClient, test_db: AsyncSession):
    # Setup Participant & Mentor
    student = User(
        email="student@example.com",
        password_hash=get_password_hash("Pass@123"),
        full_name="Student",
        role="participant",
        profile_completed=True,
    )
    mentor = User(
        email="mentor_test@example.com",
        password_hash=get_password_hash("Pass@123"),
        full_name="Mentor Test",
        role="mentor",
        profile_completed=True,
    )
    test_db.add(student)
    test_db.add(mentor)
    await test_db.flush()

    team = Team(name="Ticket Team", status="approved", created_by=student.id)
    test_db.add(team)
    await test_db.flush()

    tm = TeamMember(team_id=team.id, user_id=student.id, role="leader", status="accepted")
    test_db.add(tm)
    await test_db.commit()

    student_token = create_access_token(
        {"sub": student.id, "email": student.email, "role": "participant"}
    )
    mentor_token = create_access_token({"sub": mentor.id, "email": mentor.email, "role": "mentor"})

    # 1. Student creates ticket
    create_res = await client.post(
        f"/api/v1/tickets/?team_id={team.id}",
        json={
            "title": "Lỗi kết nối database Supabase",
            "description": "Không thể kết nối asyncpg từ Railway",
            "priority": "high",
        },
        headers={"Authorization": f"Bearer {student_token}"},
    )
    assert create_res.status_code == 200
    ticket_id = create_res.json()["data"]["id"]
    assert create_res.json()["data"]["status"] == "open"

    # 2. Mentor views pool (endpoint now requires auth — mentor/admin only)
    pool_res = await client.get(
        "/api/v1/tickets/pool",
        headers={"Authorization": f"Bearer {mentor_token}"},
    )
    assert pool_res.status_code == 200
    pool_data = pool_res.json()["data"]
    assert any(t["id"] == ticket_id for t in pool_data)

    # 3. Mentor claims ticket
    claim_res = await client.post(
        f"/api/v1/tickets/{ticket_id}/claim",
        headers={"Authorization": f"Bearer {mentor_token}"},
    )
    assert claim_res.status_code == 200
    assert claim_res.json()["data"]["status"] == "in_progress"
    assert claim_res.json()["data"]["assigned_mentor_id"] == mentor.id

    # 4. Mentor sends message
    msg_res = await client.post(
        f"/api/v1/tickets/{ticket_id}/messages",
        json={"content": "Em kiểm tra lại SSL mode trên connection string nhé."},
        headers={"Authorization": f"Bearer {mentor_token}"},
    )
    assert msg_res.status_code == 200
    assert "SSL mode" in msg_res.json()["data"]["content"]

    # 5. Mentor resolves ticket
    resolve_res = await client.post(
        f"/api/v1/tickets/{ticket_id}/resolve",
        headers={"Authorization": f"Bearer {mentor_token}"},
    )
    assert resolve_res.status_code == 200
    assert resolve_res.json()["data"]["status"] == "resolved"


@pytest.mark.asyncio
async def test_scoring_and_leaderboard_flow(client: AsyncClient, test_db: AsyncSession):
    # Setup Judge & Team
    judge = User(
        email="judge_test@example.com",
        password_hash=get_password_hash("Pass@123"),
        full_name="Judge Test",
        role="judge",
        profile_completed=True,
    )
    test_db.add(judge)
    await test_db.flush()

    team = Team(name="Scored Team", status="approved", created_by=judge.id)
    test_db.add(team)
    await test_db.flush()

    # Assign judge
    assignment = JudgeAssignment(
        judge_id=judge.id,
        team_id=team.id,
        assigned_by=judge.id,
    )
    test_db.add(assignment)

    # Create Criteria
    c1 = ScoringCriteria(name="Criteria 1", max_score=10.0, weight=0.5, display_order=1)
    c2 = ScoringCriteria(name="Criteria 2", max_score=10.0, weight=0.5, display_order=2)
    test_db.add(c1)
    test_db.add(c2)
    await test_db.commit()

    judge_token = create_access_token({"sub": judge.id, "email": judge.email, "role": "judge"})

    # Submit evaluation
    eval_res = await client.post(
        "/api/v1/scoring/evaluate",
        json={
            "team_id": team.id,
            "details": [
                {"criteria_id": c1.id, "score": 8.0, "note": "Good"},
                {"criteria_id": c2.id, "score": 10.0, "note": "Excellent"},
            ],
            "general_comment": "Dự án rất tiềm năng!",
            "is_draft": False,
        },
        headers={"Authorization": f"Bearer {judge_token}"},
    )
    assert eval_res.status_code == 200
    data = eval_res.json()["data"]
    # 8.0 * 0.5 + 10.0 * 0.5 = 9.0
    assert data["total_score"] == 9.0
    assert data["status"] == "submitted"

    # Check Leaderboard
    lb_res = await client.get(
        "/api/v1/scoring/leaderboard",
        headers={"Authorization": f"Bearer {judge_token}"},
    )
    assert lb_res.status_code == 200
    lb_data = lb_res.json()["data"]
    assert len(lb_data) >= 1
    assert lb_data[0]["total_score"] == 9.0
