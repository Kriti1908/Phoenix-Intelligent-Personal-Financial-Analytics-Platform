"""STRATEGY PATTERN — Base interface for recommendation strategies."""

from abc import ABC, abstractmethod


class IRecommendationStrategy(ABC):
    @abstractmethod
    async def compute_budget(
        self, user_id: str, month: str, spending_history: list
    ) -> list[dict]:
        ...
