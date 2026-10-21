from datetime import datetime, timezone
import pytest
from httpx import AsyncClient

from app.core.exceptions import UnprocessableEntityException
from app.core.security import create_access_token
from app.models.checkpoint import Checkpoint, SubmissionStatus
from app.models.user import ApprovalStatus, User, UserRole
from app.services.github_service import GitHubService, github_service
from tests.conftest import TestSessionLocal


# ─── 1. Unit Tests for URL Parsing & Security ────────────────────────────────


def test_parse_github_url_success():
    """
    Test parsing valid GitHub URLs in various common formats (HTTPS, HTTP, shorthand, SSH, tree path).
    """
    valid_cases = [
        ("https://github.com/torvalds/linux", ("torvalds", "linux")),
        ("https://github.com/facebook/react.git", ("facebook", "react")),
        ("http://github.com/vuejs/core/", ("vuejs", "core")),
        ("github.com/pallets/flask", ("pallets", "flask")),
        ("https://www.github.com/fastapi/fastapi", ("fastapi", "fastapi")),
        ("https://github.com/octocat/Hello-World.git/", ("octocat", "Hello-World")),
        ("https://github.com/my-org/my.repo.name", ("my-org", "my.repo.name")),
        ("git@github.com:vercel/next.js.git", ("vercel", "next.js")),
        ("https://github.com/owner/repo/tree/develop", ("owner", "repo")),
    ]
    for url, expected in valid_cases:
        assert GitHubService.parse_github_repo_url(url) == expected

    # Branch extraction from /tree/{branch} URL
    assert (
        GitHubService.extract_branch_from_url(
            "https://github.com/owner/repo/tree/feature-auth"
        )
        == "feature-auth"
    )
    assert GitHubService.extract_branch_from_url("https://github.com/owner/repo") is None


def test_parse_github_url_invalid_and_path_traversal():
    """
    Test invalid URLs and SSRF/path traversal attempts raise UnprocessableEntityException (INVALID_GITHUB_URL).
    """
    invalid_cases = [
        "",
        "   ",
        "https://gitlab.com/owner/repo",
        "https://bitbucket.org/owner/repo",
        "not_a_url",
        "https://github.com/",
        "https://github.com/justowner",
        "https://github.com/../..",
        "https://github.com/./repo",
        "https://github.com/owner/..",
        "https://github.com/-invalid-owner/repo",
    ]
    for url in invalid_cases:
        with pytest.raises(UnprocessableEntityException) as exc_info:
            GitHubService.parse_github_repo_url(url)
        assert exc_info.value.error_code == "INVALID_GITHUB_URL"


# ─── 2. Unit Tests for Local URL Verification (No GitHub API Call) ──────────


@pytest.mark.asyncio
async def test_fetch_head_commit_local_url_validation():
    """
    Test that fetch_head_commit validates the GitHub URL locally without calling external GitHub API
    and returns commit_sha=None.
    """
    result = await github_service.fetch_head_commit(
        repo_url="https://github.com/hackflow/core.git",
    )

    assert result.is_verified is True
    assert result.is_fallback is False
    assert result.status == SubmissionStatus.SUBMITTED.value
    assert result.error_code is None
    assert result.retry_attempts == 0
    assert result.commit_sha is None
    assert result.owner == "hackflow"
    assert result.repo == "core"
    assert result.repo_url == "https://github.com/hackflow/core"


# ─── 3. Unit Tests for Checkpoint Field & URL Validation ────────────────────


@pytest.mark.asyncio
async def test_process_checkpoint_intermediate_and_dynamic_fields():
    """
    Checkpoint trung gian (is_final_checkpoint == False):
    - Validates dynamic required fields (e.g. slide_url required=True -> 422 MISSING_REQUIRED_FIELD if missing).
    - When valid, returns status='submitted' and commit_sha=None.
    """
    now = datetime.now(timezone.utc)

    intermediate_cp = Checkpoint(
        title="Checkpoint 1 - SRS & Mockup",
        start_time=now,
        deadline=now,
        is_final_checkpoint=False,
        submission_fields=[
            {
                "field_key": "slide_url",
                "field_label": "Link Slide thuyết trình",
                "required": True,
                "apply_sha_freeze": False,
            }
        ],
    )

    # 1. Missing required slide_url -> Must raise 422 MISSING_REQUIRED_FIELD
    with pytest.raises(UnprocessableEntityException) as exc_info:
        await github_service.process_checkpoint_sha_freeze(
            checkpoint=intermediate_cp,
            submission_data={"repo_url": "https://github.com/test/repo"},
        )
    assert exc_info.value.error_code == "MISSING_REQUIRED_FIELD"
    assert "slide_url" in str(exc_info.value.data)

    # 2. Providing required slide_url -> Succeeds with commit_sha=None
    res = await github_service.process_checkpoint_sha_freeze(
        checkpoint=intermediate_cp,
        submission_data={"slide_url": "https://docs.google.com/presentation/d/123"},
    )

    assert res.freeze_required is False
    assert res.should_freeze is False
    assert res.commit_sha is None
    assert res.status == SubmissionStatus.SUBMITTED.value


@pytest.mark.asyncio
async def test_process_checkpoint_final_success_without_sha_freeze():
    """
    Checkpoint chốt sản phẩm (is_final_checkpoint == True):
    Validates GitHub repo URL format locally, normalizes URL, and does NOT freeze commit_sha.
    """
    now = datetime.now(timezone.utc)
    final_cp = Checkpoint(
        title="Final Milestone - Product Code",
        start_time=now,
        deadline=now,
        is_final_checkpoint=True,
        submission_fields=[
            {
                "field_key": "github_repo",
                "field_label": "Repository Code",
                "required": True,
                "apply_sha_freeze": True,
            }
        ],
    )

    res = await github_service.process_checkpoint_sha_freeze(
        checkpoint=final_cp,
        submission_data={"github_repo": "https://github.com/champion/project.git"},
    )

    assert res.freeze_required is False
    assert res.should_freeze is False
    assert res.commit_sha is None
    assert res.repo_url == "https://github.com/champion/project"
    assert res.status == SubmissionStatus.SUBMITTED.value
    assert res.is_fallback is False


@pytest.mark.asyncio
async def test_process_checkpoint_final_missing_required_field():
    """
    Checkpoint chốt sản phẩm: Thiếu trường repo_url bắt buộc -> Ném 422 MISSING_REQUIRED_FIELD.
    """
    now = datetime.now(timezone.utc)
    final_cp = Checkpoint(
        title="Final Milestone",
        start_time=now,
        deadline=now,
        is_final_checkpoint=True,
        submission_fields=[
            {
                "field_key": "repo_url",
                "field_label": "Source Code Repo",
                "required": True,
                "apply_sha_freeze": True,
            }
        ],
    )

    with pytest.raises(UnprocessableEntityException) as exc_info:
        await github_service.process_checkpoint_sha_freeze(
            checkpoint=final_cp,
            submission_data={"presentation_pdf": "https://example.com/slide.pdf"},
        )

    assert exc_info.value.error_code == "MISSING_REQUIRED_FIELD"
    assert "Source Code Repo" in exc_info.value.message


# ─── 4. Integration Test for API POST /checkpoints/verify-github-repo ───────


@pytest.mark.asyncio
async def test_api_verify_github_repo_success(client: AsyncClient):
    """
    Test API endpoint POST /api/v1/checkpoints/verify-github-repo validates URL format without SHA.
    """
    async with TestSessionLocal() as session:
        user = User(
            email="test_gh_verify@hackflow.dev",
            full_name="GitHub Tester",
            role=UserRole.CANDIDATE.value,
            approval_status=ApprovalStatus.APPROVED.value,
            is_active=True,
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        token = create_access_token(subject=str(user.id), claims={"role": user.role})

    res = await client.post(
        "/api/v1/checkpoints/verify-github-repo",
        headers={"Authorization": f"Bearer {token}"},
        json={"repo_url": "https://github.com/hackflow/api.git"},
    )

    assert res.status_code == 200
    res_json = res.json()
    assert res_json["success"] is True
    data = res_json["data"]
    assert data["commit_sha"] is None
    assert data["is_verified"] is True
    assert data["status"] == "submitted"
    assert data["owner"] == "hackflow"
    assert data["repo"] == "api"
    assert data["repo_url"] == "https://github.com/hackflow/api"


@pytest.mark.asyncio
async def test_api_verify_github_repo_invalid_url(client: AsyncClient):
    """
    Test API endpoint rejects invalid git URL with HTTP 422 INVALID_GITHUB_URL.
    """
    async with TestSessionLocal() as session:
        user = User(
            email="test_gh_invalid@hackflow.dev",
            full_name="GitHub Tester 2",
            role=UserRole.CANDIDATE.value,
            approval_status=ApprovalStatus.APPROVED.value,
            is_active=True,
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        token = create_access_token(subject=str(user.id), claims={"role": user.role})

    res = await client.post(
        "/api/v1/checkpoints/verify-github-repo",
        headers={"Authorization": f"Bearer {token}"},
        json={"repo_url": "https://invalid-host.com/user/project"},
    )
    assert res.status_code == 422
    assert res.json()["error_code"] == "INVALID_GITHUB_URL"
