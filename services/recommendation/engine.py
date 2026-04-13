"""Recommendation Engine — selects strategy based on user history length."""

from strategies.base import IRecommendationStrategy
from strategies.rule_based_strategy import RuleBasedStrategy
from strategies.statistical_strategy import StatisticalStrategy


class RecommendationEngine:
    """
    STRATEGY PATTERN: Selects recommendation strategy based on data availability.
    < 6 months → RuleBasedStrategy (50/30/20 rule)
    >= 6 months → StatisticalStrategy (percentile-based)
    """

    def get_strategy(self, months_of_history: int) -> IRecommendationStrategy:
        if months_of_history >= 6:
            return StatisticalStrategy()
        return RuleBasedStrategy()
