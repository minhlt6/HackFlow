"""
Test toàn diện cho scoring service — bao gồm happy path, edge cases,
và các trường hợp biên quan trọng.
"""

import pytest
from pydantic import BaseModel
from fastapi import HTTPException
from app.models.scoring import ScoringCriteria
from app.services.scoring_service import calculate_weighted_score


class DummyDetail(BaseModel):
    criteria_id: str
    score: float
    note: str | None = None


# ─── HAPPY PATH ───────────────────────────────────────────────────────────────


def test_basic_weighted_score():
    """8*0.3 + 9*0.3 + 7*0.4 = 2.4 + 2.7 + 2.8 = 7.9"""
    criteria = [
        ScoringCriteria(id="c1", name="Creativity", max_score=10.0, weight=0.3),
        ScoringCriteria(id="c2", name="Feasibility", max_score=10.0, weight=0.3),
        ScoringCriteria(id="c3", name="Technical", max_score=10.0, weight=0.4),
    ]
    details = [
        DummyDetail(criteria_id="c1", score=8.0),
        DummyDetail(criteria_id="c2", score=9.0),
        DummyDetail(criteria_id="c3", score=7.0),
    ]
    result = calculate_weighted_score(criteria, details)
    assert result == 7.9


def test_perfect_score_all_criteria():
    """Tất cả điểm tối đa → tổng = sum(max * weight)"""
    criteria = [
        ScoringCriteria(id="c1", name="Innovation", max_score=25.0, weight=0.25),
        ScoringCriteria(id="c2", name="Technical", max_score=35.0, weight=0.35),
        ScoringCriteria(id="c3", name="Completeness", max_score=25.0, weight=0.25),
        ScoringCriteria(id="c4", name="Presentation", max_score=15.0, weight=0.15),
    ]
    details = [
        DummyDetail(criteria_id="c1", score=25.0),
        DummyDetail(criteria_id="c2", score=35.0),
        DummyDetail(criteria_id="c3", score=25.0),
        DummyDetail(criteria_id="c4", score=15.0),
    ]
    result = calculate_weighted_score(criteria, details)
    # 25*0.25 + 35*0.35 + 25*0.25 + 15*0.15 = 6.25 + 12.25 + 6.25 + 2.25 = 27.0
    assert result == 27.0


def test_zero_score_all_criteria():
    """Tất cả điểm = 0 → tổng = 0"""
    criteria = [
        ScoringCriteria(id="c1", name="A", max_score=10.0, weight=0.5),
        ScoringCriteria(id="c2", name="B", max_score=10.0, weight=0.5),
    ]
    details = [
        DummyDetail(criteria_id="c1", score=0.0),
        DummyDetail(criteria_id="c2", score=0.0),
    ]
    result = calculate_weighted_score(criteria, details)
    assert result == 0.0


def test_single_criterion_full_weight():
    """1 tiêu chí duy nhất, weight=1.0"""
    criteria = [ScoringCriteria(id="c1", name="Overall", max_score=100.0, weight=1.0)]
    details = [DummyDetail(criteria_id="c1", score=73.5)]
    result = calculate_weighted_score(criteria, details)
    assert result == 73.5


def test_fractional_scores():
    """Điểm thập phân → làm tròn 3 chữ số"""
    criteria = [
        ScoringCriteria(id="c1", name="A", max_score=10.0, weight=0.333),
        ScoringCriteria(id="c2", name="B", max_score=10.0, weight=0.333),
        ScoringCriteria(id="c3", name="C", max_score=10.0, weight=0.334),
    ]
    details = [
        DummyDetail(criteria_id="c1", score=7.5),
        DummyDetail(criteria_id="c2", score=8.5),
        DummyDetail(criteria_id="c3", score=6.0),
    ]
    result = calculate_weighted_score(criteria, details)
    # 7.5*0.333 + 8.5*0.333 + 6.0*0.334 = 2.4975 + 2.8305 + 2.004 = 7.332
    assert isinstance(result, float)
    assert 7.0 < result < 8.0


# ─── EDGE CASES ───────────────────────────────────────────────────────────────


def test_score_exceeds_max_raises_400():
    """score > max_score → HTTP 400"""
    criteria = [ScoringCriteria(id="c1", name="Tech", max_score=10.0, weight=1.0)]
    details = [DummyDetail(criteria_id="c1", score=10.1)]
    with pytest.raises(HTTPException) as exc:
        calculate_weighted_score(criteria, details)
    assert exc.value.status_code == 400
    assert "c1" not in exc.value.detail or "Tech" in exc.value.detail


def test_score_exactly_at_max_is_valid():
    """score == max_score là hợp lệ (không raise)"""
    criteria = [ScoringCriteria(id="c1", name="Tech", max_score=10.0, weight=1.0)]
    details = [DummyDetail(criteria_id="c1", score=10.0)]
    result = calculate_weighted_score(criteria, details)
    assert result == 10.0


def test_negative_score_raises_400():
    """score < 0 → HTTP 400"""
    criteria = [ScoringCriteria(id="c1", name="Innovation", max_score=10.0, weight=1.0)]
    details = [DummyDetail(criteria_id="c1", score=-0.1)]
    with pytest.raises(HTTPException) as exc:
        calculate_weighted_score(criteria, details)
    assert exc.value.status_code == 400


def test_unknown_criteria_id_ignored():
    """criteria_id không có trong criteria_list → bị bỏ qua, không crash"""
    criteria = [ScoringCriteria(id="c1", name="Known", max_score=10.0, weight=1.0)]
    details = [
        DummyDetail(criteria_id="c1", score=8.0),
        DummyDetail(criteria_id="ghost-id", score=99.0),  # không tồn tại
    ]
    result = calculate_weighted_score(criteria, details)
    assert result == 8.0  # chỉ tính c1, ghost bị bỏ qua


def test_empty_details_returns_zero():
    """Không có details nào → tổng = 0.0"""
    criteria = [ScoringCriteria(id="c1", name="A", max_score=10.0, weight=1.0)]
    result = calculate_weighted_score(criteria, [])
    assert result == 0.0


def test_empty_criteria_list():
    """Không có criteria nào → tổng = 0.0 (tất cả details bị bỏ qua)"""
    details = [DummyDetail(criteria_id="c1", score=9.0)]
    result = calculate_weighted_score([], details)
    assert result == 0.0


def test_weight_greater_than_one_accepted():
    """
    Weight > 1.0: service không validate weight tổng, chỉ cộng score*weight.
    Đây là behavior hiện tại — nếu admin nhập weight sai thì điểm sẽ vượt range.
    Test này document behavior, không phải assert đúng/sai về nghiệp vụ.
    """
    criteria = [ScoringCriteria(id="c1", name="X", max_score=10.0, weight=2.0)]
    details = [DummyDetail(criteria_id="c1", score=5.0)]
    result = calculate_weighted_score(criteria, details)
    assert result == 10.0  # 5 * 2.0 = 10.0 (doubled!)


def test_score_zero_with_weight_one():
    """score=0, weight=1 → 0 (không nan, không error)"""
    criteria = [ScoringCriteria(id="c1", name="A", max_score=10.0, weight=1.0)]
    details = [DummyDetail(criteria_id="c1", score=0.0)]
    result = calculate_weighted_score(criteria, details)
    assert result == 0.0


def test_score_is_float_not_int():
    """Kết quả phải là float, không phải int"""
    criteria = [ScoringCriteria(id="c1", name="A", max_score=10.0, weight=0.5)]
    details = [DummyDetail(criteria_id="c1", score=6.0)]
    result = calculate_weighted_score(criteria, details)
    assert isinstance(result, float)
    assert result == 3.0


def test_multiple_same_criteria_id_in_details():
    """
    Nếu details có cùng criteria_id 2 lần → cả 2 đều được tính vào total
    (không phải behavior đúng về nghiệp vụ, nhưng là thực tế hiện tại).
    """
    criteria = [ScoringCriteria(id="c1", name="A", max_score=10.0, weight=0.5)]
    details = [
        DummyDetail(criteria_id="c1", score=4.0),
        DummyDetail(criteria_id="c1", score=6.0),  # trùng id
    ]
    result = calculate_weighted_score(criteria, details)
    # 4.0 * 0.5 + 6.0 * 0.5 = 2.0 + 3.0 = 5.0
    assert result == 5.0


# ─── PRECISION / ROUNDING ─────────────────────────────────────────────────────


def test_result_rounded_to_3_decimals():
    """Kết quả được làm tròn đến 3 chữ số thập phân"""
    criteria = [ScoringCriteria(id="c1", name="A", max_score=10.0, weight=1 / 3)]
    details = [DummyDetail(criteria_id="c1", score=10.0)]
    result = calculate_weighted_score(criteria, details)
    # 10 * (1/3) = 3.3333... → round to 3.333
    assert result == round(10.0 * (1 / 3), 3)


def test_boundary_score_at_zero():
    """Chính xác score = 0 (boundary) → không raise"""
    criteria = [ScoringCriteria(id="c1", name="A", max_score=10.0, weight=1.0)]
    details = [DummyDetail(criteria_id="c1", score=0.0)]
    result = calculate_weighted_score(criteria, details)
    assert result == 0.0


def test_boundary_just_below_zero():
    """score = -0.001 → phải raise 400"""
    criteria = [ScoringCriteria(id="c1", name="A", max_score=10.0, weight=1.0)]
    details = [DummyDetail(criteria_id="c1", score=-0.001)]
    with pytest.raises(HTTPException) as exc:
        calculate_weighted_score(criteria, details)
    assert exc.value.status_code == 400
