from typing import Any, Dict, List, Tuple
import hashlib
from fastapi import status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import AppException
from app.models.user import User, UserRole
from app.repositories.evaluation_repo import EvaluationRepository
from app.schemas.evaluation import (
    RubricConfigureRequest,
    RubricCriteriaResponse,
)


def generate_anonymous_team_code(team_id: str) -> str:
    """
    Generate a deterministic one-way anonymous team code:
    Formula: hashlib.sha256(f"{team_id}:{settings.SECRET_KEY}".encode()).hexdigest()[:4].upper()
    Returns: "Team #XXXX" (e.g. "Team #8F9A")
    """
    digest = (
        hashlib.sha256(f"{team_id}:{settings.SECRET_KEY}".encode("utf-8"))
        .hexdigest()[:4]
        .upper()
    )
    return f"Team #{digest}"


def calculate_weighted_score(
    scores_with_criteria: List[Tuple[float, float, float]]
) -> float:
    """
    Calculate normalized weighted score on a 100-point scale:
    S_{j,s} = round(sum((score_i / max_score_i) * weight_i * 100), 2)
    Each tuple in `scores_with_criteria` is (score_i, max_score_i, weight_i).
    """
    total = 0.0
    for score_i, max_score_i, weight_i in scores_with_criteria:
        if max_score_i > 0:
            total += (float(score_i) / float(max_score_i)) * float(weight_i) * 100.0
    return round(total, 2)


class EvaluationService:
    """
    Business logic for Rubric Criteria management and score calculation utilities.
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = EvaluationRepository(db)

    @staticmethod
    def generate_anonymous_team_code(team_id: str) -> str:
        return generate_anonymous_team_code(team_id)

    @staticmethod
    def calculate_weighted_score(
        scores_with_criteria: List[Tuple[float, float, float]]
    ) -> float:
        return calculate_weighted_score(scores_with_criteria)

    async def get_rubrics(self, current_user: User) -> Dict[str, Any]:
        """
        Retrieve active rubric criteria sorted by display_order along with total_weight.
        """
        criteria = await self.repo.list_active_criteria()
        criteria_list = [
            RubricCriteriaResponse.model_validate(c).model_dump() for c in criteria
        ]
        total_weight = round(sum(float(c.weight) for c in criteria), 4)
        rubric_name = (
            criteria[0].rubric_name if criteria else "HackFlow Final Rubric"
        )
        rubric_obj = {
            "id": "rubric-default",
            "name": rubric_name,
            "is_active": True,
            "criteria": criteria_list,
            "total_weight": total_weight,
        }
        return {
            "id": "rubric-default",
            "name": rubric_name,
            "is_active": True,
            "criteria": criteria_list,
            "total_weight": total_weight,
            "rubrics": [rubric_obj],
        }

    async def configure_rubrics(
        self, payload: RubricConfigureRequest, current_user: User
    ) -> Dict[str, Any]:
        """
        Configure the rubric criteria (Admin only).
        Enforces:
        - No submitted evaluations exist yet (409 RUBRIC_LOCKED_BY_EVALUATIONS)
        - max_score > 0 and 0 < weight <= 1.0 (400 CRITERIA_WEIGHT_INVALID)
        - Sum of active criteria weights == 1.00 within 1e-6 (400 CRITERIA_WEIGHT_INVALID)
        """
        if current_user.role != UserRole.ADMIN.value:
            raise AppException(
                status_code=status.HTTP_403_FORBIDDEN,
                message="Only Admin can configure rubric criteria.",
                error_code="FORBIDDEN",
            )

        if await self.repo.has_submitted_evaluations():
            raise AppException(
                status_code=status.HTTP_409_CONFLICT,
                message="Cannot modify rubric criteria because evaluations have already been submitted and locked.",
                error_code="RUBRIC_LOCKED_BY_EVALUATIONS",
            )

        if not payload.criteria:
            raise AppException(
                status_code=status.HTTP_400_BAD_REQUEST,
                message="Rubric must contain at least one criterion.",
                error_code="CRITERIA_WEIGHT_INVALID",
            )

        for item in payload.criteria:
            if item.max_score is None or float(item.max_score) <= 0:
                raise AppException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    message=f"Criterion '{item.title}' must have max_score > 0.",
                    error_code="CRITERIA_WEIGHT_INVALID",
                )
            if item.weight is None or float(item.weight) <= 0 or float(item.weight) > 1.0:
                raise AppException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    message=f"Criterion '{item.title}' must have 0 < weight <= 1.0.",
                    error_code="CRITERIA_WEIGHT_INVALID",
                )

        active_items = [c for c in payload.criteria if c.is_active]
        if not active_items:
            raise AppException(
                status_code=status.HTTP_400_BAD_REQUEST,
                message="Rubric must have at least one active criterion.",
                error_code="CRITERIA_WEIGHT_INVALID",
            )

        total_weight = sum(float(c.weight) for c in active_items)
        if abs(total_weight - 1.0) > 1e-6:
            raise AppException(
                status_code=status.HTTP_400_BAD_REQUEST,
                message="The total rubric weight must equal 1.00",
                error_code="CRITERIA_WEIGHT_INVALID",
            )

        created = await self.repo.replace_criteria(
            rubric_name=payload.name,
            criteria_items=[c.model_dump() for c in payload.criteria],
        )

        await self.repo.create_audit_log(
            user_id=current_user.id,
            action="RUBRIC_CONFIGURED",
            status="success",
            details={
                "rubric_name": payload.name,
                "criteria_count": len(created),
                "total_weight": round(total_weight, 4),
            },
        )
        await self.db.commit()

        criteria_list = [
            RubricCriteriaResponse.model_validate(c).model_dump() for c in created
        ]
        rounded_weight = round(total_weight, 4)
        rubric_obj = {
            "id": "rubric-default",
            "name": payload.name,
            "is_active": True,
            "criteria": criteria_list,
            "total_weight": rounded_weight,
        }
        return {
            "id": "rubric-default",
            "name": payload.name,
            "is_active": True,
            "criteria": criteria_list,
            "total_weight": rounded_weight,
            "rubric": rubric_obj,
        }
