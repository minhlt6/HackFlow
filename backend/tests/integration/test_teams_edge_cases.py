"""
Test toàn diện cho Teams API — bao gồm team size limit, role authorization,
join edge cases, và các trường hợp biên quan trọng.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.core.security import get_password_hash, create_access_token


def make_user(email: str, role: str = "participant") -> dict:
    return {
        "email": email,
        "password_hash": get_password_hash("Pass@123"),
        "full_name": email.split("@")[0].title(),
        "role": role,
        "profile_completed": True,
    }


async def create_user_and_token(test_db, email: str, role: str = "participant") -> tuple[User, str]:
    user = User(**make_user(email, role))
    test_db.add(user)
    await test_db.commit()
    await test_db.refresh(user)
    token = create_access_token(
        {"sub": user.id, "email": user.email, "role": user.role, "name": user.full_name}
    )
    return user, token


# ─── HAPPY PATH ───────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_team_happy_path(client: AsyncClient, participant_token: str):
    """Tạo team thành công: creator thành leader, status = pending"""
    res = await client.post(
        "/api/v1/teams/",
        json={"name": "Alpha Squad", "description": "AI hackathon team"},
        headers={"Authorization": f"Bearer {participant_token}"},
    )
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["name"] == "Alpha Squad"
    assert data["status"] == "pending"
    assert len(data["members"]) == 1
    assert data["members"][0]["role"] == "leader"


@pytest.mark.asyncio
async def test_my_team_endpoint_returns_correct_data(client: AsyncClient, participant_token: str):
    """GET /teams/my-team trả về team của user hiện tại"""
    # Tạo team trước
    await client.post(
        "/api/v1/teams/",
        json={"name": "My Team Test", "description": "Test"},
        headers={"Authorization": f"Bearer {participant_token}"},
    )

    res = await client.get(
        "/api/v1/teams/my-team",
        headers={"Authorization": f"Bearer {participant_token}"},
    )
    assert res.status_code == 200
    assert res.json()["data"]["name"] == "My Team Test"


@pytest.mark.asyncio
async def test_my_team_returns_404_when_no_team(client: AsyncClient, test_db: AsyncSession):
    """GET /teams/my-team khi chưa có team → 404 hoặc success=False"""
    _, token = await create_user_and_token(test_db, "lonely@example.com")
    res = await client.get(
        "/api/v1/teams/my-team",
        headers={"Authorization": f"Bearer {token}"},
    )
    # Có thể 404 hoặc success=false, nhưng không phải 200 với data
    assert res.status_code in [404, 200]
    if res.status_code == 200:
        assert res.json().get("data") is None or res.json().get("success") is False


# ─── TEAM SIZE LIMIT ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_team_size_limit_enforced(
    client: AsyncClient, participant_token: str, participant_user: User, test_db: AsyncSession
):
    """
    HackathonConfig.max_team_size = 5 (mặc định).
    Khi đã có 5 thành viên, không được thêm người thứ 6.
    """
    # Tạo team với leader (người 1)
    team_res = await client.post(
        "/api/v1/teams/",
        json={"name": "Full House Team", "description": "Max size test"},
        headers={"Authorization": f"Bearer {participant_token}"},
    )
    assert team_res.status_code == 200
    team_id = team_res.json()["data"]["id"]

    # Thêm 4 thành viên nữa (người 2-5)
    users_and_tokens = []
    for i in range(2, 6):
        u, t = await create_user_and_token(test_db, f"member{i}@example.com")
        users_and_tokens.append((u, t))

        join_res = await client.post(
            f"/api/v1/teams/{team_id}/join",
            headers={"Authorization": f"Bearer {t}"},
        )
        assert join_res.status_code == 200, f"Member {i} join failed: {join_res.json()}"
        member_id = join_res.json()["data"]["id"]

        # Leader accept
        accept_res = await client.post(
            f"/api/v1/teams/{team_id}/members/{member_id}/respond?accept=true",
            headers={"Authorization": f"Bearer {participant_token}"},
        )
        assert accept_res.status_code == 200, f"Accept member {i} failed"

    # Thử thêm người thứ 6 → phải bị từ chối
    user6, token6 = await create_user_and_token(test_db, "overflow@example.com")
    join_res6 = await client.post(
        f"/api/v1/teams/{team_id}/join",
        headers={"Authorization": f"Bearer {token6}"},
    )
    # Phải trả về lỗi (400 hoặc 403)
    assert join_res6.status_code in [
        400,
        403,
        409,
    ], f"Expected error when joining full team, got {join_res6.status_code}: {join_res6.json()}"


# ─── DUPLICATE & CONFLICT ─────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_duplicate_team_name_rejected(
    client: AsyncClient, participant_token: str, test_db: AsyncSession
):
    """Không được có 2 đội cùng tên"""
    await client.post(
        "/api/v1/teams/",
        json={"name": "Unique Team XYZ", "description": "First"},
        headers={"Authorization": f"Bearer {participant_token}"},
    )

    _, token2 = await create_user_and_token(test_db, "other@example.com")
    res2 = await client.post(
        "/api/v1/teams/",
        json={"name": "Unique Team XYZ", "description": "Second"},
        headers={"Authorization": f"Bearer {token2}"},
    )
    assert res2.status_code == 400
    err_msg = str(res2.json())
    assert "tên" in err_msg.lower() or "name" in err_msg.lower() or "tồn tại" in err_msg.lower()


@pytest.mark.asyncio
async def test_user_cannot_create_two_teams(client: AsyncClient, participant_token: str):
    """Một user không thể tạo 2 đội"""
    await client.post(
        "/api/v1/teams/",
        json={"name": "First Team", "description": "OK"},
        headers={"Authorization": f"Bearer {participant_token}"},
    )
    res2 = await client.post(
        "/api/v1/teams/",
        json={"name": "Second Team", "description": "Should fail"},
        headers={"Authorization": f"Bearer {participant_token}"},
    )
    assert res2.status_code in [400, 409]


@pytest.mark.asyncio
async def test_user_cannot_join_own_team(client: AsyncClient, participant_token: str):
    """Leader không được join chính đội của mình"""
    team_res = await client.post(
        "/api/v1/teams/",
        json={"name": "Self Join Test", "description": "Edge case"},
        headers={"Authorization": f"Bearer {participant_token}"},
    )
    team_id = team_res.json()["data"]["id"]

    join_res = await client.post(
        f"/api/v1/teams/{team_id}/join",
        headers={"Authorization": f"Bearer {participant_token}"},
    )
    assert join_res.status_code in [400, 409]


@pytest.mark.asyncio
async def test_user_cannot_join_two_teams(
    client: AsyncClient, participant_token: str, test_db: AsyncSession
):
    """User đã là thành viên của đội A thì không thể join đội B"""
    # Tạo team A (participant_user là leader)
    team_a = await client.post(
        "/api/v1/teams/",
        json={"name": "Team A", "description": "Team A"},
        headers={"Authorization": f"Bearer {participant_token}"},
    )
    team_a_id = team_a.json()["data"]["id"]

    # Tạo user2 tạo team B
    user2, token2 = await create_user_and_token(test_db, "leader2@example.com")
    team_b = await client.post(
        "/api/v1/teams/",
        json={"name": "Team B", "description": "Team B"},
        headers={"Authorization": f"Bearer {token2}"},
    )
    team_b_id = team_b.json()["data"]["id"]

    # User3 join team A
    user3, token3 = await create_user_and_token(test_db, "multiteam@example.com")
    join_a = await client.post(
        f"/api/v1/teams/{team_a_id}/join",
        headers={"Authorization": f"Bearer {token3}"},
    )
    assert join_a.status_code == 200
    member_id = join_a.json()["data"]["id"]

    # Leader accept user3 vào team A
    await client.post(
        f"/api/v1/teams/{team_a_id}/members/{member_id}/respond?accept=true",
        headers={"Authorization": f"Bearer {participant_token}"},
    )

    # User3 cố join team B → phải bị từ chối
    join_b = await client.post(
        f"/api/v1/teams/{team_b_id}/join",
        headers={"Authorization": f"Bearer {token3}"},
    )
    assert join_b.status_code in [400, 409], f"Got {join_b.status_code}: {join_b.json()}"


# ─── AUTHORIZATION ────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_unauthenticated_cannot_create_team(client: AsyncClient):
    """Không có token → 401/403"""
    res = await client.post(
        "/api/v1/teams/",
        json={"name": "Ghost Team", "description": "No auth"},
    )
    assert res.status_code in [401, 403]


@pytest.mark.asyncio
async def test_non_leader_cannot_transfer_leadership(
    client: AsyncClient, participant_token: str, test_db: AsyncSession
):
    """Thành viên thường không được transfer leadership"""
    # Leader tạo team
    team_res = await client.post(
        "/api/v1/teams/",
        json={"name": "Transfer Fail Team", "description": "Test"},
        headers={"Authorization": f"Bearer {participant_token}"},
    )
    team_id = team_res.json()["data"]["id"]

    # Member 2 join và được accept
    user2, token2 = await create_user_and_token(test_db, "member2_tf@example.com")
    join_res = await client.post(
        f"/api/v1/teams/{team_id}/join",
        headers={"Authorization": f"Bearer {token2}"},
    )
    member_id = join_res.json()["data"]["id"]
    await client.post(
        f"/api/v1/teams/{team_id}/members/{member_id}/respond?accept=true",
        headers={"Authorization": f"Bearer {participant_token}"},
    )

    # Member 2 cố transfer leadership (không phải leader) → phải thất bại
    user3, _ = await create_user_and_token(test_db, "target_leader@example.com")
    transfer_res = await client.post(
        f"/api/v1/teams/{team_id}/transfer-leader",
        json={"new_leader_id": user3.id},
        headers={"Authorization": f"Bearer {token2}"},
    )
    assert transfer_res.status_code in [403, 400]


@pytest.mark.asyncio
async def test_admin_can_approve_team(
    client: AsyncClient, admin_token: str, participant_token: str
):
    """Admin có thể approve đội"""
    # Tạo team
    team_res = await client.post(
        "/api/v1/teams/",
        json={"name": "Pending Team", "description": "Needs approval"},
        headers={"Authorization": f"Bearer {participant_token}"},
    )
    team_id = team_res.json()["data"]["id"]
    assert team_res.json()["data"]["status"] == "pending"

    # Admin approve
    approve_res = await client.post(
        f"/api/v1/admin/teams/{team_id}/approve",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert approve_res.status_code == 200

    # Verify status changed
    team_detail = await client.get(
        f"/api/v1/teams/{team_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert team_detail.json()["data"]["status"] == "approved"


@pytest.mark.asyncio
async def test_participant_cannot_approve_team(
    client: AsyncClient, participant_token: str, test_db: AsyncSession
):
    """Participant không có quyền approve team"""
    team_res = await client.post(
        "/api/v1/teams/",
        json={"name": "Unauthorized Approve Test", "description": "Test"},
        headers={"Authorization": f"Bearer {participant_token}"},
    )
    team_id = team_res.json()["data"]["id"]

    # participant cố approve
    approve_res = await client.post(
        f"/api/v1/admin/teams/{team_id}/approve",
        headers={"Authorization": f"Bearer {participant_token}"},
    )
    assert approve_res.status_code == 403
