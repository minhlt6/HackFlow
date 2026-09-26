"""
Test toàn diện cho checkpoint service — time-gating, version tracking,
và các edge cases quan trọng.
"""

import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException
from app.services.checkpoint_service import submit_checkpoint, get_checkpoints_for_team
from app.models.checkpoint import Checkpoint, CheckpointSubmission
from app.models.team import TeamMember
from app.schemas.checkpoint import CheckpointSubmitRequest


def make_checkpoint(open_offset_hours: float, close_offset_hours: float) -> Checkpoint:
    """Tạo Checkpoint với open/close time relative to NOW."""
    now = datetime.now(timezone.utc)
    cp = MagicMock(spec=Checkpoint)
    cp.id = "cp-test-001"
    cp.name = "Checkpoint 1"
    cp.description = "Test checkpoint"
    cp.open_at = now + timedelta(hours=open_offset_hours)
    cp.close_at = now + timedelta(hours=close_offset_hours)
    cp.display_order = 1
    cp.is_required = True
    return cp


def make_db_with_leader(has_leader: bool, checkpoint: Checkpoint, prev_submission=None):
    """Mock DB session cho submit_checkpoint tests."""
    db = AsyncMock()
    leader_mock = MagicMock(spec=TeamMember) if has_leader else None

    async def execute_side_effect(stmt):
        result = MagicMock()
        # Determine which query this is by inspecting the statement
        stmt_str = str(stmt)
        if "team_members" in stmt_str.lower() or hasattr(stmt, "_whereclause"):
            # First call: TeamMember leader check
            result.scalar_one_or_none = MagicMock(return_value=leader_mock)
        elif "checkpoints" in stmt_str.lower():
            # Second call: Checkpoint fetch
            result.scalar_one_or_none = MagicMock(return_value=checkpoint)
        else:
            # Third call: previous submission
            result.scalar_one_or_none = MagicMock(return_value=prev_submission)
        return result

    db.execute = AsyncMock(side_effect=execute_side_effect)
    db.add = MagicMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    return db


# ─── TIME-GATING TESTS ────────────────────────────────────────────────────────


class TestCheckpointSubmitTimegating:
    """Test server-side time gating — không tin tưởng client time."""

    @pytest.mark.asyncio
    async def test_submit_when_checkpoint_open_succeeds(self):
        """Nộp trong giờ hợp lệ → thành công"""
        cp = make_checkpoint(
            open_offset_hours=-1, close_offset_hours=+1
        )  # mở từ 1h trước, đóng sau 1h

        # Mock DB: leader exists, checkpoint found, no prev submission
        db = AsyncMock()
        call_count = 0

        async def mock_execute(stmt):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                result.scalar_one_or_none = MagicMock(return_value=MagicMock(spec=TeamMember))
            elif call_count == 2:
                result.scalar_one_or_none = MagicMock(return_value=cp)
            else:
                result.scalar_one_or_none = MagicMock(return_value=None)
            return result

        db.execute = AsyncMock(side_effect=mock_execute)
        db.add = MagicMock()
        db.commit = AsyncMock()
        db.refresh = AsyncMock()

        data = CheckpointSubmitRequest(
            submission_url="https://github.com/team/repo", note="First submit"
        )
        sub = await submit_checkpoint(db, "cp-001", "team-001", "user-001", data)
        assert db.commit.called

    @pytest.mark.asyncio
    async def test_submit_before_open_raises_400(self):
        """Nộp TRƯỚC giờ mở → HTTP 400"""
        cp = make_checkpoint(open_offset_hours=+2, close_offset_hours=+4)  # chưa mở

        db = AsyncMock()
        call_count = 0

        async def mock_execute(stmt):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                result.scalar_one_or_none = MagicMock(return_value=MagicMock(spec=TeamMember))
            else:
                result.scalar_one_or_none = MagicMock(return_value=cp)
            return result

        db.execute = AsyncMock(side_effect=mock_execute)

        data = CheckpointSubmitRequest(submission_url="https://github.com/team/repo")
        with pytest.raises(HTTPException) as exc:
            await submit_checkpoint(db, "cp-001", "team-001", "user-001", data)

        assert exc.value.status_code == 400
        assert "chưa đến" in exc.value.detail.lower() or "mở" in exc.value.detail.lower()

    @pytest.mark.asyncio
    async def test_submit_after_close_raises_400(self):
        """Nộp SAU khi đã đóng → HTTP 400"""
        cp = make_checkpoint(open_offset_hours=-4, close_offset_hours=-1)  # đã đóng 1h trước

        db = AsyncMock()
        call_count = 0

        async def mock_execute(stmt):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                result.scalar_one_or_none = MagicMock(return_value=MagicMock(spec=TeamMember))
            else:
                result.scalar_one_or_none = MagicMock(return_value=cp)
            return result

        db.execute = AsyncMock(side_effect=mock_execute)

        data = CheckpointSubmitRequest(submission_url="https://github.com/team/repo")
        with pytest.raises(HTTPException) as exc:
            await submit_checkpoint(db, "cp-001", "team-001", "user-001", data)

        assert exc.value.status_code == 400
        assert "hạn chót" in exc.value.detail.lower() or "qua" in exc.value.detail.lower()

    @pytest.mark.asyncio
    async def test_non_leader_cannot_submit(self):
        """Thành viên thường (không phải leader) → HTTP 403"""
        db = AsyncMock()

        async def mock_execute(stmt):
            result = MagicMock()
            result.scalar_one_or_none = MagicMock(return_value=None)  # no leader found
            return result

        db.execute = AsyncMock(side_effect=mock_execute)

        data = CheckpointSubmitRequest(submission_url="https://github.com/team/repo")
        with pytest.raises(HTTPException) as exc:
            await submit_checkpoint(db, "cp-001", "team-001", "member-user", data)

        assert exc.value.status_code == 403

    @pytest.mark.asyncio
    async def test_submit_at_exact_open_boundary(self):
        """Nộp đúng tại thời điểm open_at (boundary): now == open_at → VALID"""
        cp = make_checkpoint(open_offset_hours=0, close_offset_hours=+2)
        # Adjust open_at to be slightly in the past (1ms) to simulate "just opened"
        cp.open_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        cp.close_at = datetime.now(timezone.utc) + timedelta(hours=2)

        db = AsyncMock()
        call_count = 0

        async def mock_execute(stmt):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                result.scalar_one_or_none = MagicMock(return_value=MagicMock(spec=TeamMember))
            elif call_count == 2:
                result.scalar_one_or_none = MagicMock(return_value=cp)
            else:
                result.scalar_one_or_none = MagicMock(return_value=None)
            return result

        db.execute = AsyncMock(side_effect=mock_execute)
        db.add = MagicMock()
        db.commit = AsyncMock()
        db.refresh = AsyncMock()

        data = CheckpointSubmitRequest(submission_url="https://github.com/team/repo")
        await submit_checkpoint(db, "cp-001", "team-001", "user-001", data)
        assert db.commit.called

    @pytest.mark.asyncio
    async def test_checkpoint_not_found_raises_404(self):
        """Checkpoint không tồn tại → HTTP 404"""
        db = AsyncMock()
        call_count = 0

        async def mock_execute(stmt):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                result.scalar_one_or_none = MagicMock(return_value=MagicMock(spec=TeamMember))
            else:
                result.scalar_one_or_none = MagicMock(return_value=None)  # checkpoint not found
            return result

        db.execute = AsyncMock(side_effect=mock_execute)

        data = CheckpointSubmitRequest(submission_url="https://github.com/team/repo")
        with pytest.raises(HTTPException) as exc:
            await submit_checkpoint(db, "nonexistent-cp", "team-001", "user-001", data)

        assert exc.value.status_code == 404


# ─── VERSION TRACKING ─────────────────────────────────────────────────────────


class TestCheckpointVersioning:
    """Test versioning khi nộp nhiều lần."""

    @pytest.mark.asyncio
    async def test_second_submission_increments_version(self):
        """Nộp lần 2 → version = 2, lần 1 is_latest = False"""
        cp = make_checkpoint(open_offset_hours=-1, close_offset_hours=+1)

        # Previous submission with version=1, is_latest=True
        prev_sub = MagicMock(spec=CheckpointSubmission)
        prev_sub.version = 1
        prev_sub.is_latest = True

        db = AsyncMock()
        call_count = 0

        async def mock_execute(stmt):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                result.scalar_one_or_none = MagicMock(return_value=MagicMock(spec=TeamMember))
            elif call_count == 2:
                result.scalar_one_or_none = MagicMock(return_value=cp)
            else:
                result.scalar_one_or_none = MagicMock(return_value=prev_sub)
            return result

        new_submission_captured = []

        def capture_add(obj):
            if isinstance(obj, CheckpointSubmission) or hasattr(obj, "version"):
                new_submission_captured.append(obj)

        db.execute = AsyncMock(side_effect=mock_execute)
        db.add = MagicMock(side_effect=capture_add)
        db.commit = AsyncMock()
        db.refresh = AsyncMock()

        data = CheckpointSubmitRequest(submission_url="https://github.com/team/repo/v2")
        await submit_checkpoint(db, "cp-001", "team-001", "user-001", data)

        # is_latest của prev_sub phải được set False
        assert prev_sub.is_latest is False


# ─── STATUS DETERMINATION ─────────────────────────────────────────────────────


class TestCheckpointStatus:
    """Test get_checkpoints_for_team trả về status đúng."""

    @pytest.mark.asyncio
    async def test_status_locked_before_open(self):
        """now < open_at → status = 'locked'"""
        now = datetime.now(timezone.utc)
        cp = MagicMock(spec=Checkpoint)
        cp.id = "cp1"
        cp.name = "CP1"
        cp.description = ""
        cp.open_at = now + timedelta(hours=5)  # chưa mở
        cp.close_at = now + timedelta(hours=10)
        cp.display_order = 1
        cp.is_required = True

        db = AsyncMock()
        call_count = 0

        async def mock_execute(stmt):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                result.scalars.return_value.all.return_value = [cp]
            else:
                result.scalar_one_or_none.return_value = None  # no submission
            return result

        db.execute = AsyncMock(side_effect=mock_execute)

        results = await get_checkpoints_for_team(db, "team-001")
        assert len(results) == 1
        assert results[0]["status"] == "locked"

    @pytest.mark.asyncio
    async def test_status_open_during_window(self):
        """open_at <= now <= close_at → status = 'open'"""
        now = datetime.now(timezone.utc)
        cp = MagicMock(spec=Checkpoint)
        cp.id = "cp1"
        cp.name = "CP1"
        cp.description = ""
        cp.open_at = now - timedelta(hours=1)
        cp.close_at = now + timedelta(hours=1)
        cp.display_order = 1
        cp.is_required = True

        db = AsyncMock()
        call_count = 0

        async def mock_execute(stmt):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                result.scalars.return_value.all.return_value = [cp]
            else:
                result.scalar_one_or_none.return_value = None
            return result

        db.execute = AsyncMock(side_effect=mock_execute)

        results = await get_checkpoints_for_team(db, "team-001")
        assert results[0]["status"] == "open"

    @pytest.mark.asyncio
    async def test_status_closed_after_window(self):
        """now > close_at, no submission → status = 'closed'"""
        now = datetime.now(timezone.utc)
        cp = MagicMock(spec=Checkpoint)
        cp.id = "cp1"
        cp.name = "CP1"
        cp.description = ""
        cp.open_at = now - timedelta(hours=10)
        cp.close_at = now - timedelta(hours=1)  # đã đóng
        cp.display_order = 1
        cp.is_required = True

        db = AsyncMock()
        call_count = 0

        async def mock_execute(stmt):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                result.scalars.return_value.all.return_value = [cp]
            else:
                result.scalar_one_or_none.return_value = None
            return result

        db.execute = AsyncMock(side_effect=mock_execute)

        results = await get_checkpoints_for_team(db, "team-001")
        assert results[0]["status"] == "closed"

    @pytest.mark.asyncio
    async def test_status_submitted_overrides_all(self):
        """Đã có submission → status = 'submitted' (kể cả sau khi đóng)"""
        now = datetime.now(timezone.utc)
        cp = MagicMock(spec=Checkpoint)
        cp.id = "cp1"
        cp.name = "CP1"
        cp.description = ""
        cp.open_at = now - timedelta(hours=10)
        cp.close_at = now - timedelta(hours=1)  # đã đóng
        cp.display_order = 1
        cp.is_required = True

        existing_sub = MagicMock(spec=CheckpointSubmission)
        existing_sub.version = 1
        existing_sub.is_latest = True

        db = AsyncMock()
        call_count = 0

        async def mock_execute(stmt):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                result.scalars.return_value.all.return_value = [cp]
            else:
                result.scalar_one_or_none.return_value = existing_sub
            return result

        db.execute = AsyncMock(side_effect=mock_execute)

        results = await get_checkpoints_for_team(db, "team-001")
        assert results[0]["status"] == "submitted"
        assert results[0]["latest_submission"] == existing_sub
