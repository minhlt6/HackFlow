import re
from datetime import datetime, timezone
from typing import Optional, Tuple
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException, status
from app.models.submission import FinalSubmission
from app.models.team import Team, TeamMember
from app.models.config import HackathonConfig
from app.schemas.submission import FinalSubmissionRequest


def parse_github_url(url: str) -> Tuple[str, str]:
    """
    Trích xuất owner và repo name từ đường dẫn GitHub.

    FIX BUG #11: Hỗ trợ thêm các format:
      - https://github.com/owner/repo           ✅ (cũ)
      - https://github.com/owner/repo/          ✅ (cũ)
      - git@github.com:owner/repo.git           ✅ (SSH — mới)
      - https://github.com/owner/repo.git       ✅ (HTTPS .git — mới)
      - https://github.com/owner/repo/tree/main ✅ (branch URL — mới)
      - https://github.com/owner/repo/issues    ✅ (sub-path — mới)
    """
    url = url.strip()

    # Pattern 1: SSH format — git@github.com:owner/repo.git
    ssh_match = re.match(
        r"^git@github\.com:([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+?)(?:\.git)?$",
        url,
    )
    if ssh_match:
        return ssh_match.group(1), ssh_match.group(2)

    # Pattern 2: HTTPS format — hỗ trợ sub-paths (tree/main, issues, etc.)
    https_match = re.search(
        r"github\.com/([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+?)(?:\.git|/.*)?$",
        url,
    )
    if https_match:
        return https_match.group(1), https_match.group(2)

    raise HTTPException(
        status_code=400,
        detail=(
            "Đường dẫn GitHub không hợp lệ. "
            "Ví dụ đúng: https://github.com/owner/repo "
            "hoặc git@github.com:owner/repo.git"
        ),
    )


async def fetch_github_head_sha(owner: str, repo: str) -> Optional[str]:
    """
    Gọi GitHub API lấy SHA commit mới nhất của nhánh mặc định.
    Trả về None nếu không kết nối được — caller phải xử lý trường hợp này.

    FIX BUG #3: Không trả về SHA giả "000...0" vì sẽ bị ghi vào frozen_commit_sha
    và gây báo sai "có chỉnh sửa sau deadline" khi so sánh về sau.
    """
    url = f"https://api.github.com/repos/{owner}/{repo}/commits/HEAD"
    headers = {"Accept": "application/vnd.github.v3+json", "User-Agent": "HackFlow-App"}
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            res = await client.get(url, headers=headers)
            if res.status_code == 200:
                data = res.json()
                sha = data.get("sha")
                if sha and len(sha) == 40:
                    return sha
            elif res.status_code == 404:
                raise HTTPException(
                    status_code=400,
                    detail=f"Repository github.com/{owner}/{repo} không tồn tại hoặc ở chế độ private. "
                    "Vui lòng đảm bảo repo là public trước khi nộp.",
                )
            elif res.status_code == 403:
                # GitHub API rate-limited: trả về None để caller xử lý
                return None
    except HTTPException:
        raise
    except Exception:
        pass
    # Không trả về SHA giả — trả về None
    return None


async def submit_final_product(
    db: AsyncSession,
    team_id: str,
    user_id: str,
    data: FinalSubmissionRequest,
) -> FinalSubmission:
    # 1. Verify leader
    membership = (
        await db.execute(
            select(TeamMember).where(
                TeamMember.team_id == team_id,
                TeamMember.user_id == user_id,
                TeamMember.role == "leader",
                TeamMember.status == "accepted",
            )
        )
    ).scalar_one_or_none()
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chỉ nhóm trưởng mới có quyền nộp sản phẩm cuối cùng.",
        )

    # 2. Check contest end deadline
    config = (
        await db.execute(select(HackathonConfig).where(HackathonConfig.id == 1))
    ).scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if config:
        contest_end = (
            config.contest_end
            if config.contest_end.tzinfo
            else config.contest_end.replace(tzinfo=timezone.utc)
        )
        if now > contest_end:
            raise HTTPException(
                status_code=400,
                detail="Đã hết hạn nộp sản phẩm cuối cùng của cuộc thi.",
            )

    # 3. Parse GitHub repo and freeze commit SHA
    github_url_to_use = data.github_url or data.repo_url
    if not github_url_to_use:
        raise HTTPException(status_code=400, detail="Thiếu đường dẫn GitHub repository.")

    owner, repo = parse_github_url(github_url_to_use)
    commit_sha = await fetch_github_head_sha(owner, repo)

    # FIX BUG #3: Không cho phép lưu SHA giả — yêu cầu repo phải accessible
    if commit_sha is None:
        raise HTTPException(
            status_code=503,
            detail=(
                f"Không thể xác minh repository github.com/{owner}/{repo}. "
                "GitHub API có thể đang bị giới hạn (rate limit) hoặc repo là private. "
                "Vui lòng thử lại sau vài phút hoặc đảm bảo repo ở chế độ public."
            ),
        )

    demo_video_url_to_use = data.demo_video_url or data.video_url
    slide_url_to_use = data.slide_url or data.slide_pdf_url

    # 4. Check existing submission
    existing = (
        await db.execute(select(FinalSubmission).where(FinalSubmission.team_id == team_id))
    ).scalar_one_or_none()

    if existing:
        existing.github_url = github_url_to_use
        existing.github_repo_owner = owner
        existing.github_repo_name = repo
        existing.frozen_commit_sha = commit_sha
        existing.latest_commit_sha = commit_sha
        existing.has_post_deadline_changes = False
        existing.demo_video_url = demo_video_url_to_use
        existing.slide_pdf_url = slide_url_to_use
        existing.description = data.description
        existing.updated_at = now
        existing.version += 1
        await db.commit()
        await db.refresh(existing)
        return existing

    sub = FinalSubmission(
        team_id=team_id,
        submitted_by=user_id,
        github_url=github_url_to_use,
        github_repo_owner=owner,
        github_repo_name=repo,
        frozen_commit_sha=commit_sha,
        latest_commit_sha=commit_sha,
        has_post_deadline_changes=False,
        demo_video_url=demo_video_url_to_use,
        slide_pdf_url=slide_url_to_use,
        description=data.description,
        submitted_at=now,
        updated_at=now,
        version=1,
    )
    db.add(sub)
    await db.commit()
    await db.refresh(sub)
    return sub


async def check_for_post_deadline_changes(db: AsyncSession, team_id: str) -> FinalSubmission:
    sub = (
        await db.execute(select(FinalSubmission).where(FinalSubmission.team_id == team_id))
    ).scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="Đội thi chưa nộp sản phẩm cuối.")

    current_sha = await fetch_github_head_sha(sub.github_repo_owner, sub.github_repo_name)
    if current_sha and current_sha != "0000000000000000000000000000000000000000":
        sub.latest_commit_sha = current_sha
        if sub.frozen_commit_sha and current_sha != sub.frozen_commit_sha:
            sub.has_post_deadline_changes = True
        await db.commit()
        await db.refresh(sub)
    return sub
