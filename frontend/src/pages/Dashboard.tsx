import { useDashboardOverview } from '../api/dashboard'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6', '#ec4899', '#14b8a6']

function FHSGauge({ score }: { score: number }) {
  const colorClass = score >= 70 ? 'good' : score >= 40 ? 'warning' : 'poor'
  return (
    <div className="card">
      <div className="card-title">Financial Health Score</div>
      <div className={`fhs-score ${colorClass}`}>{score.toFixed(0)}</div>
      <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>
        {score >= 70 ? '✅ Excellent' : score >= 40 ? '⚠️ Needs Attention' : '🔴 Poor'}
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
          <Tooltip formatter={(value: number) => `₹${value.toLocaleString()}`} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

function BudgetBars({ budgets }: { budgets: Array<{ category: string; limit: number; spent: number; status: string }> }) {
  return (
    <div className="card">
      <div className="card-title">Budget Status</div>
      {budgets.length === 0 && <p style={{ color: 'var(--text-secondary)' }}>No budgets set yet</p>}
      {budgets.map(b => {
        const pct = Math.min((b.spent / b.limit) * 100, 100)
        return (
          <div key={b.category} className="budget-bar">
            <div className="budget-bar-label">
              <span>{b.category}</span>
              <span>₹{b.spent.toLocaleString()} / ₹{b.limit.toLocaleString()}</span>
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
    <div className="card" style={{ gridColumn: '1 / -1' }}>
      <div className="card-title">Recent Transactions</div>
      <table className="transactions-table">
        <thead>
          <tr><th>Date</th><th>Description</th><th>Category</th><th>Amount</th></tr>
        </thead>
        <tbody>
          {transactions.map(t => (
            <tr key={t.id}>
              <td>{new Date(t.ts).toLocaleDateString()}</td>
              <td>{t.merchant_name || t.description}</td>
              <td><span className="category-badge">{t.category}</span></td>
              <td style={{ fontWeight: 600 }}>₹{Math.abs(t.amount).toLocaleString()}</td>
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
          ⚠️ You have {data.unread_alerts} unread alert{data.unread_alerts > 1 ? 's' : ''}
        </div>
      )}
      <div className="dashboard-grid">
        <FHSGauge score={data.fhs?.score || 0} />
        <SpendingPieChart data={data.categories || []} />
        <BudgetBars budgets={data.budget_status || []} />
        <div className="card">
          <div className="card-title">Quick Stats</div>
          <div style={{ display: 'grid', gap: 16 }}>
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
