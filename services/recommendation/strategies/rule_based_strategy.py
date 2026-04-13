"""Rule-Based Strategy — 50/30/20 budget rule for users with < 6 months history."""

from strategies.base import IRecommendationStrategy

# Category classifications
NEEDS_CATEGORIES = {1, 2, 3, 5, 11}  # Groceries, Transport, Utilities, Healthcare, Rent
WANTS_CATEGORIES = {4, 6, 7, 9, 13, 14}  # Entertainment, Dining, Shopping, Travel, Personal Care, Subs

CATEGORY_NAMES = {
    1: "Groceries", 2: "Transportation", 3: "Utilities", 4: "Entertainment",
    5: "Healthcare", 6: "Dining", 7: "Shopping", 8: "Education", 9: "Travel",
    10: "Investments", 11: "Rent/Housing", 12: "Insurance", 13: "Personal Care",
    14: "Subscriptions", 15: "Other",
}


class RuleBasedStrategy(IRecommendationStrategy):
    """
    Used when user has < 6 months of history.
    Applies the 50/30/20 rule to estimated monthly income:
    50% Needs (groceries, utilities, rent, transport, healthcare)
    30% Wants (dining, entertainment, shopping, subscriptions, travel)
    20% Savings/Debt
    """

    async def compute_budget(self, user_id, month, spending_history):
        # Estimate income from last available spending (assume spending = 80% of income)
        if spending_history:
            avg_spend = sum(h.get("total", 0) for h in spending_history) / len(spending_history)
            estimated_income = avg_spend / 0.80
        else:
            estimated_income = 50000  # Default INR

        needs_budget = estimated_income * 0.50
        wants_budget = estimated_income * 0.30
        savings_budget = estimated_income * 0.20

        # Distribute needs budget across need categories proportionally
        needs_cats = [h for h in spending_history if h.get("category_id") in NEEDS_CATEGORIES]
        wants_cats = [h for h in spending_history if h.get("category_id") in WANTS_CATEGORIES]

        recommendations = []

        # Distribute needs budget
        total_needs_spend = sum(h.get("total", 0) for h in needs_cats) or 1
        for h in needs_cats:
            proportion = h.get("total", 0) / total_needs_spend
            recommendations.append({
                "category_id": h["category_id"],
                "category_name": CATEGORY_NAMES.get(h["category_id"], "Other"),
                "recommended_amount": round(needs_budget * proportion, 2),
                "strategy": "50/30/20",
                "bucket": "needs",
            })

        # Distribute wants budget
        total_wants_spend = sum(h.get("total", 0) for h in wants_cats) or 1
        for h in wants_cats:
            proportion = h.get("total", 0) / total_wants_spend
            recommendations.append({
                "category_id": h["category_id"],
                "category_name": CATEGORY_NAMES.get(h["category_id"], "Other"),
                "recommended_amount": round(wants_budget * proportion, 2),
                "strategy": "50/30/20",
                "bucket": "wants",
            })

        # Savings recommendation
        recommendations.append({
            "category_id": 10,
            "category_name": "Savings",
            "recommended_amount": round(savings_budget, 2),
            "strategy": "50/30/20",
            "bucket": "savings",
        })

        return recommendations
