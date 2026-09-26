import pytest
import asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.models.team import Team, TeamMember
from app.models.topic import Topic, Subtopic
from app.core.security import get_password_hash, create_access_token


@pytest.mark.asyncio
async def test_concurrent_topic_selection(client: AsyncClient, test_db: AsyncSession):
    """Kịch bản kiểm thử tranh chấp (Race condition):
    5 đội thi đã được duyệt cùng gửi request chọn đề tài chỉ còn đúng 1 suất cuối cùng.
    Hệ thống phải đảm bảo đúng 1 đội thành công, 4 đội còn lại bị từ chối với mã lỗi 400.
    """
    # 1. Create a Topic with a Subtopic having max_teams = 1
    topic = Topic(name="AI Topic", description="Topic Description", display_order=1)
    test_db.add(topic)
    await test_db.flush()

    subtopic = Subtopic(
        topic_id=topic.id,
        name="Hot AI Subtopic (1 Slot Only)",
        max_teams=1,
        current_registered_count=0,
    )
    test_db.add(subtopic)
    await test_db.commit()

    # 2. Create 5 approved teams with 5 leaders
    num_teams = 5
    leaders = []
    teams = []
    tokens = []

    for i in range(num_teams):
        user = User(
            email=f"leader_{i}@example.com",
            password_hash=get_password_hash("Pass@123"),
            full_name=f"Leader {i}",
            role="participant",
            profile_completed=True,
        )
        test_db.add(user)
        await test_db.flush()

        team = Team(
            name=f"Race Team {i}",
            status="approved",
            created_by=user.id,
        )
        test_db.add(team)
        await test_db.flush()

        member = TeamMember(
            team_id=team.id,
            user_id=user.id,
            role="leader",
            status="accepted",
        )
        test_db.add(member)
        await test_db.flush()

        leaders.append(user)
        teams.append(team)
        tokens.append(
            create_access_token({"sub": user.id, "email": user.email, "role": "participant"})
        )

    await test_db.commit()

    # 3. Fire all 5 requests concurrently using asyncio.gather
    async def make_selection(team_id: str, token: str):
        return await client.post(
            f"/api/v1/topics/subtopics/{subtopic.id}/select?team_id={team_id}",
            headers={"Authorization": f"Bearer {token}"},
        )

    tasks = [make_selection(teams[i].id, tokens[i]) for i in range(num_teams)]
    responses = await asyncio.gather(*tasks)

    # 4. Assert results
    status_codes = [r.status_code for r in responses]
    success_count = status_codes.count(200)
    conflict_count = status_codes.count(400)

    # Exactly 1 team succeeds, all other 4 fail with 400
    assert success_count == 1, f"Expected 1 success, got {success_count}. Statuses: {status_codes}"
    assert (
        conflict_count == num_teams - 1
    ), f"Expected {num_teams - 1} rejections, got {conflict_count}"

    # Verify registered count in DB is exactly 1
    await test_db.refresh(subtopic)
    assert subtopic.current_registered_count == 1
