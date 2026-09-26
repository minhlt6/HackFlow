import pytest
from datetime import datetime, timezone, timedelta
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.models.team import Team, TeamMember
from app.models.checkpoint import Checkpoint, CheckpointSubmission
from app.models.topic import Topic, Subtopic
from app.core.security import get_password_hash, create_access_token


@pytest.mark.asyncio
async def test_admin_checkpoints_crud(client: AsyncClient, test_db: AsyncSession):
    now = datetime.now(timezone.utc)

    # 1. Create Admin
    admin = User(
        email="admin_cp_test@hackflow.local",
        password_hash=get_password_hash("Admin@123"),
        full_name="Admin CP",
        role="admin",
        profile_completed=True,
    )
    test_db.add(admin)
    await test_db.commit()
    await test_db.refresh(admin)

    admin_token = create_access_token(
        {"sub": admin.id, "email": admin.email, "role": "admin", "name": admin.full_name}
    )
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 2. Test POST /api/v1/admin/checkpoints
    create_payload = {
        "name": "Integration CP 1",
        "description": "Nộp đề cương kiến trúc",
        "open_at": (now - timedelta(hours=1)).isoformat(),
        "close_at": (now + timedelta(days=2)).isoformat(),
        "display_order": 1,
        "is_required": True,
    }
    res = await client.post("/api/v1/admin/checkpoints", json=create_payload, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    cp_id = data["data"]["id"]
    assert data["data"]["name"] == "Integration CP 1"

    # 3. Test GET /api/v1/admin/checkpoints
    res = await client.get("/api/v1/admin/checkpoints", headers=headers)
    assert res.status_code == 200
    cps = res.json()["data"]
    assert any(c["id"] == cp_id for c in cps)

    # 4. Test PUT /api/v1/admin/checkpoints/{id}
    update_payload = {"name": "Integration CP 1 (Updated)"}
    res = await client.put(
        f"/api/v1/admin/checkpoints/{cp_id}", json=update_payload, headers=headers
    )
    assert res.status_code == 200
    assert res.json()["data"]["name"] == "Integration CP 1 (Updated)"

    # 5. Test GET /api/v1/admin/checkpoints/{id}/submissions
    res = await client.get(f"/api/v1/admin/checkpoints/{cp_id}/submissions", headers=headers)
    assert res.status_code == 200
    assert res.json()["success"] is True

    # 6. Test DELETE /api/v1/admin/checkpoints/{id}
    res = await client.delete(f"/api/v1/admin/checkpoints/{cp_id}", headers=headers)
    assert res.status_code == 200
    assert res.json()["success"] is True

    # Check that it was deleted
    res = await client.get("/api/v1/admin/checkpoints", headers=headers)
    assert not any(c["id"] == cp_id for c in res.json()["data"])


@pytest.mark.asyncio
async def test_admin_topics_crud_and_stats(client: AsyncClient, test_db: AsyncSession):
    # 1. Create Admin
    admin = User(
        email="admin_topics_test@hackflow.local",
        password_hash=get_password_hash("Admin@123"),
        full_name="Admin Topics",
        role="admin",
        profile_completed=True,
    )
    test_db.add(admin)
    await test_db.commit()
    await test_db.refresh(admin)

    admin_token = create_access_token(
        {"sub": admin.id, "email": admin.email, "role": "admin", "name": admin.full_name}
    )
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 2. Test POST /api/v1/admin/topics
    res = await client.post(
        "/api/v1/admin/topics",
        json={"name": "AI Healthcare", "description": "Ứng dụng AI y tế", "display_order": 1},
        headers=headers,
    )
    assert res.status_code == 200
    topic_data = res.json()["data"]
    topic_id = topic_data["id"]

    # 3. Test POST /api/v1/admin/topics/{id}/subtopics
    res = await client.post(
        f"/api/v1/admin/topics/{topic_id}/subtopics",
        json={
            "name": "Chẩn đoán X-Ray",
            "description": "Phân loại bệnh lý phổi",
            "max_teams": 3,
            "display_order": 1,
        },
        headers=headers,
    )
    assert res.status_code == 200
    subtopic_id = res.json()["data"]["id"]

    # 4. Test GET /api/v1/admin/topics
    res = await client.get("/api/v1/admin/topics", headers=headers)
    assert res.status_code == 200
    topics_list = res.json()["data"]
    assert any(t["id"] == topic_id for t in topics_list)

    # 5. Test GET /api/v1/admin/topics/stats
    res = await client.get("/api/v1/admin/topics/stats", headers=headers)
    assert res.status_code == 200
    stats = res.json()["data"]
    assert "summary" in stats
    assert "subtopics" in stats
    assert any(st["subtopic_id"] == subtopic_id for st in stats["subtopics"])

    # 6. Test GET /api/v1/admin/teams/no-topic
    res = await client.get("/api/v1/admin/teams/no-topic", headers=headers)
    assert res.status_code == 200
    assert isinstance(res.json()["data"], list)

    # 7. Test DELETE /api/v1/admin/subtopics/{id}
    res = await client.delete(f"/api/v1/admin/subtopics/{subtopic_id}", headers=headers)
    assert res.status_code == 200

    # 8. Test DELETE /api/v1/admin/topics/{id}
    res = await client.delete(f"/api/v1/admin/topics/{topic_id}", headers=headers)
    assert res.status_code == 200


@pytest.mark.asyncio
async def test_admin_mentors_management(client: AsyncClient, test_db: AsyncSession):
    # 1. Create Admin
    admin = User(
        email="admin_mentor_test@hackflow.local",
        password_hash=get_password_hash("Admin@123"),
        full_name="Admin Mentor Mgmt",
        role="admin",
        profile_completed=True,
    )
    test_db.add(admin)
    await test_db.commit()

    admin_token = create_access_token(
        {"sub": admin.id, "email": admin.email, "role": "admin", "name": admin.full_name}
    )
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 2. Test POST /api/v1/admin/mentors
    res = await client.post(
        "/api/v1/admin/mentors",
        json={
            "full_name": "TS. Lê Mentor",
            "email": "le_mentor@hackflow.local",
            "school": "ĐH Bách Khoa",
            "skills": ["Python", "FastAPI", "AI"],
        },
        headers=headers,
    )
    assert res.status_code == 200
    mentor_data = res.json()["data"]
    mentor_id = mentor_data["id"]

    # 3. Test GET /api/v1/admin/mentors
    res = await client.get("/api/v1/admin/mentors", headers=headers)
    assert res.status_code == 200
    mentors = res.json()["data"]
    assert any(m["id"] == mentor_id for m in mentors)

    # 4. Test PUT /api/v1/admin/mentors/{id}
    res = await client.put(
        f"/api/v1/admin/mentors/{mentor_id}",
        json={"school": "ĐH Công Nghệ - ĐHQGHN"},
        headers=headers,
    )
    assert res.status_code == 200
    assert res.json()["success"] is True
