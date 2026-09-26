import pytest
from httpx import AsyncClient
from app.models.user import User


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient, admin_user: User):
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": admin_user.email, "password": "Admin@123"},
    )
    assert response.status_code == 200
    json_data = response.json()
    assert json_data["success"] is True
    assert "access_token" in json_data["data"]
    assert json_data["data"]["email"] == admin_user.email
    assert json_data["data"]["role"] == "admin"


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient, admin_user: User):
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": admin_user.email, "password": "WrongPassword999"},
    )
    assert response.status_code == 401
    json_data = response.json()
    assert json_data["success"] is False


@pytest.mark.asyncio
async def test_get_me_authorized(
    client: AsyncClient, participant_token: str, participant_user: User
):
    response = await client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {participant_token}"},
    )
    assert response.status_code == 200
    json_data = response.json()
    assert json_data["success"] is True
    assert json_data["data"]["id"] == participant_user.id
    assert json_data["data"]["full_name"] == participant_user.full_name


@pytest.mark.asyncio
async def test_get_me_unauthorized(client: AsyncClient):
    response = await client.get("/api/v1/users/me")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_update_profile(client: AsyncClient, participant_token: str):
    payload = {
        "full_name": "Nguyễn Văn Đã Cập Nhật",
        "school": "Đại học Bách Khoa TP.HCM",
        "phone": "0987654321",
        "skills": ["Frontend", "React", "TypeScript"],
        "major_direction": "Frontend Developer",
        "province": "Hồ Chí Minh",
    }
    response = await client.put(
        "/api/v1/users/profile",
        json=payload,
        headers={"Authorization": f"Bearer {participant_token}"},
    )
    assert response.status_code == 200
    json_data = response.json()
    assert json_data["success"] is True
    assert json_data["data"]["full_name"] == "Nguyễn Văn Đã Cập Nhật"
    assert json_data["data"]["profile_completed"] is True
    assert "React" in json_data["data"]["skills"]


@pytest.mark.asyncio
@pytest.mark.parametrize("role", ["admin", "judge", "mentor", "leader", "member"])
async def test_dev_login_all_roles(client: AsyncClient, role: str):
    response = await client.post(
        "/api/v1/auth/dev-login",
        json={"role": role},
    )
    assert response.status_code == 200
    json_data = response.json()
    assert json_data["success"] is True
    assert "access_token" in json_data["data"]
    assert json_data["data"]["email"].endswith("@hackflow.local")
    expected_role = "participant" if role in ["leader", "member"] else role
    assert json_data["data"]["role"] == expected_role
