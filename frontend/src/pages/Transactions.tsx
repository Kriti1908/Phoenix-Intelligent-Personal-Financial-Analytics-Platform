import { useState } from 'react'
import { useTransactions } from '../api/transactions'
import AddTransactionModal from './AddTransactionModal'
import CSVUpload from './CSVUpload'

export default function Transactions() {
  const [page, setPage] = useState(1)
  const { data, isLoading } = useTransactions(page)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showCSVModal, setShowCSVModal] = useState(false)

  if (isLoading) return <div className="loading-spinner"><div className="spinner" /></div>

  const isEmpty = !data?.total

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <h1 className="page-title" style={{ margin: 0 }}>💳 Transactions</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            id="btn-upload-csv"
            className="btn-secondary"
            onClick={() => setShowCSVModal(true)}
          >
            📤 Upload CSV
          </button>
          <button
            id="btn-add-transaction"
            className="btn-primary"
            style={{ width: 'auto', padding: '10px 20px' }}
            onClick={() => setShowAddModal(true)}
          >
            ➕ Add Transaction
          </button>
        </div>
      </div>

      {isEmpty ? (
        <div className="empty-state">
          <div className="empty-state-icon">📭</div>
          <h2>No Transactions Yet</h2>
          <p>Get started by adding a transaction manually or uploading a CSV file.</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 4 }}>
            <button className="btn-primary" style={{ width: 'auto', padding: '12px 28px' }} onClick={() => setShowAddModal(true)}>
              ➕ Add Transaction
            </button>
            <button className="btn-secondary" onClick={() => setShowCSVModal(true)}>
              📤 Upload CSV
            </button>
          </div>
        </div>
      ) : (
        <div className="card">
          <table className="transactions-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Currency</th>
              </tr>
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
      )}

      {showAddModal && <AddTransactionModal onClose={() => setShowAddModal(false)} />}
      {showCSVModal && <CSVUpload onClose={() => setShowCSVModal(false)} />}
    </div>
  )
}
