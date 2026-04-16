"""Analytics Router — dashboard overview, FHS history, category distribution, trends."""

import json
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Header, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
import redis.asyncio as aioredis

from service import AnalyticsService
from categorization.service import CategorizationService
from cache import CacheInvalidator
from clickhouse_writer import ClickHouseWriter

logger = logging.getLogger(__name__)
router = APIRouter()


async def get_db():
    raise NotImplementedError("get_db must be overridden at app startup")


async def get_redis():
    raise NotImplementedError("get_redis must be overridden at app startup")


async def get_analytics_service(
    db: AsyncSession = Depends(get_db),
    redis_client: aioredis.Redis = Depends(get_redis),
) -> AnalyticsService:
    import os
    categorizer = CategorizationService(redis_client)
    cache_invalidator = CacheInvalidator(redis_client)
    ch_writer = None
    ch_url = os.getenv("CLICKHOUSE_URL")
    ch_db = os.getenv("CLICKHOUSE_DB", "phoenix")
    if ch_url:
        ch_writer = ClickHouseWriter(ch_url, ch_db)
    return AnalyticsService(db, redis_client, categorizer, cache_invalidator, ch_writer, anomaly_service_url=None)


@router.get("/dashboard/overview")
async def dashboard_overview(
    x_user_id: str = Header(None, alias="X-User-ID"),
    service: AnalyticsService = Depends(get_analytics_service),
):
    """
    FACADE PATTERN: Single endpoint aggregating FHS, categories,
    recent transactions, unread alerts, and budget status.
    """
    if not x_user_id:
        raise HTTPException(status_code=401, detail="User ID not provided")
    return await service.get_dashboard_overview(x_user_id)


@router.get("/fhs/history")
async def fhs_history(
    months: int = Query(6, ge=1, le=24),
    x_user_id: str = Header(None, alias="X-User-ID"),
    db: AsyncSession = Depends(get_db),
):
    """Get FHS score history for the last N months."""
    if not x_user_id:
        raise HTTPException(status_code=401, detail="User ID not provided")

    result = await db.execute(
        text(
            "SELECT score, savings_rate, dti_ratio, spending_volatility, computed_at "
            "FROM financial_health_scores "
            "WHERE user_id = :uid ORDER BY computed_at DESC LIMIT :limit"
        ),
        {"uid": x_user_id, "limit": months},
    )
    return [
        {
            "score": float(row.score),
            "savings_rate": float(row.savings_rate) if row.savings_rate else None,
            "dti_ratio": float(row.dti_ratio) if row.dti_ratio else None,
            "spending_volatility": float(row.spending_volatility) if row.spending_volatility else None,
            "computed_at": str(row.computed_at),
        }
        for row in result.fetchall()
    ]


@router.get("/categories")
async def category_distribution(
    month: str = Query(None, description="YYYY-MM format"),
    x_user_id: str = Header(None, alias="X-User-ID"),
    service: AnalyticsService = Depends(get_analytics_service),
):
    """Get spending distribution by category for a given month."""
    if not x_user_id:
        raise HTTPException(status_code=401, detail="User ID not provided")
    return await service._get_category_distribution(x_user_id)


@router.get("/trends")
async def spending_trends(
    months: int = Query(6, ge=1, le=24),
    x_user_id: str = Header(None, alias="X-User-ID"),
    db: AsyncSession = Depends(get_db),
):
    """Get monthly spending trends."""
    if not x_user_id:
        raise HTTPException(status_code=401, detail="User ID not provided")

    result = await db.execute(
        text(
            "SELECT t.amount, t.ts, COALESCE(c.name, 'Other') as category_name "
            "FROM transactions t "
            "LEFT JOIN transaction_categories tc ON t.id = tc.transaction_id "
            "LEFT JOIN categories c ON tc.category_id = c.id "
            "WHERE t.user_id = :uid "
            "AND t.ts >= CURRENT_DATE - INTERVAL ':months months' "
            "ORDER BY t.ts"
        ),
        {"uid": x_user_id, "months": months},
    )
    from ..processors.trend_analyzer import TrendAnalyzer
    analyzer = TrendAnalyzer()
    txns = [
        {"amount": float(row.amount), "ts": row.ts, "category_name": row.category_name}
        for row in result.fetchall()
    ]
    return analyzer.compute(txns, months)
