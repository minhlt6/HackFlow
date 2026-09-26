import io
import hashlib
import pandas as pd
import uuid
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update, delete
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.core.security import get_current_user_payload, get_password_hash
from app.models.team import Team, TeamMember
from app.models.user import User, RegistrationWhitelist
from app.models.checkpoint import Checkpoint, CheckpointSubmission
from app.models.ticket import SupportTicket
from app.models.scoring import ScoringCriteria, Evaluation, JudgeAssignment
from app.models.config import HackathonConfig
from app.models.topic import Topic, Subtopic, TopicMentor, TeamTopicSelection
from app.schemas.config import HackathonConfigResponse, HackathonConfigUpdateRequest
from app.schemas.scoring import ScoringCriteriaCreateRequest, ScoringCriteriaResponse
from app.schemas.checkpoint import (
    CheckpointCreateRequest,
    CheckpointUpdateRequest,
    CheckpointResponse,
)
from app.schemas.topic import (
    TopicCreateRequest,
    TopicUpdateRequest,
    SubtopicCreateRequest,
    SubtopicUpdateRequest,
    TopicResponse,
    SubtopicResponse,
    SubtopicStatsResponse,
)
from app.schemas.common import APIResponse

router = APIRouter(prefix="/admin", tags=["Admin"])


def require_admin(payload: dict = Depends(get_current_user_payload)):
    if payload.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chỉ Quản trị viên (Admin) mới có quyền truy cập endpoint này.",
        )
    return payload


@router.get("/dashboard/stats", response_model=APIResponse[dict])
async def get_dashboard_stats(
    payload: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    # Total teams by status
    total_teams = (await db.execute(select(func.count(Team.id)))).scalar_one()
    approved_teams = (
        await db.execute(select(func.count(Team.id)).where(Team.status == "approved"))
    ).scalar_one()
    pending_teams = (
        await db.execute(select(func.count(Team.id)).where(Team.status == "pending"))
    ).scalar_one()

    # Total users
    total_participants = (
        await db.execute(select(func.count(User.id)).where(User.role == "participant"))
    ).scalar_one()

    # Tickets by status
    open_tickets = (
        await db.execute(select(func.count(SupportTicket.id)).where(SupportTicket.status == "open"))
    ).scalar_one()
    in_progress_tickets = (
        await db.execute(
            select(func.count(SupportTicket.id)).where(SupportTicket.status == "in_progress")
        )
    ).scalar_one()
    resolved_tickets = (
        await db.execute(
            select(func.count(SupportTicket.id)).where(SupportTicket.status == "resolved")
        )
    ).scalar_one()

    # FIX M-02: Thay N+1 query bằng 1 query GROUP BY — tránh query loop theo số checkpoint
    checkpoints = (
        (await db.execute(select(Checkpoint).order_by(Checkpoint.display_order))).scalars().all()
    )

    # Lấy tất cả submission count trong 1 query
    sub_counts_rows = (
        await db.execute(
            select(
                CheckpointSubmission.checkpoint_id,
                func.count(CheckpointSubmission.id).label("cnt"),
            )
            .where(CheckpointSubmission.is_latest == True)
            .group_by(CheckpointSubmission.checkpoint_id)
        )
    ).all()
    sub_counts = {row.checkpoint_id: row.cnt for row in sub_counts_rows}

    cp_stats = [
        {
            "checkpoint_id": cp.id,
            "name": cp.name,
            "submitted_teams": sub_counts.get(cp.id, 0),
            "unsubmitted_teams": max(0, approved_teams - sub_counts.get(cp.id, 0)),
        }
        for cp in checkpoints
    ]

    return APIResponse(
        success=True,
        data={
            "teams": {
                "total": total_teams,
                "approved": approved_teams,
                "pending": pending_teams,
            },
            "participants": total_participants,
            "tickets": {
                "open": open_tickets,
                "in_progress": in_progress_tickets,
                "resolved": resolved_tickets,
            },
            "checkpoints": cp_stats,
        },
        message="Lấy dữ liệu thống kê Dashboard thành công.",
    )


@router.post("/teams/{id}/approve", response_model=APIResponse[dict])
async def approve_team(
    id: str,
    payload: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    team = (await db.execute(select(Team).where(Team.id == id))).scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Không tìm thấy đội thi.")

    team.status = "approved"
    # FIX M-01: Tránh race condition blind_code — dùng UUID prefix thay vì đếm count
    # Đếm count không an toàn khi 2 request approve đồng thời → 2 team cùng "Đội #03"
    if not team.blind_code:
        import uuid as _uuid

        short = _uuid.uuid4().hex[:4].upper()
        team.blind_code = f"Đội-{short}"

    await db.commit()
    return APIResponse(
        success=True,
        data={"team_id": team.id, "status": team.status, "blind_code": team.blind_code},
        message="Phê duyệt đội thi thành công.",
    )


@router.post("/teams/{id}/reject", response_model=APIResponse[dict])
async def reject_team(
    id: str,
    payload: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    team = (await db.execute(select(Team).where(Team.id == id))).scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Không tìm thấy đội thi.")

    team.status = "rejected"
    await db.commit()
    return APIResponse(
        success=True,
        data={"team_id": team.id, "status": team.status},
        message="Đã từ chối đơn đăng ký của đội thi.",
    )


@router.get("/config", response_model=APIResponse[HackathonConfigResponse])
async def get_config(db: AsyncSession = Depends(get_db)):
    config = (
        await db.execute(select(HackathonConfig).where(HackathonConfig.id == 1))
    ).scalar_one_or_none()
    if not config:
        config = HackathonConfig(id=1)
        db.add(config)
        await db.commit()
        await db.refresh(config)
    return APIResponse(
        success=True,
        data=HackathonConfigResponse.model_validate(config),
        message="Lấy cấu hình cuộc thi thành công.",
    )


@router.put("/config", response_model=APIResponse[HackathonConfigResponse])
async def update_config(
    data: HackathonConfigUpdateRequest,
    payload: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    config = (
        await db.execute(select(HackathonConfig).where(HackathonConfig.id == 1))
    ).scalar_one_or_none()
    if not config:
        config = HackathonConfig(id=1)
        db.add(config)

    for field, val in data.model_dump(exclude_unset=True).items():
        setattr(config, field, val)

    await db.commit()
    await db.refresh(config)
    return APIResponse(
        success=True,
        data=HackathonConfigResponse.model_validate(config),
        message="Cập nhật cấu hình cuộc thi thành công.",
    )


@router.post("/criteria", response_model=APIResponse[ScoringCriteriaResponse])
async def create_criteria(
    data: ScoringCriteriaCreateRequest,
    payload: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    # FIX BUG #5: Validate weight hợp lệ trước khi tính tổng
    if data.weight <= 0:
        raise HTTPException(
            status_code=400,
            detail="Trọng số (weight) phải lớn hơn 0.",
        )
    if data.weight > 1.0:
        raise HTTPException(
            status_code=400,
            detail="Trọng số (weight) của 1 tiêu chí không được vượt quá 1.0.",
        )
    if data.max_score <= 0:
        raise HTTPException(
            status_code=400,
            detail="Điểm tối đa (max_score) phải lớn hơn 0.",
        )

    # Validate tổng weight không vượt 1.0 (dùng func.sum để chính xác hơn)
    current_weight_sum_result = await db.execute(
        select(func.coalesce(func.sum(ScoringCriteria.weight), 0.0)).where(
            ScoringCriteria.is_active == True
        )
    )
    current_weight_sum = float(current_weight_sum_result.scalar() or 0.0)
    new_total = current_weight_sum + data.weight

    if new_total > 1.0001:  # tolerance cho floating point
        remaining = round(1.0 - current_weight_sum, 4)
        raise HTTPException(
            status_code=400,
            detail=(
                f"Tổng trọng số sẽ vượt quá 1.0 sau khi thêm tiêu chí này. "
                f"Hiện tại: {current_weight_sum:.4f} | Thêm: {data.weight:.4f} | "
                f"Tổng mới: {new_total:.4f}. "
                f"Trọng số tối đa có thể thêm: {remaining:.4f}."
            ),
        )

    crit = ScoringCriteria(
        name=data.name,
        description=data.description,
        max_score=data.max_score,
        weight=data.weight,
        display_order=data.display_order,
    )
    db.add(crit)
    await db.commit()
    await db.refresh(crit)
    return APIResponse(
        success=True,
        data=ScoringCriteriaResponse.model_validate(crit),
        message=f"Tạo tiêu chí '{data.name}' thành công. Tổng weight hiện tại: {new_total:.4f}/1.0.",
    )


@router.get("/export/teams.csv")
async def export_teams_csv(
    payload: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Team)
        .options(
            selectinload(Team.members).selectinload(TeamMember.user),
            selectinload(Team.topic_selection),
        )
        .order_by(Team.created_at.asc())
    )
    teams = (await db.execute(stmt)).scalars().all()

    rows = []
    for t in teams:
        members_str = ", ".join(f"{m.user.full_name} ({m.role})" for m in t.members if m.user)
        rows.append(
            {
                "Team ID": t.id,
                "Team Name": t.name,
                "Status": t.status,
                "Blind Code": t.blind_code or "",
                "Members Count": len(t.members),
                "Members Details": members_str,
                "Created At": t.created_at.isoformat(),
            }
        )

    df = pd.DataFrame(rows)
    stream = io.StringIO()
    df.to_csv(stream, index=False, encoding="utf-8-sig")

    response = StreamingResponse(iter([stream.getvalue()]), media_type="text/csv")
    response.headers["Content-Disposition"] = "attachment; filename=hackflow_teams.csv"
    return response


@router.get("/export/scores.csv")
async def export_scores_csv(
    payload: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Evaluation)
        .options(
            selectinload(Evaluation.team),
            selectinload(Evaluation.judge),
        )
        .order_by(Evaluation.created_at.asc())
    )
    evals = (await db.execute(stmt)).scalars().all()

    rows = []
    for ev in evals:
        rows.append(
            {
                "Evaluation ID": ev.id,
                "Team Name": ev.team.name if ev.team else "",
                "Blind Code": ev.team.blind_code if ev.team else "",
                "Judge Name": ev.judge.full_name if ev.judge else "",
                "Total Score": ev.total_score,
                "Status": ev.status,
                "Comment": ev.general_comment or "",
                "Submitted At": ev.submitted_at.isoformat() if ev.submitted_at else "",
            }
        )

    df = pd.DataFrame(rows)
    stream = io.StringIO()
    df.to_csv(stream, index=False, encoding="utf-8-sig")

    response = StreamingResponse(iter([stream.getvalue()]), media_type="text/csv")
    response.headers["Content-Disposition"] = "attachment; filename=hackflow_scores.csv"
    return response


# ─── Judge Assignment Endpoints ───────────────────────────────────────────────


@router.get("/judges", response_model=APIResponse[List[dict]])
async def list_judges(
    payload: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Lấy danh sách tất cả giám khảo (role = 'judge')."""
    judges = (
        (await db.execute(select(User).where(User.role == "judge", User.is_active == True)))
        .scalars()
        .all()
    )
    return APIResponse(
        success=True,
        data=[
            {
                "id": j.id,
                "full_name": j.full_name,
                "email": j.email,
                "role": j.role,
                "school": j.school,
                "skills": j.skills or [],
            }
            for j in judges
        ],
        message="Lấy danh sách giám khảo thành công.",
    )


@router.post("/judges", response_model=APIResponse[dict])
async def create_judge(
    body: dict,
    payload: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Tạo mới tài khoản Giám Khảo (Judge)."""
    email = body.get("email", "").strip().lower()
    full_name = body.get("full_name", "").strip()
    password = body.get("password", "").strip() or "Judge@123"
    school = body.get("school", "").strip() or None
    skills = body.get("skills", [])

    if not email or not full_name:
        raise HTTPException(status_code=400, detail="Thiếu email hoặc họ tên giám khảo.")

    existing = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Email này đã tồn tại trong hệ thống.")

    judge = User(
        email=email,
        full_name=full_name,
        password_hash=get_password_hash(password),
        role="judge",
        school=school,
        skills=skills if isinstance(skills, list) else [],
        is_active=True,
        profile_completed=True,
        approval_status="approved",
    )
    db.add(judge)
    await db.commit()
    await db.refresh(judge)

    return APIResponse(
        success=True,
        data={
            "id": judge.id,
            "email": judge.email,
            "full_name": judge.full_name,
            "role": judge.role,
        },
        message=f"Đã tạo tài khoản Giám Khảo '{judge.full_name}' thành công. Mật khẩu tạm: {password}",
    )


@router.delete("/judges/{judge_id}", response_model=APIResponse[None])
async def delete_judge(
    judge_id: str,
    payload: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Xóa hoặc vô hiệu hóa tài khoản Giám Khảo."""
    judge = (
        await db.execute(select(User).where(User.id == judge_id, User.role == "judge"))
    ).scalar_one_or_none()
    if not judge:
        raise HTTPException(status_code=404, detail="Không tìm thấy giám khảo.")

    await db.delete(judge)
    await db.commit()
    return APIResponse(
        success=True,
        data=None,
        message=f"Đã xóa tài khoản giám khảo {judge.full_name}.",
    )


@router.get("/judge-assignments", response_model=APIResponse[List[dict]])
async def list_judge_assignments(
    payload: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Lấy tất cả phân công giám khảo."""
    stmt = (
        select(JudgeAssignment)
        .options(
            selectinload(JudgeAssignment.judge),
            selectinload(JudgeAssignment.team),
        )
        .order_by(JudgeAssignment.assigned_at.desc())
    )
    assignments = (await db.execute(stmt)).scalars().all()
    return APIResponse(
        success=True,
        data=[
            {
                "id": a.id,
                "judge_id": a.judge_id,
                "team_id": a.team_id,
                "assigned_at": a.assigned_at.isoformat(),
                "judge": (
                    {"id": a.judge.id, "full_name": a.judge.full_name, "email": a.judge.email}
                    if a.judge
                    else None
                ),
                "team": (
                    {"id": a.team.id, "name": a.team.name, "status": a.team.status}
                    if a.team
                    else None
                ),
            }
            for a in assignments
        ],
        message="Lấy danh sách phân công thành công.",
    )


@router.post("/judge-assignments", response_model=APIResponse[dict])
async def create_judge_assignment(
    data: dict,
    payload: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Phân công giám khảo chấm một đội thi."""
    judge_id = data.get("judge_id")
    team_id = data.get("team_id")

    if not judge_id or not team_id:
        raise HTTPException(status_code=400, detail="Thiếu judge_id hoặc team_id.")

    # Kiểm tra judge tồn tại và có role judge
    judge = (await db.execute(select(User).where(User.id == judge_id))).scalar_one_or_none()
    if not judge or judge.role != "judge":
        raise HTTPException(status_code=404, detail="Không tìm thấy giám khảo hợp lệ.")

    # Kiểm tra team tồn tại
    team = (await db.execute(select(Team).where(Team.id == team_id))).scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Không tìm thấy đội thi.")

    # Kiểm tra trùng phân công
    existing = (
        await db.execute(
            select(JudgeAssignment).where(
                JudgeAssignment.judge_id == judge_id,
                JudgeAssignment.team_id == team_id,
            )
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=400, detail="Giám khảo này đã được phân công cho đội thi này."
        )

    assignment = JudgeAssignment(
        judge_id=judge_id,
        team_id=team_id,
        # FIX BUG #13: Validate admin_id từ payload trước — không để None vào NOT NULL column
        assigned_by=payload["sub"],  # require_admin dependency đã đảm bảo "sub" tồn tại
        assigned_at=datetime.now(timezone.utc),
    )
    db.add(assignment)
    await db.commit()
    await db.refresh(assignment)

    return APIResponse(
        success=True,
        data={"id": assignment.id, "judge_id": judge_id, "team_id": team_id},
        message=f"Đã phân công {judge.full_name} chấm điểm đội '{team.name}'.",
    )


@router.delete("/judge-assignments/{assignment_id}", response_model=APIResponse[None])
async def delete_judge_assignment(
    assignment_id: str,
    payload: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Xóa phân công giám khảo."""
    assignment = (
        await db.execute(select(JudgeAssignment).where(JudgeAssignment.id == assignment_id))
    ).scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=404, detail="Không tìm thấy phân công này.")

    await db.delete(assignment)
    await db.commit()

    return APIResponse(success=True, data=None, message="Đã xóa phân công giám khảo.")


# ── PARTICIPANT APPROVAL ENDPOINTS ─────────────────────────────────────────


@router.get("/pending-users", response_model=APIResponse[list])
async def get_pending_users(
    payload: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Danh sách participant đang chờ BTC phê duyệt."""
    stmt = (
        select(User)
        .where(User.role == "participant", User.approval_status == "pending")
        .order_by(User.created_at.asc())
    )
    users = (await db.execute(stmt)).scalars().all()

    return APIResponse(
        success=True,
        data=[
            {
                "id": u.id,
                "email": u.email,
                "full_name": u.full_name,
                "student_id": u.student_id,
                "approval_status": u.approval_status,
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
            for u in users
        ],
        message=f"Có {len(users)} tài khoản đang chờ phê duyệt.",
    )


@router.post("/users/{user_id}/approve", response_model=APIResponse[dict])
async def approve_user(
    user_id: str,
    payload: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Phê duyệt tài khoản participant — tài khoản sẽ được kích hoạt ngay."""
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng.")
    if user.approval_status == "approved":
        raise HTTPException(status_code=400, detail="Tài khoản này đã được phê duyệt rồi.")

    user.approval_status = "approved"
    await db.commit()

    return APIResponse(
        success=True,
        data={"user_id": user.id, "email": user.email, "approval_status": "approved"},
        message=f"Đã phê duyệt tài khoản {user.email}. Người dùng có thể đăng nhập ngay.",
    )


@router.post("/users/{user_id}/reject", response_model=APIResponse[dict])
async def reject_user(
    user_id: str,
    payload: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Từ chối tài khoản participant."""
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng.")
    if user.approval_status == "rejected":
        raise HTTPException(status_code=400, detail="Tài khoản này đã bị từ chối rồi.")

    user.approval_status = "rejected"
    await db.commit()

    return APIResponse(
        success=True,
        data={"user_id": user.id, "email": user.email, "approval_status": "rejected"},
        message=f"Đã từ chối tài khoản {user.email}.",
    )


# ── WHITELIST MANAGEMENT ENDPOINTS ────────────────────────────────────────


@router.get("/whitelist", response_model=APIResponse[list])
async def get_whitelist(
    payload: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Xem toàn bộ danh sách email whitelist và trạng thái sử dụng."""
    entries = (
        (
            await db.execute(
                select(RegistrationWhitelist).order_by(RegistrationWhitelist.created_at.desc())
            )
        )
        .scalars()
        .all()
    )

    return APIResponse(
        success=True,
        data=[
            {
                "id": e.id,
                "email": e.email,
                "used": e.used,
                "note": e.note,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in entries
        ],
        message=f"Whitelist có {len(entries)} email ({sum(1 for e in entries if e.used)} đã đăng ký).",
    )


@router.post("/whitelist", response_model=APIResponse[dict])
async def add_whitelist_emails(
    body: dict,
    payload: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Thêm danh sách email vào whitelist (bulk).
    Body: { "emails": ["a@b.com", "c@d.com", ...], "note": "Danh sách SV K67" }
    """
    emails: list = body.get("emails", [])
    note: str = body.get("note", "")
    admin_id: str = payload.get("sub")

    if not emails:
        raise HTTPException(status_code=400, detail="Cần ít nhất 1 email.")

    added, skipped = 0, 0
    for raw_email in emails:
        email = raw_email.strip().lower()
        if not email:
            continue
        # Kiểm tra đã tồn tại chưa
        exists = (
            await db.execute(
                select(RegistrationWhitelist).where(RegistrationWhitelist.email == email)
            )
        ).scalar_one_or_none()
        if exists:
            skipped += 1
            continue

        db.add(RegistrationWhitelist(email=email, added_by=admin_id, note=note or None))
        added += 1

    await db.commit()

    return APIResponse(
        success=True,
        data={"added": added, "skipped": skipped},
        message=f"Đã thêm {added} email vào whitelist. Bỏ qua {skipped} email đã tồn tại.",
    )


@router.delete("/whitelist/{entry_id}", response_model=APIResponse[None])
async def remove_whitelist_email(
    entry_id: str,
    payload: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Xóa 1 email khỏi whitelist."""
    entry = (
        await db.execute(select(RegistrationWhitelist).where(RegistrationWhitelist.id == entry_id))
    ).scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Không tìm thấy entry trong whitelist.")

    await db.delete(entry)
    await db.commit()

    return APIResponse(success=True, data=None, message=f"Đã xóa {entry.email} khỏi whitelist.")


# ─── ADMIN CHECKPOINTS MANAGEMENT ───────────────────────────────────────────


@router.get("/checkpoints", response_model=APIResponse[List[dict]])
async def list_admin_checkpoints(
    payload: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Lấy danh sách tất cả checkpoints kèm số lượng bài nộp."""
    checkpoints = (
        (
            await db.execute(
                select(Checkpoint).order_by(
                    Checkpoint.display_order.asc(), Checkpoint.open_at.asc()
                )
            )
        )
        .scalars()
        .all()
    )

    total_approved_teams = (
        await db.execute(select(func.count(Team.id)).where(Team.status == "approved"))
    ).scalar_one()

    # Thống kê submission cho từng checkpoint
    sub_counts_rows = (
        await db.execute(
            select(
                CheckpointSubmission.checkpoint_id,
                func.count(CheckpointSubmission.id).label("cnt"),
            )
            .where(CheckpointSubmission.is_latest == True)
            .group_by(CheckpointSubmission.checkpoint_id)
        )
    ).all()
    sub_counts = {row.checkpoint_id: row.cnt for row in sub_counts_rows}

    def to_utc(dt: datetime) -> datetime:
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)

    data = []
    now = datetime.now(timezone.utc)
    for cp in checkpoints:
        submitted = sub_counts.get(cp.id, 0)
        unsubmitted = max(0, total_approved_teams - submitted)

        # Trạng thái theo thời gian UTC
        open_at_utc = to_utc(cp.open_at)
        close_at_utc = to_utc(cp.close_at)
        if now < open_at_utc:
            cp_status = "upcoming"
        elif now > close_at_utc:
            cp_status = "closed"
        else:
            cp_status = "open"

        data.append(
            {
                "id": cp.id,
                "name": cp.name,
                "description": cp.description,
                "open_at": cp.open_at.isoformat(),
                "close_at": cp.close_at.isoformat(),
                "display_order": cp.display_order,
                "is_required": cp.is_required,
                "points": cp.points,
                "late_penalty": cp.late_penalty,
                "block_enabled": cp.block_enabled,
                "block_threshold": cp.block_threshold,
                "required_fields": cp.required_fields or ["repo_url"],
                "status": cp_status,
                "submitted_teams": submitted,
                "unsubmitted_teams": unsubmitted,
                "created_at": cp.created_at.isoformat(),
            }
        )

    return APIResponse(success=True, data=data, message="Lấy danh sách checkpoint thành công.")


@router.post("/checkpoints", response_model=APIResponse[dict])
async def create_admin_checkpoint(
    data: CheckpointCreateRequest,
    payload: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Tạo mới 1 checkpoint."""
    if data.open_at >= data.close_at:
        raise HTTPException(
            status_code=400,
            detail="Thời gian bắt đầu (open_at) phải trước thời gian kết thúc (close_at).",
        )

    cp = Checkpoint(
        name=data.name.strip(),
        description=data.description.strip() if data.description else None,
        open_at=data.open_at,
        close_at=data.close_at,
        display_order=data.display_order,
        is_required=data.is_required,
        points=float(data.points),
        late_penalty=float(data.late_penalty),
        block_enabled=bool(data.block_enabled),
        block_threshold=int(data.block_threshold),
        required_fields=data.required_fields or ["repo_url"],
    )
    db.add(cp)
    await db.commit()
    await db.refresh(cp)

    return APIResponse(
        success=True,
        data={
            "id": cp.id,
            "name": cp.name,
            "description": cp.description,
            "open_at": cp.open_at.isoformat(),
            "close_at": cp.close_at.isoformat(),
            "display_order": cp.display_order,
            "is_required": cp.is_required,
            "points": cp.points,
            "late_penalty": cp.late_penalty,
            "block_enabled": cp.block_enabled,
            "block_threshold": cp.block_threshold,
            "required_fields": cp.required_fields,
        },
        message=f"Đã tạo checkpoint '{cp.name}' thành công.",
    )


@router.put("/checkpoints/{checkpoint_id}", response_model=APIResponse[dict])
async def update_admin_checkpoint(
    checkpoint_id: str,
    data: CheckpointUpdateRequest,
    payload: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Cập nhật checkpoint."""
    cp = (
        await db.execute(select(Checkpoint).where(Checkpoint.id == checkpoint_id))
    ).scalar_one_or_none()
    if not cp:
        raise HTTPException(status_code=404, detail="Không tìm thấy checkpoint.")

    def to_utc(dt: datetime) -> datetime:
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)

    update_dict = data.model_dump(exclude_unset=True)
    if "open_at" in update_dict and "close_at" in update_dict:
        if to_utc(update_dict["open_at"]) >= to_utc(update_dict["close_at"]):
            raise HTTPException(status_code=400, detail="open_at phải trước close_at.")
    elif "open_at" in update_dict and to_utc(update_dict["open_at"]) >= to_utc(cp.close_at):
        raise HTTPException(status_code=400, detail="open_at phải trước close_at hiện tại.")
    elif "close_at" in update_dict and to_utc(cp.open_at) >= to_utc(update_dict["close_at"]):
        raise HTTPException(status_code=400, detail="close_at phải sau open_at hiện tại.")

    for field, val in update_dict.items():
        setattr(cp, field, val)

    await db.commit()
    await db.refresh(cp)

    return APIResponse(
        success=True,
        data={
            "id": cp.id,
            "name": cp.name,
            "description": cp.description,
            "open_at": cp.open_at.isoformat(),
            "close_at": cp.close_at.isoformat(),
            "display_order": cp.display_order,
            "is_required": cp.is_required,
            "points": cp.points,
            "late_penalty": cp.late_penalty,
            "block_enabled": cp.block_enabled,
            "block_threshold": cp.block_threshold,
            "required_fields": cp.required_fields,
        },
        message=f"Đã cập nhật checkpoint '{cp.name}'.",
    )


@router.delete("/checkpoints/{checkpoint_id}", response_model=APIResponse[None])
async def delete_admin_checkpoint(
    checkpoint_id: str,
    payload: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Xóa checkpoint và toàn bộ bài nộp liên quan."""
    cp = (
        await db.execute(select(Checkpoint).where(Checkpoint.id == checkpoint_id))
    ).scalar_one_or_none()
    if not cp:
        raise HTTPException(status_code=404, detail="Không tìm thấy checkpoint.")

    await db.delete(cp)
    await db.commit()
    return APIResponse(success=True, data=None, message="Đã xóa checkpoint thành công.")


@router.get("/checkpoints/{checkpoint_id}/submissions", response_model=APIResponse[List[dict]])
async def get_checkpoint_submissions_detail(
    checkpoint_id: str,
    payload: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Lấy danh sách các đội và trạng thái nộp bài của checkpoint này."""
    cp = (
        await db.execute(select(Checkpoint).where(Checkpoint.id == checkpoint_id))
    ).scalar_one_or_none()
    if not cp:
        raise HTTPException(status_code=404, detail="Không tìm thấy checkpoint.")

    teams = (
        (await db.execute(select(Team).where(Team.status == "approved").order_by(Team.name.asc())))
        .scalars()
        .all()
    )

    subs = (
        (
            await db.execute(
                select(CheckpointSubmission)
                .options(selectinload(CheckpointSubmission.user))
                .where(
                    CheckpointSubmission.checkpoint_id == checkpoint_id,
                    CheckpointSubmission.is_latest == True,
                )
            )
        )
        .scalars()
        .all()
    )
    sub_map = {s.team_id: s for s in subs}

    result = []
    for t in teams:
        submission = sub_map.get(t.id)
        result.append(
            {
                "team_id": t.id,
                "team_name": t.name,
                "submitted": submission is not None,
                "submission_url": submission.submission_url if submission else None,
                "submitted_at": submission.submitted_at.isoformat() if submission else None,
                "submitted_by_name": (
                    submission.user.full_name if submission and submission.user else None
                ),
                "note": submission.note if submission else None,
                "version": submission.version if submission else 0,
                "custom_fields": submission.custom_fields if submission else {},
                "score_awarded": submission.score_awarded if submission else None,
                "is_late": submission.is_late if submission else False,
            }
        )

    return APIResponse(
        success=True,
        data=result,
        message=f"Lấy trạng thái nộp bài cho '{cp.name}' thành công.",
    )


# ─── ADMIN TOPICS & SUBTOPICS MANAGEMENT ─────────────────────────────────────


@router.get("/topics", response_model=APIResponse[List[dict]])
async def list_admin_topics(
    payload: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Lấy toàn bộ topics và subtopics (bao gồm cả active và inactive)."""
    stmt = (
        select(Topic)
        .options(
            selectinload(Topic.subtopics)
            .selectinload(Subtopic.mentors)
            .selectinload(TopicMentor.mentor)
        )
        .order_by(Topic.display_order.asc(), Topic.created_at.asc())
    )
    topics = (await db.execute(stmt)).scalars().all()

    data = []
    for t in topics:
        st_list = []
        for st in t.subtopics:
            mentors_info = [
                {"id": m.mentor.id, "full_name": m.mentor.full_name, "email": m.mentor.email}
                for m in st.mentors
                if m.mentor
            ]
            st_list.append(
                {
                    "id": st.id,
                    "topic_id": st.topic_id,
                    "name": st.name,
                    "description": st.description,
                    "sample_data_url": st.sample_data_url,
                    "reference_links": st.reference_links or [],
                    "max_teams": st.max_teams,
                    "current_registered_count": st.current_registered_count,
                    "display_order": st.display_order,
                    "is_active": st.is_active,
                    "mentors": mentors_info,
                }
            )
        data.append(
            {
                "id": t.id,
                "name": t.name,
                "description": t.description,
                "display_order": t.display_order,
                "is_active": t.is_active,
                "subtopics": st_list,
            }
        )

    return APIResponse(success=True, data=data, message="Lấy danh sách đề tài thành công.")


@router.post("/topics", response_model=APIResponse[dict])
async def create_admin_topic(
    data: TopicCreateRequest,
    payload: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Tạo chủ đề lớn (Topic)."""
    topic = Topic(
        name=data.name.strip(),
        description=data.description.strip() if data.description else None,
        display_order=data.display_order,
        is_active=True,
    )
    db.add(topic)
    await db.commit()
    await db.refresh(topic)

    return APIResponse(
        success=True,
        data={"id": topic.id, "name": topic.name, "description": topic.description},
        message=f"Đã tạo chủ đề '{topic.name}'.",
    )


@router.put("/topics/{topic_id}", response_model=APIResponse[dict])
async def update_admin_topic(
    topic_id: str,
    data: TopicUpdateRequest,
    payload: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Cập nhật chủ đề lớn."""
    topic = (await db.execute(select(Topic).where(Topic.id == topic_id))).scalar_one_or_none()
    if not topic:
        raise HTTPException(status_code=404, detail="Không tìm thấy chủ đề.")

    for field, val in data.model_dump(exclude_unset=True).items():
        setattr(topic, field, val)

    await db.commit()
    await db.refresh(topic)

    return APIResponse(
        success=True,
        data={"id": topic.id, "name": topic.name, "is_active": topic.is_active},
        message=f"Đã cập nhật chủ đề '{topic.name}'.",
    )


@router.delete("/topics/{topic_id}", response_model=APIResponse[None])
async def delete_admin_topic(
    topic_id: str,
    payload: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Xóa chủ đề lớn (cascade xóa toàn bộ subtopics)."""
    topic = (await db.execute(select(Topic).where(Topic.id == topic_id))).scalar_one_or_none()
    if not topic:
        raise HTTPException(status_code=404, detail="Không tìm thấy chủ đề.")

    await db.delete(topic)
    await db.commit()
    return APIResponse(success=True, data=None, message="Đã xóa chủ đề thành công.")


@router.post("/topics/{topic_id}/subtopics", response_model=APIResponse[dict])
async def create_admin_subtopic(
    topic_id: str,
    data: SubtopicCreateRequest,
    payload: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Tạo chủ đề nhỏ (Subtopic) trong chủ đề lớn."""
    topic = (await db.execute(select(Topic).where(Topic.id == topic_id))).scalar_one_or_none()
    if not topic:
        raise HTTPException(status_code=404, detail="Không tìm thấy chủ đề cha.")

    st = Subtopic(
        topic_id=topic_id,
        name=data.name.strip(),
        description=data.description.strip() if data.description else None,
        sample_data_url=data.sample_data_url,
        reference_links=data.reference_links or [],
        max_teams=data.max_teams if data.max_teams > 0 else 3,
        display_order=data.display_order,
        is_active=True,
    )
    db.add(st)
    await db.commit()
    await db.refresh(st)

    return APIResponse(
        success=True,
        data={"id": st.id, "topic_id": st.topic_id, "name": st.name, "max_teams": st.max_teams},
        message=f"Đã thêm chủ đề nhỏ '{st.name}'.",
    )


@router.put("/subtopics/{subtopic_id}", response_model=APIResponse[dict])
async def update_admin_subtopic(
    subtopic_id: str,
    data: SubtopicUpdateRequest,
    payload: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Cập nhật chủ đề nhỏ."""
    st = (await db.execute(select(Subtopic).where(Subtopic.id == subtopic_id))).scalar_one_or_none()
    if not st:
        raise HTTPException(status_code=404, detail="Không tìm thấy chủ đề nhỏ.")

    for field, val in data.model_dump(exclude_unset=True).items():
        setattr(st, field, val)

    await db.commit()
    await db.refresh(st)

    return APIResponse(
        success=True,
        data={
            "id": st.id,
            "name": st.name,
            "max_teams": st.max_teams,
            "is_active": st.is_active,
        },
        message=f"Đã cập nhật chủ đề nhỏ '{st.name}'.",
    )


@router.delete("/subtopics/{subtopic_id}", response_model=APIResponse[None])
async def delete_admin_subtopic(
    subtopic_id: str,
    payload: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Xóa chủ đề nhỏ."""
    st = (await db.execute(select(Subtopic).where(Subtopic.id == subtopic_id))).scalar_one_or_none()
    if not st:
        raise HTTPException(status_code=404, detail="Không tìm thấy chủ đề nhỏ.")

    await db.delete(st)
    await db.commit()
    return APIResponse(success=True, data=None, message="Đã xóa chủ đề nhỏ thành công.")


@router.get("/topics/stats", response_model=APIResponse[dict])
async def get_topics_stats(
    payload: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Bảng tổng quan và chi tiết phân bố đăng ký đề tài."""
    stmt = (
        select(Topic)
        .options(
            selectinload(Topic.subtopics)
            .selectinload(Subtopic.mentors)
            .selectinload(TopicMentor.mentor),
            selectinload(Topic.subtopics)
            .selectinload(Subtopic.selections)
            .selectinload(TeamTopicSelection.team),
        )
        .order_by(Topic.display_order.asc())
    )
    topics = (await db.execute(stmt)).scalars().all()

    total_subtopics = 0
    empty_subtopics = 0
    full_subtopics = 0
    almost_full_subtopics = 0
    detailed_list = []

    for t in topics:
        for st in t.subtopics:
            total_subtopics += 1
            cur = st.current_registered_count
            mx = st.max_teams

            if cur == 0:
                st_status = "empty"
                empty_subtopics += 1
            elif cur >= mx:
                st_status = "full"
                full_subtopics += 1
            elif cur == mx - 1:
                st_status = "almost_full"
                almost_full_subtopics += 1
            else:
                st_status = "available"

            registered_teams = [
                {
                    "team_id": sel.team.id,
                    "team_name": sel.team.name,
                    "selected_at": sel.selected_at.isoformat() if sel.selected_at else None,
                }
                for sel in st.selections
                if sel.team
            ]

            mentor_names = [m.mentor.full_name for m in st.mentors if m.mentor]

            detailed_list.append(
                {
                    "topic_id": t.id,
                    "topic_name": t.name,
                    "subtopic_id": st.id,
                    "subtopic_name": st.name,
                    "mentor_names": mentor_names,
                    "max_teams": mx,
                    "current_registered_count": cur,
                    "status": st_status,
                    "registered_teams": registered_teams,
                }
            )

    # Đội chưa chọn đề tài
    no_topic_stmt = (
        select(Team)
        .options(
            selectinload(Team.members).selectinload(TeamMember.user),
            selectinload(Team.topic_selection),
        )
        .where(Team.status == "approved")
    )
    approved_teams = (await db.execute(no_topic_stmt)).scalars().all()
    teams_with_topic = sum(1 for tm in approved_teams if tm.topic_selection is not None)
    teams_without_topic = [
        {
            "id": tm.id,
            "name": tm.name,
            "leader_email": next(
                (m.user.email for m in tm.members if m.role_in_team == "leader" and m.user), ""
            ),
            "members_count": len(tm.members),
            "created_at": tm.created_at.isoformat(),
        }
        for tm in approved_teams
        if tm.topic_selection is None
    ]

    return APIResponse(
        success=True,
        data={
            "summary": {
                "total_approved_teams": len(approved_teams),
                "teams_with_topic": teams_with_topic,
                "teams_without_topic_count": len(teams_without_topic),
                "total_subtopics": total_subtopics,
                "empty_subtopics": empty_subtopics,
                "almost_full_subtopics": almost_full_subtopics,
                "full_subtopics": full_subtopics,
            },
            "subtopics": detailed_list,
            "teams_without_topic": teams_without_topic,
        },
        message="Lấy thống kê đề tài thành công.",
    )


@router.get("/teams/no-topic", response_model=APIResponse[List[dict]])
async def get_teams_without_topic(
    payload: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Danh sách các đội thi đã duyệt nhưng chưa đăng ký chọn đề tài."""
    stmt = (
        select(Team)
        .options(
            selectinload(Team.members).selectinload(TeamMember.user),
            selectinload(Team.topic_selection),
        )
        .where(Team.status == "approved")
        .order_by(Team.created_at.asc())
    )
    teams = (await db.execute(stmt)).scalars().all()
    no_topic_teams = [
        {
            "id": tm.id,
            "name": tm.name,
            "leader_email": next(
                (m.user.email for m in tm.members if m.role_in_team == "leader" and m.user), ""
            ),
            "leader_name": next(
                (m.user.full_name for m in tm.members if m.role_in_team == "leader" and m.user), ""
            ),
            "members_count": len(tm.members),
            "created_at": tm.created_at.isoformat(),
        }
        for tm in teams
        if tm.topic_selection is None
    ]

    return APIResponse(
        success=True,
        data=no_topic_teams,
        message=f"Có {len(no_topic_teams)} đội chưa chọn đề tài.",
    )


# ─── ADMIN MENTORS MANAGEMENT ────────────────────────────────────────────────


@router.get("/mentors", response_model=APIResponse[List[dict]])
async def list_admin_mentors(
    payload: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Lấy danh sách tất cả mentor, kèm thông tin ticket đang xử lý và chủ đề phụ trách."""
    stmt = select(User).where(User.role == "mentor").order_by(User.full_name.asc())
    mentors = (await db.execute(stmt)).scalars().all()

    # Lấy phân công chủ đề của từng mentor
    mentor_ids = [m.id for m in mentors]
    assignments_stmt = (
        select(TopicMentor)
        .options(selectinload(TopicMentor.subtopic))
        .where(TopicMentor.mentor_id.in_(mentor_ids))
    )
    tm_rows = (await db.execute(assignments_stmt)).scalars().all() if mentor_ids else []
    subtopics_by_mentor: dict = {}
    for tm in tm_rows:
        subtopics_by_mentor.setdefault(tm.mentor_id, []).append(
            {"id": tm.subtopic.id, "name": tm.subtopic.name} if tm.subtopic else None
        )

    # Đếm số ticket assigned & pending/in_progress
    ticket_counts_stmt = (
        select(SupportTicket.assigned_mentor_id, func.count(SupportTicket.id).label("cnt"))
        .where(
            SupportTicket.assigned_mentor_id.in_(mentor_ids),
            SupportTicket.status.in_(["pending", "in_progress"]),
        )
        .group_by(SupportTicket.assigned_mentor_id)
    )
    tc_rows = (await db.execute(ticket_counts_stmt)).all() if mentor_ids else []
    tickets_by_mentor = {row.assigned_mentor_id: row.cnt for row in tc_rows}

    data = [
        {
            "id": m.id,
            "full_name": m.full_name,
            "email": m.email,
            "school": m.school,
            "skills": m.skills or [],
            "is_active": m.is_active,
            "active_tickets_count": tickets_by_mentor.get(m.id, 0),
            "assigned_subtopics": [s for s in subtopics_by_mentor.get(m.id, []) if s],
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in mentors
    ]

    return APIResponse(success=True, data=data, message="Lấy danh sách mentor thành công.")


@router.post("/mentors", response_model=APIResponse[dict])
async def create_admin_mentor(
    body: dict,
    payload: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Tạo mới tài khoản Mentor."""
    email = body.get("email", "").strip().lower()
    full_name = body.get("full_name", "").strip()
    password = body.get("password", "").strip() or "Mentor@123"
    school = body.get("school", "").strip() or None
    skills = body.get("skills", [])

    if not email or not full_name:
        raise HTTPException(status_code=400, detail="Thiếu email hoặc họ tên mentor.")

    existing = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Email này đã được sử dụng.")

    mentor = User(
        email=email,
        full_name=full_name,
        password_hash=get_password_hash(password),
        role="mentor",
        school=school,
        skills=skills if isinstance(skills, list) else [],
        is_active=True,
        profile_completed=True,
        approval_status="approved",
    )
    db.add(mentor)
    await db.commit()
    await db.refresh(mentor)

    return APIResponse(
        success=True,
        data={"id": mentor.id, "email": mentor.email, "full_name": mentor.full_name},
        message=f"Đã tạo tài khoản mentor '{mentor.full_name}' thành công. Mật khẩu tạm thời: {password}",
    )


@router.put("/mentors/{mentor_id}", response_model=APIResponse[dict])
async def update_admin_mentor(
    mentor_id: str,
    body: dict,
    payload: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Cập nhật thông tin hoặc trạng thái kích hoạt của Mentor."""
    mentor = (
        await db.execute(select(User).where(User.id == mentor_id, User.role == "mentor"))
    ).scalar_one_or_none()
    if not mentor:
        raise HTTPException(status_code=404, detail="Không tìm thấy mentor.")

    if "full_name" in body:
        mentor.full_name = body["full_name"].strip()
    if "school" in body:
        mentor.school = body["school"].strip() or None
    if "skills" in body and isinstance(body["skills"], list):
        mentor.skills = body["skills"]
    if "is_active" in body:
        mentor.is_active = bool(body["is_active"])

    await db.commit()
    await db.refresh(mentor)

    return APIResponse(
        success=True,
        data={"id": mentor.id, "full_name": mentor.full_name, "is_active": mentor.is_active},
        message=f"Đã cập nhật thông tin mentor '{mentor.full_name}'.",
    )


@router.post("/subtopics/{subtopic_id}/mentors", response_model=APIResponse[dict])
async def assign_mentor_to_subtopic(
    subtopic_id: str,
    body: dict,
    payload: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Phân công mentor phụ trách chủ đề nhỏ."""
    mentor_id = body.get("mentor_id")
    if not mentor_id:
        raise HTTPException(status_code=400, detail="Thiếu mentor_id.")

    mentor = (
        await db.execute(select(User).where(User.id == mentor_id, User.role == "mentor"))
    ).scalar_one_or_none()
    if not mentor:
        raise HTTPException(status_code=404, detail="Không tìm thấy mentor.")

    st = (await db.execute(select(Subtopic).where(Subtopic.id == subtopic_id))).scalar_one_or_none()
    if not st:
        raise HTTPException(status_code=404, detail="Không tìm thấy chủ đề nhỏ.")

    existing = (
        await db.execute(
            select(TopicMentor).where(
                TopicMentor.subtopic_id == subtopic_id,
                TopicMentor.mentor_id == mentor_id,
            )
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Mentor đã được phân công cho chủ đề này.")

    tm = TopicMentor(
        subtopic_id=subtopic_id,
        mentor_id=mentor_id,
        assigned_at=datetime.now(timezone.utc),
    )
    db.add(tm)
    await db.commit()

    return APIResponse(
        success=True,
        data={"subtopic_id": subtopic_id, "mentor_id": mentor_id},
        message=f"Đã phân công {mentor.full_name} phụ trách chủ đề '{st.name}'.",
    )


@router.delete("/subtopics/{subtopic_id}/mentors/{mentor_id}", response_model=APIResponse[None])
async def unassign_mentor_from_subtopic(
    subtopic_id: str,
    mentor_id: str,
    payload: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Hủy phân công mentor khỏi chủ đề nhỏ."""
    tm = (
        await db.execute(
            select(TopicMentor).where(
                TopicMentor.subtopic_id == subtopic_id,
                TopicMentor.mentor_id == mentor_id,
            )
        )
    ).scalar_one_or_none()
    if not tm:
        raise HTTPException(status_code=404, detail="Không tìm thấy phân công này.")

    await db.delete(tm)
    await db.commit()
    return APIResponse(success=True, data=None, message="Đã gỡ phân công mentor khỏi chủ đề.")


# ─── ADMIN SCORING CRITERIA UPDATE & DELETE ──────────────────────────────────


@router.put("/criteria/{criteria_id}", response_model=APIResponse[ScoringCriteriaResponse])
async def update_scoring_criteria(
    criteria_id: str,
    body: dict,
    payload: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Cập nhật tiêu chí chấm điểm."""
    crit = (
        await db.execute(select(ScoringCriteria).where(ScoringCriteria.id == criteria_id))
    ).scalar_one_or_none()
    if not crit:
        raise HTTPException(status_code=404, detail="Không tìm thấy tiêu chí chấm điểm.")

    if "name" in body:
        crit.name = body["name"].strip()
    if "description" in body:
        crit.description = body["description"].strip() or None
    if "max_score" in body:
        if body["max_score"] <= 0:
            raise HTTPException(status_code=400, detail="max_score phải > 0.")
        crit.max_score = float(body["max_score"])
    if "weight" in body:
        new_weight = float(body["weight"])
        if new_weight <= 0 or new_weight > 1.0:
            raise HTTPException(status_code=400, detail="weight phải từ 0 đến 1.0.")
        crit.weight = new_weight
    if "display_order" in body:
        crit.display_order = int(body["display_order"])
    if "is_active" in body:
        crit.is_active = bool(body["is_active"])

    await db.commit()
    await db.refresh(crit)

    return APIResponse(
        success=True,
        data=ScoringCriteriaResponse.model_validate(crit),
        message=f"Đã cập nhật tiêu chí '{crit.name}'.",
    )


@router.delete("/criteria/{criteria_id}", response_model=APIResponse[None])
async def delete_scoring_criteria(
    criteria_id: str,
    payload: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Xóa tiêu chí chấm điểm."""
    crit = (
        await db.execute(select(ScoringCriteria).where(ScoringCriteria.id == criteria_id))
    ).scalar_one_or_none()
    if not crit:
        raise HTTPException(status_code=404, detail="Không tìm thấy tiêu chí chấm điểm.")

    await db.delete(crit)
    await db.commit()
    return APIResponse(success=True, data=None, message="Đã xóa tiêu chí chấm điểm.")


@router.put("/criteria/rebalance/all", response_model=APIResponse[List[ScoringCriteriaResponse]])
async def rebalance_all_criteria(
    payload: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Tự động cân bằng lại trọng số tất cả tiêu chí đang hoạt động đều nhau (tổng = 1.0)."""
    crits = (
        (await db.execute(select(ScoringCriteria).where(ScoringCriteria.is_active == True).order_by(ScoringCriteria.display_order.asc())))
        .scalars()
        .all()
    )
    if not crits:
        raise HTTPException(status_code=400, detail="Không có tiêu chí nào đang hoạt động để cân bằng.")

    n = len(crits)
    equal_weight = round(1.0 / n, 2)
    # Gán trọng số đều, phần dư dồn vào tiêu chí cuối để tổng tròn đúng 1.0
    accumulated = 0.0
    for i, c in enumerate(crits):
        if i == n - 1:
            c.weight = round(1.0 - accumulated, 2)
        else:
            c.weight = equal_weight
            accumulated += equal_weight

    await db.commit()
    for c in crits:
        await db.refresh(c)

    return APIResponse(
        success=True,
        data=[ScoringCriteriaResponse.model_validate(c) for c in crits],
        message=f"Đã tự động cân bằng trọng số cho {n} tiêu chí (tổng = 100%).",
    )
