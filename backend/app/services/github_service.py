import logging
import re
from typing import Any, Dict, Optional, Tuple
import httpx

from app.core.exceptions import UnprocessableEntityException
from app.models.checkpoint import Checkpoint, SubmissionStatus
from app.schemas.github import GitHubFreezeResult, VerifyGitHubRepoResponse

logger = logging.getLogger("hackflow.github_service")


class GitHubService:
    """
    Service layer providing validation for GitHub repository URLs and dynamic checkpoint submission fields:
    1. Parsing and validating candidate GitHub repository URLs (HTTPS, SSH, shorthand, /tree/branch).
    2. Dynamic submission_fields validation for checkpoints (Commit SHA freezing mechanism removed).
    """

    @staticmethod
    def parse_github_repo_url(repo_url: str) -> Tuple[str, str]:
        """
        Parses and validates a GitHub repository URL, returning (owner, repo).
        Supported formats:
        - https://github.com/owner/repo
        - https://github.com/owner/repo.git
        - http://github.com/owner/repo/
        - github.com/owner/repo
        - git@github.com:owner/repo.git
        - https://github.com/owner/repo/tree/main (tree path stripped)
        """
        if not repo_url or not isinstance(repo_url, str):
            raise UnprocessableEntityException(
                message="Đường dẫn GitHub repository không được để trống.",
                error_code="INVALID_GITHUB_URL",
            )

        cleaned = repo_url.strip()
        if not cleaned:
            raise UnprocessableEntityException(
                message="Đường dẫn GitHub repository không được để trống.",
                error_code="INVALID_GITHUB_URL",
            )

        # Support both HTTPS/shorthand and SSH git@github.com:owner/repo.git
        https_pattern = r"^(?:https?://)?(?:www\.)?github\.com/([a-zA-Z0-9_\-\.]+)/([a-zA-Z0-9_\-\.]+)"
        ssh_pattern = r"^git@github\.com:([a-zA-Z0-9_\-\.]+)/([a-zA-Z0-9_\-\.]+)"

        match = re.match(https_pattern, cleaned) or re.match(ssh_pattern, cleaned)
        if not match:
            raise UnprocessableEntityException(
                message="Đường dẫn GitHub repository không hợp lệ. Định dạng chuẩn: https://github.com/{owner}/{repo}",
                error_code="INVALID_GITHUB_URL",
            )

        owner, repo = match.group(1), match.group(2)
        if repo.endswith(".git"):
            repo = repo[:-4]

        repo = repo.strip("/")

        # Prevent path traversal ('.' or '..') and invalid GitHub owner/repo names
        if (
            not owner
            or not repo
            or owner in (".", "..")
            or repo in (".", "..")
            or owner.startswith("-")
            or owner.startswith(".")
            or repo.startswith(".")
        ):
            raise UnprocessableEntityException(
                message="Đường dẫn GitHub repository không hợp lệ: Tên owner hoặc repository không đúng quy chuẩn GitHub.",
                error_code="INVALID_GITHUB_URL",
            )

        return owner, repo

    @staticmethod
    def extract_branch_from_url(repo_url: str) -> Optional[str]:
        """
        Extracts branch name if the candidate pasted a URL containing '/tree/{branch}'.
        """
        if not repo_url or not isinstance(repo_url, str):
            return None
        match = re.match(
            r"^(?:https?://)?(?:www\.)?github\.com/[a-zA-Z0-9_\-\.]+/[a-zA-Z0-9_\-\.]+/tree/([^/?#]+)",
            repo_url.strip(),
        )
        return match.group(1) if match else None

    async def fetch_head_commit(
        self,
        repo_url: str,
        branch: Optional[str] = None,
        max_retries: int = 3,
        retry_delay: float = 1.0,
        client: Optional[httpx.AsyncClient] = None,
    ) -> VerifyGitHubRepoResponse:
        """
        Validates the GitHub repository URL format locally without calling the external GitHub API
        (Commit SHA mechanism removed).
        """
        owner, repo = self.parse_github_repo_url(repo_url)
        effective_branch = branch or self.extract_branch_from_url(repo_url)
        normalized_url = f"https://github.com/{owner}/{repo}"

        return VerifyGitHubRepoResponse(
            repo_url=normalized_url,
            owner=owner,
            repo=repo,
            branch=effective_branch,
            commit_sha=None,
            commit_message=None,
            author=None,
            committed_at=None,
            html_url=normalized_url,
            status=SubmissionStatus.SUBMITTED.value,
            error_code=None,
            retry_attempts=0,
            is_verified=True,
            is_fallback=False,
            message=f"Đường dẫn GitHub repository hợp lệ: {normalized_url}.",
        )

    @staticmethod
    def validate_submission_fields(
        checkpoint: Checkpoint,
        submission_data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Validates dynamic submission_data against checkpoint.submission_fields.
        Raises 422 MISSING_REQUIRED_FIELD if any field configured with required=True is missing or blank.
        """
        data = submission_data or {}

        if checkpoint.submission_fields and isinstance(checkpoint.submission_fields, list):
            for field in checkpoint.submission_fields:
                if not isinstance(field, dict):
                    continue
                field_key = field.get("field_key")
                if not field_key:
                    continue
                field_label = field.get("field_label", field_key)
                is_required = field.get("required", True)
                if checkpoint.is_final_checkpoint and (
                    field_key == "repo_url" or field.get("apply_sha_freeze")
                ):
                    is_required = True

                val = data.get(field_key)
                is_empty = val is None or (isinstance(val, str) and not val.strip())
                if is_required and is_empty:
                    raise UnprocessableEntityException(
                        message=f"Thiếu trường nộp bài bắt buộc: '{field_label}' ({field_key}).",
                        error_code="MISSING_REQUIRED_FIELD",
                        data={"missing_field": field_key},
                    )

        return data

    async def process_checkpoint_sha_freeze(
        self,
        checkpoint: Checkpoint,
        submission_data: Optional[Dict[str, Any]] = None,
        client: Optional[httpx.AsyncClient] = None,
    ) -> GitHubFreezeResult:
        """
        Validates dynamic submission fields and GitHub repository URL format locally without calling GitHub API
        (Commit SHA mechanism removed).
        """
        data = self.validate_submission_fields(checkpoint, submission_data)

        if not checkpoint.is_final_checkpoint:
            raw_repo = data.get("repo_url")
            normalized_repo = None
            if isinstance(raw_repo, str) and raw_repo.strip():
                owner, repo = self.parse_github_repo_url(raw_repo.strip())
                normalized_repo = f"https://github.com/{owner}/{repo}"
            return GitHubFreezeResult(
                freeze_required=False,
                should_freeze=False,
                commit_sha=None,
                repo_url=normalized_repo,
                status=SubmissionStatus.SUBMITTED.value,
                error_code=None,
                retry_attempts=0,
            )

        target_field_key = "repo_url"
        target_field_label = "GitHub Repository URL"
        is_required = True

        if checkpoint.submission_fields and isinstance(checkpoint.submission_fields, list):
            for field in checkpoint.submission_fields:
                if isinstance(field, dict) and (
                    field.get("field_key") == "repo_url" or field.get("apply_sha_freeze")
                ):
                    target_field_key = field.get("field_key", "repo_url")
                    target_field_label = field.get("field_label", target_field_key)
                    is_required = field.get("required", True)
                    break

        repo_url = data.get(target_field_key)
        if isinstance(repo_url, str):
            repo_url = repo_url.strip()

        if not repo_url:
            if is_required:
                raise UnprocessableEntityException(
                    message=f"Thiếu trường nộp bài bắt buộc: '{target_field_label}' ({target_field_key}).",
                    error_code="MISSING_REQUIRED_FIELD",
                    data={"missing_field": target_field_key},
                )
            return GitHubFreezeResult(
                freeze_required=False,
                should_freeze=False,
                commit_sha=None,
                repo_url=None,
                status=SubmissionStatus.SUBMITTED.value,
                error_code=None,
                retry_attempts=0,
            )

        owner, repo = self.parse_github_repo_url(str(repo_url))
        normalized_url = f"https://github.com/{owner}/{repo}"

        return GitHubFreezeResult(
            freeze_required=False,
            should_freeze=False,
            commit_sha=None,
            repo_url=normalized_url,
            status=SubmissionStatus.SUBMITTED.value,
            error_code=None,
            retry_attempts=0,
            is_fallback=False,
        )


github_service = GitHubService()
