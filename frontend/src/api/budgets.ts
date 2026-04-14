import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

export interface BudgetRecommendation {
    category_id: number
    category_name: string
    recommended_amount: number
    strategy: string
    bucket?: string
    median_spending?: number
    // Override fields — present only when user has set a custom limit
    current_limit?: number | null
    current_spending?: number | null
}

export interface BudgetResponse {
    month: string
    strategy_used: string
    months_of_history: number
    recommendations: BudgetRecommendation[]
}

export function useBudgets(month?: string) {
    const params = month ? `?month=${month}` : ''
    return useQuery<BudgetResponse>({
        queryKey: ['budgets', month ?? 'current'],
        queryFn: () => apiClient.get(`/recommendations/budget${params}`).then(r => r.data),
        staleTime: 60_000,
    })
}

export function useOverrideBudget() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({ categoryId, limitAmount, month }: {
            categoryId: number
            limitAmount: number
            month?: string
        }) => {
            const params = new URLSearchParams({ limit_amount: String(limitAmount) })
            if (month) params.set('month', month)
            return apiClient
                .post(`/recommendations/budget/${categoryId}/override?${params}`)
                .then(r => r.data)
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['budgets'] })
            qc.invalidateQueries({ queryKey: ['dashboard', 'overview'] })
        },
    })
}
