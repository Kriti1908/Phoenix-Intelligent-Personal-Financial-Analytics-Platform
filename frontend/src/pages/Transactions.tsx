import { useState } from 'react'
import { useTransactions } from '../api/transactions'

export default function Transactions() {
  const [page, setPage] = useState(1)
  const { data, isLoading } = useTransactions(page)

  if (isLoading) return <div className="loading-spinner"><div className="spinner" /></div>

  return (
    <div>
      <h1 className="page-title">Transactions</h1>
      <div className="card">
        <table className="transactions-table">
          <thead>
            <tr><th>Date</th><th>Description</th><th>Amount</th><th>Currency</th></tr>
          </thead>
          <tbody>
            {data?.transactions?.map((t: { id: string; ts: string; raw_description: string; merchant_name: string; amount: number; currency: string }) => (
              <tr key={t.id}>
                <td>{new Date(t.ts).toLocaleDateString()}</td>
                <td>{t.merchant_name || t.raw_description}</td>
                <td style={{ fontWeight: 600 }}>₹{Math.abs(t.amount).toLocaleString()}</td>
                <td>{t.currency}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 24 }}>
          <button className="btn-primary" style={{ width: 'auto', padding: '8px 24px' }}
                  onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>
            Previous
          </button>
          <span style={{ padding: '8px 16px', color: 'var(--text-secondary)' }}>
            Page {page} of {Math.ceil((data?.total || 0) / 20)}
          </span>
          <button className="btn-primary" style={{ width: 'auto', padding: '8px 24px' }}
                  onClick={() => setPage(p => p + 1)} disabled={!data || page * 20 >= data.total}>
            Next
          </button>
        </div>
      </div>
    </div>
  )
}
