import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.core.security import get_password_hash, create_access_token


@pytest.mark.asyncio
async def test_create_team(client: AsyncClient, participant_token: str):
    response = await client.post(
        "/api/v1/teams/",
        json={"name": "Đội Chiến Binh AI", "description": "Dự án nhận diện rác thải"},
        headers={"Authorization": f"Bearer {participant_token}"},
    )
    assert response.status_code == 200
    json_data = response.json()
    assert json_data["success"] is True
    assert json_data["data"]["name"] == "Đội Chiến Binh AI"
    assert json_data["data"]["status"] == "pending"
    assert len(json_data["data"]["members"]) == 1
    assert json_data["data"]["members"][0]["role"] == "leader"


@pytest.mark.asyncio
async def test_duplicate_team_name(
    client: AsyncClient, participant_token: str, test_db: AsyncSession
):
    # Create first team
    await client.post(
        "/api/v1/teams/",
        json={"name": "Unique Team Name", "description": "Desc 1"},
        headers={"Authorization": f"Bearer {participant_token}"},
    )

    # Create 2nd participant
    user2 = User(
        email="user2@example.com",
        password_hash=get_password_hash("Pass@123"),
        full_name="User 2",
        role="participant",
    )
    test_db.add(user2)
    await test_db.commit()
    token2 = create_access_token({"sub": user2.id, "email": user2.email, "role": "participant"})

    # Try creating team with duplicate name
    response = await client.post(
        "/api/v1/teams/",
        json={"name": "Unique Team Name", "description": "Desc 2"},
        headers={"Authorization": f"Bearer {token2}"},
    )
    assert response.status_code == 400
    assert "Tên đội đã tồn tại" in response.json()["error"]["message"]


@pytest.mark.asyncio
async def test_join_team_and_approve(
    client: AsyncClient, participant_token: str, test_db: AsyncSession
):
    # Leader creates team
    team_res = await client.post(
        "/api/v1/teams/",
        json={"name": "Team Collab", "description": "Test collab"},
        headers={"Authorization": f"Bearer {participant_token}"},
    )
    team_id = team_res.json()["data"]["id"]

    # Member 2 joins
    user2 = User(
        email="applicant@example.com",
        password_hash=get_password_hash("Pass@123"),
        full_name="Applicant",
        role="participant",
    )
    test_db.add(user2)
    await test_db.commit()
    token2 = create_access_token({"sub": user2.id, "email": user2.email, "role": "participant"})

    join_res = await client.post(
        f"/api/v1/teams/{team_id}/join",
        headers={"Authorization": f"Bearer {token2}"},
    )
    assert join_res.status_code == 200
    member_record_id = join_res.json()["data"]["id"]
    assert join_res.json()["data"]["status"] == "pending"

    # Leader approves
    respond_res = await client.post(
        f"/api/v1/teams/{team_id}/members/{member_record_id}/respond?accept=true",
        headers={"Authorization": f"Bearer {participant_token}"},
    )
    assert respond_res.status_code == 200
    assert respond_res.json()["data"]["status"] == "accepted"


@pytest.mark.asyncio
async def test_transfer_leadership(
    client: AsyncClient, participant_token: str, participant_user: User, test_db: AsyncSession
):
    # 1. Leader creates team
    team_res = await client.post(
        "/api/v1/teams/",
        json={"name": "Team Transfer", "description": "Test transfer"},
        headers={"Authorization": f"Bearer {participant_token}"},
    )
    team_id = team_res.json()["data"]["id"]

    # 2. Member 2 joins
    user2 = User(
        email="new_leader@example.com",
        password_hash=get_password_hash("Pass@123"),
        full_name="New Leader",
        role="participant",
    )
    test_db.add(user2)
    await test_db.commit()
    token2 = create_access_token({"sub": user2.id, "email": user2.email, "role": "participant"})

    join_res = await client.post(
        f"/api/v1/teams/{team_id}/join",
        headers={"Authorization": f"Bearer {token2}"},
    )
    member_id = join_res.json()["data"]["id"]

    # Leader accepts
    await client.post(
        f"/api/v1/teams/{team_id}/members/{member_id}/respond?accept=true",
        headers={"Authorization": f"Bearer {participant_token}"},
    )

    # 3. Transfer leader to user2
    transfer_res = await client.post(
        f"/api/v1/teams/{team_id}/transfer-leader",
        json={"new_leader_id": user2.id},
        headers={"Authorization": f"Bearer {participant_token}"},
    )
    assert transfer_res.status_code == 200
    updated_members = transfer_res.json()["data"]["members"]

    # Verify atomic update: exactly 1 leader, exactly 1 member
    roles = {m["user_id"]: m["role"] for m in updated_members}
    assert roles[user2.id] == "leader"
    assert roles[participant_user.id] == "member"
