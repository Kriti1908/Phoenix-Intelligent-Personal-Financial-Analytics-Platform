import { useQuery } from '@tanstack/react-query'
import apiClient from './client'

export interface DashboardOverview {
  fhs: { score: number; computed_at: string; data_freshness: 'fresh' | 'stale' }
  categories: Array<{ category: string; amount: number; count: number }>
  recent_transactions: Array<{
    id: string; amount: number; currency: string;
    merchant_name: string; description: string; ts: string; category: string
  }>
  unread_alerts: number
  budget_status: Array<{ category: string; limit: number; spent: number; status: 'ok'|'warning'|'over' }>
}

export function useDashboardOverview() {
  return useQuery({
    queryKey: ['dashboard', 'overview'],
    queryFn: () => apiClient.get<DashboardOverview>('/dashboard/overview').then(r => r.data),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

export function useFHSHistory(months = 6) {
  return useQuery({
    queryKey: ['analytics', 'fhs', 'history', months],
    queryFn: () => apiClient.get(`/analytics/fhs/history?months=${months}`).then(r => r.data),
  })
}
