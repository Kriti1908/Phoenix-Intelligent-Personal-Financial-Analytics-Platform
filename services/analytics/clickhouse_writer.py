"""ClickHouse Async Writer — writes computed analytics asynchronously."""

import asyncio
import logging
import httpx

logger = logging.getLogger(__name__)


class ClickHouseWriter:
    """
    Writes computed analytics to ClickHouse asynchronously (fire-and-forget).
    ClickHouse data may lag PostgreSQL by 1–2 seconds — acceptable for trend queries.
    """

    def __init__(self, clickhouse_url: str, db: str):
        self.url = f"{clickhouse_url}/?database={db}"

    async def write_fhs(self, user_id: str, fhs_data: dict) -> None:
        query = (
            "INSERT INTO financial_health_scores "
            "(user_id, score, savings_rate, dti_ratio, spending_volatility, computed_at) "
            f"VALUES ('{user_id}', {fhs_data['score']}, {fhs_data.get('savings_rate', 0)}, "
            f"{fhs_data.get('dti_ratio', 0)}, {fhs_data.get('spending_volatility', 0)}, now())"
        )
        asyncio.create_task(self._execute(query))

    async def write_monthly_category(
        self, user_id: str, category_id: int, category_name: str,
        month: str, total_amount: float, tx_count: int
    ) -> None:
        query = (
            "INSERT INTO monthly_category_spending "
            "(user_id, category_id, category_name, month, total_amount, tx_count) "
            f"VALUES ('{user_id}', {category_id}, '{category_name}', "
            f"'{month}', {total_amount}, {tx_count})"
        )
        asyncio.create_task(self._execute(query))

    async def _execute(self, query: str) -> None:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                await client.post(self.url, content=query)
        except Exception as e:
            logger.warning(f"ClickHouse write failed (non-fatal): {e}")
