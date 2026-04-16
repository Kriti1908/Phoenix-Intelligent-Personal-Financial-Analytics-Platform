import { useDashboardOverview } from '../api/dashboard'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

const COLORS = ['#7c5cfc', '#34d399', '#fbbf24', '#f87171', '#22d3ee', '#a78bfa', '#f472b6', '#2dd4bf']

function FHSGauge({ score }: { score: number }) {
  const colorClass = score >= 70 ? 'good' : score >= 40 ? 'warning' : 'poor'
  const label = score >= 70 ? 'Excellent' : score >= 40 ? 'Needs Attention' : 'Poor'
  return (
    <div className="card">
      <div className="card-title">Financial Health Score</div>
      <div className={`fhs-score ${colorClass}`}>{score.toFixed(0)}</div>
      <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500 }}>
        {label}
      </div>
    </div>
  )
}

function SpendingPieChart({ data }: { data: Array<{ category: string; amount: number }> }) {
  return (
    <div className="card">
      <div className="card-title">Spending by Category</div>
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie data={data} dataKey="amount" nameKey="category" cx="50%" cy="50%"
               outerRadius={90} label={({ category, percent }) => `${category} ${(percent * 100).toFixed(0)}%`}>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip
            formatter={(value: number) => `₹${value.toLocaleString('en-IN')}`}
            contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

function BudgetBars({ budgets }: { budgets: Array<{ category: string; limit: number; spent: number; status: string }> }) {
  return (
    <div className="card">
      <div className="card-title">Budget Status</div>
      {budgets.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No budgets set yet</p>}
      {budgets.map(b => {
        const pct = Math.min((b.spent / b.limit) * 100, 100)
        return (
          <div key={b.category} className="budget-bar">
            <div className="budget-bar-label">
              <span style={{ fontWeight: 500 }}>{b.category}</span>
              <span style={{ color: 'var(--text-secondary)', fontFeatureSettings: '"tnum"' }}>
                ₹{b.spent.toLocaleString('en-IN')} / ₹{b.limit.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="budget-bar-track">
              <div className={`budget-bar-fill ${b.status}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function TransactionTable({ transactions }: { transactions: Array<{
  id: string; amount: number; merchant_name: string; description: string; ts: string; category: string
}> }) {
  return (
    <div className="card" style={{ gridColumn: '1 / -1', padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '20px 24px 0' }}>
        <div className="card-title">Recent Transactions</div>
      </div>
      <table className="transactions-table">
        <thead>
          <tr><th>Date</th><th>Description</th><th>Category</th><th style={{ textAlign: 'right' }}>Amount</th></tr>
        </thead>
        <tbody>
          {transactions.map(t => (
            <tr key={t.id}>
              <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                {new Date(t.ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
              </td>
              <td style={{ fontWeight: 500 }}>{t.merchant_name || t.description}</td>
              <td><span className="category-badge">{t.category}</span></td>
              <td style={{ fontWeight: 600, textAlign: 'right', fontFeatureSettings: '"tnum"' }}>
                ₹{Math.abs(t.amount).toLocaleString('en-IN')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function Dashboard() {
  const { data, isLoading, error } = useDashboardOverview()

  if (isLoading) return <div className="loading-spinner"><div className="spinner" /></div>
  if (error) return <p style={{ color: 'var(--accent-red)' }}>Failed to load dashboard</p>
  if (!data) return null

  return (
    <div>
      <h1 className="page-title">Dashboard</h1>
      {data.unread_alerts > 0 && (
        <div className="alert-banner">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          You have {data.unread_alerts} unread alert{data.unread_alerts > 1 ? 's' : ''}
        </div>
      )}
      <div className="dashboard-grid">
        <FHSGauge score={data.fhs?.score || 0} />
        <SpendingPieChart data={data.categories || []} />
        <BudgetBars budgets={data.budget_status || []} />
        <div className="card">
          <div className="card-title">Quick Stats</div>
          <div style={{ display: 'grid', gap: 20 }}>
            <div>
              <div className="stat-value">{data.categories?.length || 0}</div>
              <div className="stat-label">Active Categories</div>
            </div>
            <div>
              <div className="stat-value">{data.recent_transactions?.length || 0}+</div>
              <div className="stat-label">Recent Transactions</div>
            </div>
          </div>
        </div>
      </div>
      <TransactionTable transactions={data.recent_transactions || []} />
    </div>
  )
}
