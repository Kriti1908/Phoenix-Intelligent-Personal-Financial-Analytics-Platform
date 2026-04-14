import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

export function useTransactions(page = 1, pageSize = 20) {
  return useQuery({
    queryKey: ['transactions', page, pageSize],
    queryFn: () => apiClient.get(`/transactions?page=${page}&page_size=${pageSize}`).then(r => r.data),
  })
}

export interface ManualTransactionPayload {
  amount: number
  description: string
  merchant_name?: string
  date?: string
  currency?: string
}

export function useAddTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: ManualTransactionPayload) =>
      apiClient.post('/transactions/manual', payload).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['dashboard', 'overview'] })
    },
  })
}

export function useUploadCSV() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ file, onProgress }: { file: File; onProgress?: (pct: number) => void }) => {
      const form = new FormData()
      form.append('file', file)
      form.append('source_type', 'csv_v1')
      return apiClient.post('/transactions/ingest', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100))
        },
      }).then(r => r.data)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['dashboard', 'overview'] })
    },
  })
}
