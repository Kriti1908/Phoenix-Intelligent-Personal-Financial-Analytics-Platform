"""AnalyticsService — orchestrates categorization, FHS computation, caching, and ClickHouse writes."""

import json
import logging
from decimal import Decimal
import httpx
from datetime import datetime

from sqlalchemy import select, text, func
from sqlalchemy.ext.asyncio import AsyncSession
import redis.asyncio as aioredis

from categorization.service import CategorizationService
from processors.fhs_processor import FHSProcessor
from processors.category_aggregator import CategoryAggregator
from processors.trend_analyzer import TrendAnalyzer
from cache import CacheInvalidator
from clickhouse_writer import ClickHouseWriter

logger = logging.getLogger(__name__)


class AnalyticsService:
    def __init__(
        self,
        db: AsyncSession,
        redis_client: aioredis.Redis,
        categorization_service: CategorizationService,
        cache_invalidator: CacheInvalidator,
        clickhouse_writer: ClickHouseWriter | None = None,
        anomaly_service_url: str | None = None,
    ):
        self.db = db
        self.redis = redis_client
        self.categorizer = categorization_service
        self.cache_invalidator = cache_invalidator
        self.ch_writer = clickhouse_writer
        self.anomaly_service_url = anomaly_service_url
        self.fhs_processor = FHSProcessor()
        self.category_aggregator = CategoryAggregator()
        self.trend_analyzer = TrendAnalyzer()

    async def process_ingestion_event(self, user_id: str, transaction_ids: list[str]) -> dict:
        """
        Main analytics pipeline triggered after transaction ingestion:
        1. Categorize each new transaction
        2. Recompute FHS
        3. Invalidate cache
        4. Write to ClickHouse (async)
        """
        # 1. Load and categorize new transactions
        categorized = 0
        for txn_id in transaction_ids:
            row = await self.db.execute(
                text("SELECT id, raw_description, mcc_code, merchant_name FROM transactions WHERE id = :id"),
                {"id": txn_id},
            )
            txn = row.fetchone()
            if not txn:
                continue

            result = await self.categorizer.categorize(
                txn.raw_description or "", txn.mcc_code, txn.merchant_name
            )

            # Insert categorization result
            await self.db.execute(
                text(
                    "INSERT INTO transaction_categories "
                    "(transaction_id, category_id, confidence, method, categorizer_version) "
                    "VALUES (:txn_id, :cat_id, :conf, :method, 'v1')"
                ),
                {
                    "txn_id": txn.id,
                    "cat_id": result.category_id,
                    "conf": result.confidence,
                    "method": result.method.value,
                },
            )
            categorized += 1

        # 2. Compute FHS
        metrics = await self._compute_user_metrics(user_id)
        fhs_score = self.fhs_processor.compute(user_id, metrics)

        # Persist FHS (append-only)
        await self.db.execute(
            text(
                "INSERT INTO financial_health_scores "
                "(user_id, score, savings_rate, dti_ratio, spending_volatility, emergency_fund_ratio) "
                "VALUES (:user_id, :score, :savings_rate, :dti_ratio, :volatility, :ef_ratio)"
            ),
            {
                "user_id": user_id,
                "score": float(fhs_score),
                "savings_rate": metrics.get("savings_rate", 0),
                "dti_ratio": metrics.get("dti_ratio", 0),
                "volatility": metrics.get("spending_volatility", 0),
                "ef_ratio": metrics.get("emergency_fund_months", 0),
            },
        )
        await self.db.commit()

        # 3. Invalidate cache
        current_month = datetime.utcnow().strftime("%Y-%m")
        await self.cache_invalidator.invalidate_user(user_id, current_month)

        # 4. Write to ClickHouse (async, fire-and-forget)
        if self.ch_writer:
            await self.ch_writer.write_fhs(
                user_id,
                {
                    "score": float(fhs_score),
                    "savings_rate": metrics.get("savings_rate", 0),
                    "dti_ratio": metrics.get("dti_ratio", 0),
                    "spending_volatility": metrics.get("spending_volatility", 0),
                },
            )

        # 5. Notify Anomaly Detection Service (Observer chain continuation)
        if self.anomaly_service_url and categorized > 0:
            await self._notify_anomaly_service(user_id, transaction_ids)

        return {"categorized": categorized, "fhs_score": float(fhs_score)}

    async def _notify_anomaly_service(self, user_id: str, transaction_ids: list[str]) -> None:
        """Forward the analytics-complete event to the Anomaly Detection service."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    f"{self.anomaly_service_url}/internal/events/analytics-complete",
                    json={"user_id": user_id, "transaction_ids": transaction_ids},
                )
                logger.info(
                    f"Anomaly service notified for user {user_id}: "
                    f"status={resp.status_code}, body={resp.json()}"
                )
        except Exception as e:
            # Non-blocking: anomaly failure must not break analytics pipeline
            logger.warning(f"Failed to notify anomaly service for user {user_id}: {e}")

    async def get_dashboard_overview(self, user_id: str) -> dict:
        """
        FACADE PATTERN: Single endpoint aggregating data from multiple sources.
        Redis cache → ClickHouse/PostgreSQL fallback.
        """
        # Check cache first
        cache_key = f"dashboard:{user_id}:overview"
        cached = await self.redis.get(cache_key)
        if cached:
            return json.loads(cached)

        # Build overview from DB
        fhs = await self._get_latest_fhs(user_id)
        categories = await self._get_category_distribution(user_id)
        recent_txns = await self._get_recent_transactions(user_id, limit=10)
        unread_alerts = await self._get_unread_alert_count(user_id)
        budget_status = await self._get_budget_status(user_id)

        overview = {
            "fhs": fhs,
            "categories": categories,
            "recent_transactions": recent_txns,
            "unread_alerts": unread_alerts,
            "budget_status": budget_status,
        }

        # Cache for 30s
        await self.redis.setex(cache_key, 30, json.dumps(overview, default=str))
        return overview

    async def _compute_user_metrics(self, user_id: str) -> dict:
        """Compute financial health metrics from transaction history."""
        # Get monthly spending totals for last 6 months
        result = await self.db.execute(
            text(
                "SELECT DATE_TRUNC('month', ts) as month, SUM(amount) as total "
                "FROM transactions WHERE user_id = :uid "
                "GROUP BY DATE_TRUNC('month', ts) ORDER BY month DESC LIMIT 6"
            ),
            {"uid": user_id},
        )
        monthly_totals = [float(row.total) for row in result.fetchall()]

        if not monthly_totals:
            return {"savings_rate": 0, "dti_ratio": 0, "spending_volatility": 0, "emergency_fund_months": 0}

        avg_monthly = sum(monthly_totals) / len(monthly_totals)
        estimated_income = avg_monthly * 1.5  # Rough estimate

        savings_rate = max(0, (estimated_income - avg_monthly) / estimated_income) if estimated_income > 0 else 0

        # Spending volatility (coefficient of variation)
        if len(monthly_totals) > 1 and avg_monthly > 0:
            variance = sum((x - avg_monthly) ** 2 for x in monthly_totals) / len(monthly_totals)
            std_dev = variance ** 0.5
            cv = std_dev / avg_monthly
        else:
            cv = 0

        return {
            "savings_rate": round(savings_rate, 4),
            "dti_ratio": 0.15,  # Default; could be enriched with loan data
            "spending_volatility": round(cv, 4),
            "emergency_fund_months": 2.0,  # Default
        }

    async def _get_latest_fhs(self, user_id: str) -> dict:
        cache_key = f"fhs:{user_id}"
        cached = await self.redis.get(cache_key)
        if cached:
            data = json.loads(cached)
            data["data_freshness"] = "fresh"
            return data

        result = await self.db.execute(
            text(
                "SELECT score, computed_at FROM financial_health_scores "
                "WHERE user_id = :uid ORDER BY computed_at DESC LIMIT 1"
            ),
            {"uid": user_id},
        )
        row = result.fetchone()
        if row:
            fhs = {"score": float(row.score), "computed_at": str(row.computed_at), "data_freshness": "fresh"}
            await self.redis.setex(cache_key, 60, json.dumps(fhs))
            return fhs
        return {"score": 0, "computed_at": None, "data_freshness": "stale"}

    async def _get_category_distribution(self, user_id: str) -> list[dict]:
        current_month = datetime.utcnow().strftime("%Y-%m")
        cache_key = f"cat_dist:{user_id}:{current_month}"
        cached = await self.redis.get(cache_key)
        if cached:
            return json.loads(cached)

        result = await self.db.execute(
            text(
                "SELECT c.name as category, SUM(ABS(t.amount)) as amount, COUNT(*) as count "
                "FROM transactions t "
                "JOIN transaction_categories tc ON t.id = tc.transaction_id "
                "JOIN categories c ON tc.category_id = c.id "
                "WHERE t.user_id = :uid AND DATE_TRUNC('month', t.ts) = DATE_TRUNC('month', CURRENT_DATE) "
                "GROUP BY c.name ORDER BY amount DESC"
            ),
            {"uid": user_id},
        )
        categories = [
            {"category": row.category, "amount": float(row.amount), "count": row.count}
            for row in result.fetchall()
        ]
        if categories:
            await self.redis.setex(cache_key, 300, json.dumps(categories))
        return categories

    async def _get_recent_transactions(self, user_id: str, limit: int = 10) -> list[dict]:
        result = await self.db.execute(
            text(
                "SELECT t.id, t.amount, t.currency, t.merchant_name, t.raw_description, t.ts, "
                "c.name as category "
                "FROM transactions t "
                "LEFT JOIN transaction_categories tc ON t.id = tc.transaction_id "
                "LEFT JOIN categories c ON tc.category_id = c.id "
                "WHERE t.user_id = :uid ORDER BY t.ts DESC LIMIT :lim"
            ),
            {"uid": user_id, "lim": limit},
        )
        return [
            {
                "id": str(row.id),
                "amount": float(row.amount),
                "currency": row.currency,
                "merchant_name": row.merchant_name,
                "description": row.raw_description,
                "ts": str(row.ts),
                "category": row.category or "Other",
            }
            for row in result.fetchall()
        ]

    async def _get_unread_alert_count(self, user_id: str) -> int:
        result = await self.db.execute(
            text(
                "SELECT COUNT(*) as cnt FROM anomaly_alerts "
                "WHERE user_id = :uid AND acknowledged_at IS NULL"
            ),
            {"uid": user_id},
        )
        return result.scalar() or 0

    async def _get_budget_status(self, user_id: str) -> list[dict]:
        result = await self.db.execute(
            text(
                "SELECT b.category_id, c.name as category, b.limit_amount, "
                "COALESCE(SUM(t.amount), 0) as spent "
                "FROM budgets b "
                "JOIN categories c ON b.category_id = c.id "
                "LEFT JOIN transactions t ON t.user_id = b.user_id "
                "AND DATE_TRUNC('month', t.ts) = b.month "
                "LEFT JOIN transaction_categories tc ON t.id = tc.transaction_id "
                "AND tc.category_id = b.category_id "
                "WHERE b.user_id = :uid AND b.month = DATE_TRUNC('month', CURRENT_DATE) "
                "GROUP BY b.category_id, c.name, b.limit_amount"
            ),
            {"uid": user_id},
        )
        budgets = []
        for row in result.fetchall():
            spent = float(row.spent)
            limit_amt = float(row.limit_amount)
            status = "ok" if spent <= limit_amt * 0.8 else ("warning" if spent <= limit_amt else "over")
            budgets.append({
                "category": row.category,
                "limit": limit_amt,
                "spent": spent,
                "status": status,
            })
        return budgets
