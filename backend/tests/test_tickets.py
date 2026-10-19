import pytest
from httpx import AsyncClient

from app.core.security import create_access_token, hash_password
from app.models.user import ApprovalStatus, User, UserRole


async def _create_user_with_token(
    db_session,
    *,
    email: str,
    role: str = UserRole.CANDIDATE.value,
    approval_status: str = ApprovalStatus.APPROVED.value,
):
    user = User(
        email=email,
        full_name=f"User {email}",
        hashed_password=hash_password("Pass123!"),
        role=role,
        approval_status=approval_status,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    token = create_access_token(
        subject=user.id,
        claims={"role": user.role, "approval_status": user.approval_status},
    )
    return user, {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_support_ticket_full_lifecycle_and_rbac(
    client: AsyncClient, db_session
):
    candidate, cand_headers = await _create_user_with_token(
        db_session, email="cand_ticket@test.dev", role=UserRole.CANDIDATE.value
    )
    other_cand, other_cand_headers = await _create_user_with_token(
        db_session, email="other_cand@test.dev", role=UserRole.CANDIDATE.value
    )
    pending_cand, pending_headers = await _create_user_with_token(
        db_session,
        email="pending_ticket@test.dev",
        role=UserRole.CANDIDATE.value,
        approval_status=ApprovalStatus.PENDING.value,
    )
    mentor, mentor_headers = await _create_user_with_token(
        db_session, email="mentor_ticket@test.dev", role=UserRole.MENTOR.value
    )
    judge, judge_headers = await _create_user_with_token(
        db_session, email="judge_ticket@test.dev", role=UserRole.JUDGE.value
    )

    # 1. Pending candidate cannot create ticket (403 ACCOUNT_NOT_APPROVED)
    res_pending = await client.post(
        "/api/v1/tickets",
        headers=pending_headers,
        json={
            "title": "Hỏi về nộp bài",
            "content": "Chưa được duyệt",
            "category": "submission_issue",
            "priority": "normal",
        },
    )
    assert res_pending.status_code == 403
    assert res_pending.json()["error_code"] == "ACCOUNT_NOT_APPROVED"

    # 2. Approved candidate creates ticket (201)
    res_create = await client.post(
        "/api/v1/tickets",
        headers=cand_headers,
        json={
            "title": "Lỗi xác thực GitHub SHA",
            "content": "Không lấy được commit hash từ nhánh main",
            "category": "technical",
            "priority": "high",
        },
    )
    assert res_create.status_code == 201
    ticket_id = res_create.json()["data"]["id"]
    assert res_create.json()["data"]["status"] == "open"

    # 3. Other candidate cannot view this ticket (isolation)
    res_other = await client.get(
        f"/api/v1/tickets/{ticket_id}", headers=other_cand_headers
    )
    assert res_other.status_code == 403
    assert res_other.json()["error_code"] == "FORBIDDEN_ROLE"

    # 4. Judge cannot access tickets API (403 FORBIDDEN_ROLE)
    res_judge = await client.get("/api/v1/tickets", headers=judge_headers)
    assert res_judge.status_code == 403
    assert res_judge.json()["error_code"] == "FORBIDDEN_ROLE"

    # 5. Mentor accepts ticket -> status = in_progress
    res_accept = await client.patch(
        f"/api/v1/tickets/{ticket_id}",
        headers=mentor_headers,
        json={"action": "accept"},
    )
    assert res_accept.status_code == 200
    assert res_accept.json()["data"]["status"] == "in_progress"
    assert res_accept.json()["data"]["assigned_to"] == mentor.id

    # 6. Resolve without response fails (422 MISSING_TICKET_RESPONSE)
    res_empty_resolve = await client.patch(
        f"/api/v1/tickets/{ticket_id}",
        headers=mentor_headers,
        json={"action": "resolve", "response": "   "},
    )
    assert res_empty_resolve.status_code == 422
    assert res_empty_resolve.json()["error_code"] == "MISSING_TICKET_RESPONSE"

    # 7. Mentor resolves ticket with response -> status = resolved
    res_resolve = await client.patch(
        f"/api/v1/tickets/{ticket_id}",
        headers=mentor_headers,
        json={
            "action": "resolve",
            "response": "Hãy chuyển repository sang chế độ Public rồi nộp lại.",
        },
    )
    assert res_resolve.status_code == 200
    assert res_resolve.json()["data"]["status"] == "resolved"

    # 8. Candidate closes resolved ticket -> status = closed
    res_close = await client.patch(
        f"/api/v1/tickets/{ticket_id}",
        headers=cand_headers,
        json={"action": "close"},
    )
    assert res_close.status_code == 200
    assert res_close.json()["data"]["status"] == "closed"
