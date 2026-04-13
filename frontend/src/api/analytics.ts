import { useQuery } from '@tanstack/react-query'
import apiClient from './client'

export function useSpendingTrends(months = 6) {
  return useQuery({
    queryKey: ['analytics', 'trends', months],
    queryFn: () => apiClient.get(`/analytics/trends?months=${months}`).then(r => r.data),
  })
}

export function useCategoryDistribution() {
  return useQuery({
    queryKey: ['analytics', 'categories'],
    queryFn: () => apiClient.get('/analytics/categories').then(r => r.data),
  })
}
