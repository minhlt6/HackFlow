import pytest
from datetime import datetime, timezone, timedelta
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from unittest.mock import patch, AsyncMock
from app.models.user import User
from app.models.team import Team, TeamMember
from app.models.checkpoint import Checkpoint
from app.core.security import get_password_hash, create_access_token


@pytest.mark.asyncio
async def test_checkpoint_lifecycle_and_time_gating(client: AsyncClient, test_db: AsyncSession):
    now = datetime.now(timezone.utc)

    # 1. Create Checkpoint 1 (Open now) and Checkpoint 2 (Future)
    cp_open = Checkpoint(
        name="CP Open",
        open_at=now - timedelta(hours=1),
        close_at=now + timedelta(hours=2),
        display_order=1,
    )
    cp_future = Checkpoint(
        name="CP Future",
        open_at=now + timedelta(days=2),
        close_at=now + timedelta(days=4),
        display_order=2,
    )
    test_db.add(cp_open)
    test_db.add(cp_future)

    # 2. Create Team with Leader & Member
    leader = User(
        email="cpleader@example.com",
        password_hash=get_password_hash("Pass@123"),
        full_name="CP Leader",
        role="participant",
        profile_completed=True,
    )
    member = User(
        email="cpmember@example.com",
        password_hash=get_password_hash("Pass@123"),
        full_name="CP Member",
        role="participant",
        profile_completed=True,
    )
    test_db.add(leader)
    test_db.add(member)
    await test_db.flush()

    team = Team(name="CP Team", status="approved", created_by=leader.id)
    test_db.add(team)
    await test_db.flush()

    tm_leader = TeamMember(team_id=team.id, user_id=leader.id, role="leader", status="accepted")
    tm_member = TeamMember(team_id=team.id, user_id=member.id, role="member", status="accepted")
    test_db.add(tm_leader)
    test_db.add(tm_member)
    await test_db.commit()

    leader_token = create_access_token(
        {"sub": leader.id, "email": leader.email, "role": "participant"}
    )
    member_token = create_access_token(
        {"sub": member.id, "email": member.email, "role": "participant"}
    )

    # 3. List checkpoints
    list_res = await client.get(f"/api/v1/checkpoints/?team_id={team.id}")
    assert list_res.status_code == 200
    cps_data = list_res.json()["data"]
    assert len(cps_data) >= 2

    # 4. Member tries to submit (Forbidden)
    submit_by_member = await client.post(
        f"/api/v1/checkpoints/{cp_open.id}/submit?team_id={team.id}",
        json={"submission_url": "https://drive.google.com/test"},
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert submit_by_member.status_code == 403

    # 5. Leader tries to submit future checkpoint (Bad Request - not open yet)
    submit_future = await client.post(
        f"/api/v1/checkpoints/{cp_future.id}/submit?team_id={team.id}",
        json={"submission_url": "https://drive.google.com/test"},
        headers={"Authorization": f"Bearer {leader_token}"},
    )
    assert submit_future.status_code == 400
    assert "chưa đến thời gian" in submit_future.json()["error"]["message"]

    # 6. Leader submits open checkpoint successfully (Version 1)
    submit_v1 = await client.post(
        f"/api/v1/checkpoints/{cp_open.id}/submit?team_id={team.id}",
        json={"submission_url": "https://github.com/test/repo", "note": "Initial submission"},
        headers={"Authorization": f"Bearer {leader_token}"},
    )
    assert submit_v1.status_code == 200
    v1_data = submit_v1.json()["data"]
    assert v1_data["version"] == 1
    assert v1_data["is_latest"] is True

    # 7. Leader updates submission (Version 2)
    submit_v2 = await client.post(
        f"/api/v1/checkpoints/{cp_open.id}/submit?team_id={team.id}",
        json={"submission_url": "https://github.com/test/repo-updated", "note": "Updated v2"},
        headers={"Authorization": f"Bearer {leader_token}"},
    )
    assert submit_v2.status_code == 200
    v2_data = submit_v2.json()["data"]
    assert v2_data["version"] == 2
    assert v2_data["is_latest"] is True
    assert v2_data["submission_url"] == "https://github.com/test/repo-updated"


@pytest.mark.asyncio
async def test_final_submission_and_freeze(client: AsyncClient, test_db: AsyncSession):
    # Setup team & leader
    leader = User(
        email="final_leader@example.com",
        password_hash=get_password_hash("Pass@123"),
        full_name="Final Leader",
        role="participant",
        profile_completed=True,
    )
    test_db.add(leader)
    await test_db.flush()

    team = Team(name="Final Team", status="approved", created_by=leader.id)
    test_db.add(team)
    await test_db.flush()

    tm = TeamMember(team_id=team.id, user_id=leader.id, role="leader", status="accepted")
    test_db.add(tm)
    await test_db.commit()

    token = create_access_token({"sub": leader.id, "email": leader.email, "role": "participant"})

    # Submit final product
    with patch("app.services.submission_service.fetch_github_head_sha", new_callable=AsyncMock) as mock_sha:
        mock_sha.return_value = "abcdef1234567890abcdef1234567890abcdef12"
        sub_res = await client.post(
            f"/api/v1/submissions/final?team_id={team.id}",
            json={
                "github_url": "https://github.com/minhlt6/HackFlow",
                "demo_video_url": "https://youtube.com/watch?v=demo123",
                "slide_pdf_url": "https://storage.hackflow.local/slide.pdf",
                "description": "Nền tảng quản lý Hackathon",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert sub_res.status_code == 200
        data = sub_res.json()["data"]
        assert data["github_repo_owner"] == "minhlt6"
        assert data["github_repo_name"] == "HackFlow"
        assert data["frozen_commit_sha"] is not None
        assert data["version"] == 1
