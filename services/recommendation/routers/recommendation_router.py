"""Recommendation Router — budget recommendations endpoint."""

import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Header, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from engine import RecommendationEngine

logger = logging.getLogger(__name__)
router = APIRouter()
engine = RecommendationEngine()


async def get_db():
    raise NotImplementedError("get_db must be overridden at app startup")


@router.get("/budget")
async def get_budget_recommendations(
    month: str = Query(None, description="YYYY-MM format, defaults to current month"),
    x_user_id: str = Header(None, alias="X-User-ID"),
    db: AsyncSession = Depends(get_db),
):
    """Get personalized budget recommendations for the given month."""
    if not x_user_id:
        raise HTTPException(status_code=401, detail="User ID not provided")

    if not month:
        month = datetime.utcnow().strftime("%Y-%m")

    # Determine how many months of history exist
    result = await db.execute(
        text(
            "SELECT COUNT(DISTINCT DATE_TRUNC('month', ts)) as months "
            "FROM transactions WHERE user_id = :uid"
        ),
        {"uid": x_user_id},
    )
    months_of_history = result.scalar() or 0

    # Load spending history by category per month
    result = await db.execute(
        text(
            "SELECT tc.category_id, c.name as category_name, "
            "DATE_TRUNC('month', t.ts) as month, SUM(t.amount) as total "
            "FROM transactions t "
            "JOIN transaction_categories tc ON t.id = tc.transaction_id "
            "JOIN categories c ON tc.category_id = c.id "
            "WHERE t.user_id = :uid "
            "GROUP BY tc.category_id, c.name, DATE_TRUNC('month', t.ts) "
            "ORDER BY month DESC"
        ),
        {"uid": x_user_id},
    )
    spending_history = [
        {
            "category_id": row.category_id,
            "category_name": row.category_name,
            "month": str(row.month),
            "total": float(row.total),
        }
        for row in result.fetchall()
    ]

    # Select strategy and compute
    strategy = engine.get_strategy(months_of_history)
    recommendations = await strategy.compute_budget(x_user_id, month, spending_history)

    return {
        "month": month,
        "strategy_used": "statistical_p25" if months_of_history >= 6 else "50/30/20",
        "months_of_history": months_of_history,
        "recommendations": recommendations,
    }


@router.post("/budget/{category_id}/override")
async def override_budget(
    category_id: int,
    limit_amount: float = Query(...),
    month: str = Query(None),
    x_user_id: str = Header(None, alias="X-User-ID"),
    db: AsyncSession = Depends(get_db),
):
    """Allow user to override the recommended budget limit for a category."""
    if not x_user_id:
        raise HTTPException(status_code=401, detail="User ID not provided")

    if not month:
        month = datetime.utcnow().strftime("%Y-%m-01")

    await db.execute(
        text(
            "INSERT INTO budgets (user_id, category_id, month, recommended_amount, limit_amount) "
            "VALUES (:uid, :cid, :month, :limit, :limit) "
            "ON CONFLICT (user_id, category_id, month) "
            "DO UPDATE SET limit_amount = :limit"
        ),
        {"uid": x_user_id, "cid": category_id, "month": month, "limit": limit_amount},
    )
    await db.commit()
    return {"status": "ok", "category_id": category_id, "limit_amount": limit_amount}
