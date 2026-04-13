import { useQuery } from '@tanstack/react-query'
import apiClient from './client'

export function useTransactions(page = 1, pageSize = 20) {
  return useQuery({
    queryKey: ['transactions', page, pageSize],
    queryFn: () => apiClient.get(`/transactions?page=${page}&page_size=${pageSize}`).then(r => r.data),
  })
}
