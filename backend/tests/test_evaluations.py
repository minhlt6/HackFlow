from datetime import datetime, timedelta, timezone
import re
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token
from app.models.checkpoint import AuditLog, Checkpoint, Submission, SubmissionStatus
from app.models.evaluation import Evaluation, EvaluationStatus
from app.models.team import Team, TeamMember, TeamMemberRole
from app.models.topic import Subtopic, Topic
from app.models.user import ApprovalStatus, User, UserRole
from app.services.evaluation_service import (
    calculate_weighted_score,
    generate_anonymous_team_code,
)


async def _create_user(
    db: AsyncSession,
    email: str,
    full_name: str,
    role: UserRole,
    approval_status: ApprovalStatus = ApprovalStatus.APPROVED,
) -> User:
    user = User(
        email=email,
        full_name=full_name,
        role=role.value,
        approval_status=approval_status.value,
        is_active=True,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


def _auth_headers(user: User) -> dict:
    token = create_access_token(
        subject=str(user.id),
        claims={
            "role": user.role,
            "approval_status": user.approval_status,
        },
    )
    return {"Authorization": f"Bearer {token}"}


async def _seed_final_submission(
    db: AsyncSession, leader: User, team_name: str = "Secret AlphaNova"
) -> Submission:
    topic = Topic(
        title=f"AI Healthcare Track ({team_name})",
        description="AI in Medicine",
        is_active=True,
    )
    db.add(topic)
    await db.flush()

    subtopic = Subtopic(
        topic_id=topic.id,
        title="Automated Medical Imaging Triage",
        description="Deep learning triage",
        max_teams=5,
        current_teams=1,
        is_active=True,
    )
    db.add(subtopic)
    await db.flush()

    team = Team(
        team_name=team_name,
        invite_code=f"INV-{leader.id[:6].upper()}",
        topic_id=topic.id,
        subtopic_id=subtopic.id,
        is_locked=True,
    )
    db.add(team)
    await db.flush()

    member = TeamMember(
        team_id=team.id,
        user_id=leader.id,
        role=TeamMemberRole.LEADER.value,
    )
    db.add(member)

    now = datetime.now(timezone.utc)
    cp_non_final = Checkpoint(
        title="Checkpoint 1 - Idea Proposal",
        description="Non-final checkpoint",
        start_time=now - timedelta(days=2),
        deadline=now + timedelta(days=1),
        is_active=True,
        is_final_checkpoint=False,
        grace_period_seconds=5,
    )
    cp_final = Checkpoint(
        title="Checkpoint 2 - Final Code Freeze",
        description="Final checkpoint",
        start_time=now - timedelta(days=1),
        deadline=now + timedelta(days=1),
        is_active=True,
        is_final_checkpoint=True,
        grace_period_seconds=5,
    )
    db.add_all([cp_non_final, cp_final])
    await db.flush()

    sub_non_final = Submission(
        team_id=team.id,
        checkpoint_id=cp_non_final.id,
        submitted_by=leader.id,
        repo_url="https://github.com/alphanova/draft-idea",
        status=SubmissionStatus.SUBMITTED.value,
        submitted_at=now - timedelta(hours=5),
    )
    sub_final = Submission(
        team_id=team.id,
        checkpoint_id=cp_final.id,
        submitted_by=leader.id,
        repo_url="https://github.com/alphanova/med-triage-ai",
        demo_url="https://demo.alphanova.tech",
        commit_sha="8f9a1b2c3d4e5f60718293a4b5c6d7e8f9a0b1c2",
        submission_data={
            "repo_url": "https://github.com/alphanova/med-triage-ai",
            "demo_url": "https://demo.alphanova.tech",
            "slide_url": "https://slides.alphanova.tech/pitch.pdf",
        },
        note="Full end-to-end medical triage prototype with TensorRT inference.",
        status=SubmissionStatus.SUBMITTED.value,
        submitted_at=now - timedelta(hours=1),
    )
    db.add_all([sub_non_final, sub_final])
    await db.commit()
    await db.refresh(sub_final)
    return sub_final


async def _add_evaluation_scores(
    db: AsyncSession,
    submission_id: str,
    evaluator_id: str,
    criteria_scores: list[tuple[str, float]],
    status_val: str = EvaluationStatus.SUBMITTED.value,
) -> None:
    now = datetime.now(timezone.utc)
    for criteria_id, score_val in criteria_scores:
        db.add(
            Evaluation(
                submission_id=submission_id,
                judge_id=evaluator_id,
                criteria_id=criteria_id,
                score=float(score_val),
                status=status_val,
                evaluated_at=now,
                submitted_at=now if status_val == EvaluationStatus.SUBMITTED.value else None,
            )
        )
    await db.commit()


@pytest.mark.asyncio
async def test_unit_anonymous_team_code_and_weighted_score_formula():
    """Unit checks: deterministic SHA-256 anonymous team code and 100-point weighted score."""
    code1 = generate_anonymous_team_code("team-uuid-12345")
    code2 = generate_anonymous_team_code("team-uuid-12345")
    code_other = generate_anonymous_team_code("team-uuid-99999")

    assert code1 == code2
    assert re.match(r"^Team #[0-9A-F]{4}$", code1)
    assert code1 != code_other

    # S_{j,s} = (8/10 * 0.4 + 9/10 * 0.6) * 100 = (0.32 + 0.54) * 100 = 86.0
    score = calculate_weighted_score([(8.0, 10.0, 0.4), (9.0, 10.0, 0.6)])
    assert score == 86.0


@pytest.mark.asyncio
async def test_rubric_crud_and_weight_validation(
    client: AsyncClient, db_session: AsyncSession
):
    """GET & POST /api/v1/rubrics and weight = 1.00 validation."""
    admin = await _create_user(
        db_session, "admin_rubric@hackflow.tech", "Admin BTC", UserRole.ADMIN
    )
    mentor = await _create_user(
        db_session, "mentor_rubric@hackflow.tech", "Mentor One", UserRole.MENTOR
    )
    await db_session.commit()

    # 1. Non-admin cannot configure rubrics (403 FORBIDDEN)
    res_forbidden = await client.post(
        "/api/v1/rubrics",
        headers=_auth_headers(mentor),
        json={
            "name": "Unauthorized Rubric",
            "criteria": [{"title": "Tech", "max_score": 10, "weight": 1.0}],
        },
    )
    assert res_forbidden.status_code == 403

    # 2. Invalid total weight != 1.00 -> 400 CRITERIA_WEIGHT_INVALID
    res_bad_weight = await client.post(
        "/api/v1/rubrics",
        headers=_auth_headers(admin),
        json={
            "name": "Invalid Weight Rubric",
            "criteria": [
                {"title": "Technical", "max_score": 10, "weight": 0.4, "display_order": 1},
                {"title": "Innovation", "max_score": 10, "weight": 0.4, "display_order": 2},
            ],
        },
    )
    assert res_bad_weight.status_code == 400
    assert res_bad_weight.json()["error_code"] == "CRITERIA_WEIGHT_INVALID"

    # 3. Invalid max_score <= 0 -> 400 CRITERIA_WEIGHT_INVALID
    res_bad_max = await client.post(
        "/api/v1/rubrics",
        headers=_auth_headers(admin),
        json={
            "name": "Bad Max Score Rubric",
            "criteria": [
                {"title": "Technical", "max_score": 0, "weight": 1.0, "display_order": 1},
            ],
        },
    )
    assert res_bad_max.status_code == 400
    assert res_bad_max.json()["error_code"] == "CRITERIA_WEIGHT_INVALID"

    # 4. Valid rubric with total weight == 1.00 -> 201 Created
    res_ok = await client.post(
        "/api/v1/rubrics",
        headers=_auth_headers(admin),
        json={
            "name": "HackFlow 2026 Official Rubric",
            "criteria": [
                {
                    "title": "Presentation & Impact",
                    "description": "Pitch clarity and real-world impact",
                    "max_score": 10,
                    "weight": 0.25,
                    "is_required": True,
                    "display_order": 3,
                },
                {
                    "title": "Technical Implementation",
                    "description": "Architecture, code quality, performance",
                    "max_score": 20,
                    "weight": 0.40,
                    "is_required": True,
                    "display_order": 1,
                },
                {
                    "title": "Innovation & Creativity",
                    "description": "Originality of approach",
                    "max_score": 10,
                    "weight": 0.35,
                    "is_required": True,
                    "display_order": 2,
                },
            ],
        },
    )
    assert res_ok.status_code == 201
    body_ok = res_ok.json()
    assert body_ok["success"] is True
    assert body_ok["data"]["total_weight"] == 1.0
    assert len(body_ok["data"]["criteria"]) == 3
    # Sorted by display_order (1, 2, 3)
    assert [c["display_order"] for c in body_ok["data"]["criteria"]] == [1, 2, 3]
    assert body_ok["data"]["criteria"][0]["title"] == "Technical Implementation"

    # 5. GET /api/v1/rubrics returns sorted criteria + total_weight
    res_get = await client.get("/api/v1/rubrics", headers=_auth_headers(mentor))
    assert res_get.status_code == 200
    get_data = res_get.json()["data"]
    assert get_data["total_weight"] == 1.0
    assert len(get_data["criteria"]) == 3
    assert len(get_data["rubrics"]) == 1
    assert get_data["rubrics"][0]["total_weight"] == 1.0


@pytest.mark.asyncio
async def test_rubric_lock_when_submitted_evaluations_exist(
    client: AsyncClient, db_session: AsyncSession
):
    """Admin cannot overwrite rubric once a submitted evaluation exists (409 RUBRIC_LOCKED_BY_EVALUATIONS)."""
    admin = await _create_user(
        db_session, "admin_lock@hackflow.tech", "Admin BTC", UserRole.ADMIN
    )
    leader = await _create_user(
        db_session, "leader_lock@hackflow.tech", "Leader Lock", UserRole.CANDIDATE
    )

    sub_final = await _seed_final_submission(db_session, leader, team_name="ByteCraft Team")

    res_rubric = await client.post(
        "/api/v1/rubrics",
        headers=_auth_headers(admin),
        json={
            "name": "Initial Rubric",
            "criteria": [
                {
                    "title": "Core Tech",
                    "max_score": 10,
                    "weight": 1.0,
                    "is_required": True,
                    "display_order": 1,
                }
            ],
        },
    )
    assert res_rubric.status_code == 201
    c_id = res_rubric.json()["data"]["criteria"][0]["id"]

    await _add_evaluation_scores(
        db_session,
        submission_id=sub_final.id,
        evaluator_id=admin.id,
        criteria_scores=[(c_id, 7.5)],
        status_val=EvaluationStatus.SUBMITTED.value,
    )

    res_rubric_locked = await client.post(
        "/api/v1/rubrics",
        headers=_auth_headers(admin),
        json={
            "name": "Modified Rubric",
            "criteria": [
                {
                    "title": "New Tech",
                    "max_score": 10,
                    "weight": 1.0,
                    "is_required": True,
                    "display_order": 1,
                }
            ],
        },
    )
    assert res_rubric_locked.status_code == 409
    assert res_rubric_locked.json()["error_code"] == "RUBRIC_LOCKED_BY_EVALUATIONS"


@pytest.mark.asyncio
async def test_leaderboard_aggregation_discrepancy_warning_and_draft_isolation(
    client: AsyncClient, db_session: AsyncSession
):
    """
    HF-43:
    - Only submitted evaluations are aggregated; draft evaluations are ignored.
    - Calculates final_score = round(mean(S_{j,s}), 2), max_spread, std_dev.
    - Flags has_discrepancy = True (HIGH_DISCREPANCY_WARNING) when max_spread > 15.0 or std_dev > 10.0.
    - Blocks Candidate/Mentor with 403 RESULTS_NOT_PUBLISHED when is_result_published == False.
    - Allows Admin to view full DRAFT leaderboard.
    """
    admin = await _create_user(
        db_session, "admin_lb@hackflow.tech", "Admin LB", UserRole.ADMIN
    )
    eval1 = await _create_user(
        db_session, "eval1_lb@hackflow.tech", "Evaluator One", UserRole.ADMIN
    )
    eval2 = await _create_user(
        db_session, "eval2_lb@hackflow.tech", "Evaluator Two", UserRole.ADMIN
    )
    eval3_draft = await _create_user(
        db_session, "eval3_lb@hackflow.tech", "Evaluator Three", UserRole.ADMIN
    )
    mentor = await _create_user(
        db_session, "mentor_lb@hackflow.tech", "Mentor LB", UserRole.MENTOR
    )
    leader1 = await _create_user(
        db_session, "leader1_lb@hackflow.tech", "Leader One", UserRole.CANDIDATE
    )
    leader2 = await _create_user(
        db_session, "leader2_lb@hackflow.tech", "Leader Two", UserRole.CANDIDATE
    )

    sub_alpha = await _seed_final_submission(db_session, leader1, team_name="AlphaNova")
    sub_byte = await _seed_final_submission(db_session, leader2, team_name="ByteCraft")

    res_rubric = await client.post(
        "/api/v1/rubrics",
        headers=_auth_headers(admin),
        json={
            "name": "Leaderboard Rubric",
            "criteria": [
                {
                    "title": "Technical",
                    "max_score": 100,
                    "weight": 0.6,
                    "is_required": True,
                    "display_order": 1,
                },
                {
                    "title": "Innovation",
                    "max_score": 100,
                    "weight": 0.4,
                    "is_required": True,
                    "display_order": 2,
                },
            ],
        },
    )
    assert res_rubric.status_code == 201
    c_tech, c_inno = [c["id"] for c in res_rubric.json()["data"]["criteria"]]

    # AlphaNova: Evaluator 1 = 90.0, Evaluator 2 = 88.0 -> final_score = 89.0, max_spread = 2.0, std_dev = 1.0
    await _add_evaluation_scores(
        db_session, sub_alpha.id, eval1.id, [(c_tech, 90), (c_inno, 90)]
    )
    await _add_evaluation_scores(
        db_session, sub_alpha.id, eval2.id, [(c_tech, 88), (c_inno, 88)]
    )
    # Evaluator 3 saves a DRAFT of 10.0 on AlphaNova -> must NOT affect final_score!
    await _add_evaluation_scores(
        db_session,
        sub_alpha.id,
        eval3_draft.id,
        [(c_tech, 10), (c_inno, 10)],
        status_val=EvaluationStatus.DRAFT.value,
    )

    # ByteCraft: Evaluator 1 = 92.0, Evaluator 2 = 71.0 -> final_score = 81.5, max_spread = 21.0, std_dev = 10.5
    await _add_evaluation_scores(
        db_session, sub_byte.id, eval1.id, [(c_tech, 92), (c_inno, 92)]
    )
    await _add_evaluation_scores(
        db_session, sub_byte.id, eval2.id, [(c_tech, 71), (c_inno, 71)]
    )

    # Candidate and Mentor cannot view unpublished leaderboard -> 403 RESULTS_NOT_PUBLISHED
    for non_admin in (leader1, mentor):
        res_403 = await client.get(
            "/api/v1/leaderboard", headers=_auth_headers(non_admin)
        )
        assert res_403.status_code == 403
        assert res_403.json()["error_code"] == "RESULTS_NOT_PUBLISHED"

    # Admin views DRAFT leaderboard -> 200 OK with full metrics
    res_admin = await client.get("/api/v1/leaderboard", headers=_auth_headers(admin))
    assert res_admin.status_code == 200
    lb_data = res_admin.json()["data"]
    assert lb_data["is_result_published"] is False
    assert lb_data["status"] == "DRAFT"

    board = lb_data["leaderboard"]
    assert len(board) == 2

    # Rank 1: AlphaNova (89.0)
    assert board[0]["rank"] == 1
    assert board[0]["team_name"] == "AlphaNova"
    assert board[0]["final_score"] == 89.0
    assert board[0]["eval_count"] == 2
    assert board[0]["max_spread"] == 2.0
    assert board[0]["std_dev"] == 1.0
    assert board[0]["has_discrepancy"] is False
    assert board[0]["warning_code"] is None

    # Rank 2: ByteCraft (81.5) -> HIGH_DISCREPANCY_WARNING
    assert board[1]["rank"] == 2
    assert board[1]["team_name"] == "ByteCraft"
    assert board[1]["final_score"] == 81.5
    assert board[1]["max_spread"] == 21.0
    assert board[1]["std_dev"] == 10.5
    assert board[1]["has_discrepancy"] is True
    assert board[1]["warning_code"] == "HIGH_DISCREPANCY_WARNING"


@pytest.mark.asyncio
async def test_leaderboard_three_level_tie_breaker_ranking(
    client: AsyncClient, db_session: AsyncSession
):
    """
    HF-43: 3-Level Tie-breaker verification when final_score is tied:
    1. Highest-weight criterion average score DESC
    2. Score standard deviation (std_dev) ASC
    3. Final Checkpoint submission timestamp (submitted_at) ASC
    """
    admin = await _create_user(
        db_session, "admin_tie@hackflow.tech", "Admin Tie", UserRole.ADMIN
    )
    eval1 = await _create_user(
        db_session, "eval1_tie@hackflow.tech", "Evaluator 1", UserRole.ADMIN
    )
    eval2 = await _create_user(
        db_session, "eval2_tie@hackflow.tech", "Evaluator 2", UserRole.ADMIN
    )

    l_a = await _create_user(
        db_session, "la@hackflow.tech", "Leader A", UserRole.CANDIDATE
    )
    l_b = await _create_user(
        db_session, "lb@hackflow.tech", "Leader B", UserRole.CANDIDATE
    )
    l_c = await _create_user(
        db_session, "lc@hackflow.tech", "Leader C", UserRole.CANDIDATE
    )
    l_d = await _create_user(
        db_session, "ld@hackflow.tech", "Leader D", UserRole.CANDIDATE
    )

    sub_a = await _seed_final_submission(
        db_session, l_a, team_name="Team_A_TopCriterionWinner"
    )
    sub_b = await _seed_final_submission(
        db_session, l_b, team_name="Team_B_LowStdDevWinner"
    )
    sub_c = await _seed_final_submission(
        db_session, l_c, team_name="Team_C_HighStdDevEarly"
    )
    sub_d = await _seed_final_submission(
        db_session, l_d, team_name="Team_D_HighStdDevLate"
    )

    now = datetime.now(timezone.utc)
    sub_c.submitted_at = now - timedelta(hours=3)
    sub_d.submitted_at = now - timedelta(hours=1)
    await db_session.commit()

    # Rubric: Core Tech (weight=0.6, max=100) + Pitch (weight=0.4, max=100)
    res_rubric = await client.post(
        "/api/v1/rubrics",
        headers=_auth_headers(admin),
        json={
            "name": "Tie-Breaker Rubric",
            "criteria": [
                {
                    "title": "Core Tech",
                    "max_score": 100,
                    "weight": 0.6,
                    "is_required": True,
                    "display_order": 1,
                },
                {
                    "title": "Pitch",
                    "max_score": 100,
                    "weight": 0.4,
                    "is_required": True,
                    "display_order": 2,
                },
            ],
        },
    )
    c_core, c_pitch = [c["id"] for c in res_rubric.json()["data"]["criteria"]]

    # All 4 teams achieve exact same final_score = 80.0!
    for ev in (eval1, eval2):
        await _add_evaluation_scores(
            db_session, sub_a.id, ev.id, [(c_core, 90), (c_pitch, 65)]
        )
        await _add_evaluation_scores(
            db_session, sub_b.id, ev.id, [(c_core, 80), (c_pitch, 80)]
        )

    for sub in (sub_c, sub_d):
        await _add_evaluation_scores(
            db_session, sub.id, eval1.id, [(c_core, 80), (c_pitch, 90)]
        )
        await _add_evaluation_scores(
            db_session, sub.id, eval2.id, [(c_core, 80), (c_pitch, 70)]
        )

    res_lb = await client.get("/api/v1/leaderboard", headers=_auth_headers(admin))
    assert res_lb.status_code == 200
    board = res_lb.json()["data"]["leaderboard"]
    assert [item["team_name"] for item in board] == [
        "Team_A_TopCriterionWinner",
        "Team_B_LowStdDevWinner",
        "Team_C_HighStdDevEarly",
        "Team_D_HighStdDevLate",
    ]
    assert [item["rank"] for item in board] == [1, 2, 3, 4]


@pytest.mark.asyncio
async def test_publish_leaderboard_lifecycle_and_audit_log(
    client: AsyncClient, db_session: AsyncSession
):
    """
    HF-43:
    - PATCH /api/v1/admin/leaderboard/publish transitions DRAFT -> PUBLISHED and logs LEADERBOARD_PUBLISHED.
    - Re-publishing when already published returns 409 RESULTS_ALREADY_PUBLISHED.
    - Candidate can view published leaderboard (without private judge_scores or has_discrepancy).
    """
    admin = await _create_user(
        db_session, "admin_pub@hackflow.tech", "Admin Pub", UserRole.ADMIN
    )
    candidate = await _create_user(
        db_session, "cand_pub@hackflow.tech", "Candidate Pub", UserRole.CANDIDATE
    )

    sub = await _seed_final_submission(db_session, candidate, team_name="OmegaChampion")
    res_rubric = await client.post(
        "/api/v1/rubrics",
        headers=_auth_headers(admin),
        json={
            "name": "Publish Rubric",
            "criteria": [
                {
                    "title": "Overall",
                    "max_score": 10,
                    "weight": 1.0,
                    "is_required": True,
                    "display_order": 1,
                }
            ],
        },
    )
    c_id = res_rubric.json()["data"]["criteria"][0]["id"]

    await _add_evaluation_scores(
        db_session, sub.id, admin.id, [(c_id, 9.5)]
    )

    # 1. Candidate cannot publish leaderboard -> 403 FORBIDDEN
    res_cand_pub = await client.patch(
        "/api/v1/admin/leaderboard/publish",
        headers=_auth_headers(candidate),
        json={"is_result_published": True},
    )
    assert res_cand_pub.status_code == 403

    # 2. Admin publishes leaderboard -> 200 OK
    res_pub = await client.patch(
        "/api/v1/admin/leaderboard/publish",
        headers=_auth_headers(admin),
        json={"is_result_published": True},
    )
    assert res_pub.status_code == 200
    pub_data = res_pub.json()["data"]
    assert pub_data["is_result_published"] is True
    assert pub_data["status"] == "PUBLISHED"
    assert pub_data["published_at"] is not None

    # Verify AuditLog(action="LEADERBOARD_PUBLISHED")
    audit_stmt = select(AuditLog).where(AuditLog.action == "LEADERBOARD_PUBLISHED")
    audit_log = (await db_session.execute(audit_stmt)).scalar_one_or_none()
    assert audit_log is not None
    assert audit_log.user_id == admin.id

    # 3. Calling publish again without unpublish flag -> 409 RESULTS_ALREADY_PUBLISHED
    res_dup = await client.patch(
        "/api/v1/admin/leaderboard/publish",
        headers=_auth_headers(admin),
        json={"is_result_published": True},
    )
    assert res_dup.status_code == 409
    assert res_dup.json()["error_code"] == "RESULTS_ALREADY_PUBLISHED"

    # 4. Candidate can now view published leaderboard -> 200 OK, public fields only
    res_cand_lb = await client.get(
        "/api/v1/leaderboard", headers=_auth_headers(candidate)
    )
    assert res_cand_lb.status_code == 200
    cand_data = res_cand_lb.json()["data"]
    assert cand_data["is_result_published"] is True
    assert cand_data["status"] == "PUBLISHED"
    entry = cand_data["leaderboard"][0]
    assert entry["rank"] == 1
    assert entry["team_name"] == "OmegaChampion"
    assert entry["final_score"] == 95.0
    assert "judge_scores" not in entry
    assert "has_discrepancy" not in entry
