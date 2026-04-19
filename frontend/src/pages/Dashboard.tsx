import { useDashboardOverview, useFHSHistory } from '../api/dashboard'
import { useSpendingTrends } from '../api/analytics'
import { 
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, 
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  LineChart, Line
} from 'recharts'

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
      <div style={{ display: 'grid', gap: 16 }}>
        {budgets.map(b => {
          const pct = Math.min((b.spent / b.limit) * 100, 100)
          return (
            <div key={b.category} className="budget-bar" style={{ marginBottom: 0 }}>
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
    </div>
  )
}

function SpendingTrendsChart({ data }: { data: any[] }) {
  const latestMoM = data && data.length > 0 ? data[data.length - 1].mom_change_percent : null
  
  return (
    <div className="card" style={{ gridColumn: 'span 2' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div className="card-title" style={{ marginBottom: 0 }}>Monthly Spending Trends</div>
        {latestMoM !== null && (
          <div className={`badge-chip ${latestMoM > 0 ? 'warning-chip' : ''}`} style={{ 
            background: latestMoM > 0 ? 'rgba(251, 113, 133, 0.1)' : 'rgba(52, 211, 153, 0.1)',
            borderColor: latestMoM > 0 ? 'rgba(251, 113, 133, 0.2)' : 'rgba(52, 211, 153, 0.2)',
            color: latestMoM > 0 ? 'var(--accent-red)' : 'var(--accent-green)'
          }}>
            {latestMoM > 0 ? '↑' : '↓'} {Math.abs(latestMoM)}% MoM
          </div>
        )}
      </div>
      <ResponsiveContainer width="100%" height={250}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis 
            dataKey="month" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            dy={10}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
          />
          <Tooltip 
            contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow-lg)' }}
            itemStyle={{ color: 'var(--text-primary)', fontWeight: 600 }}
            labelStyle={{ color: 'var(--text-muted)', marginBottom: 4, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}
            formatter={(value: number) => [`₹${value.toLocaleString('en-IN')}`, 'Total Spending']}
          />
          <Area 
            type="monotone" 
            dataKey="total" 
            stroke="var(--accent-primary)" 
            strokeWidth={3}
            fillOpacity={1} 
            fill="url(#colorTotal)" 
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function FHSHistoryChart({ data }: { data: any[] }) {
  // data comes in DESC order from API, reverse for chart
  const chartData = [...data].reverse().map(d => ({
    ...d,
    date: new Date(d.computed_at).toLocaleDateString('en-IN', { month: 'short', day: '2-digit' })
  }))

  return (
    <div className="card" style={{ gridColumn: 'span 2' }}>
      <div className="card-title">Financial Health History</div>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis 
            dataKey="date" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            dy={10}
          />
          <YAxis 
            domain={[0, 100]}
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
          />
          <Tooltip 
            contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow-lg)' }}
            itemStyle={{ fontWeight: 600 }}
            labelStyle={{ color: 'var(--text-muted)', marginBottom: 4, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}
          />
          <Line 
            type="monotone" 
            dataKey="score" 
            stroke="var(--accent-green)" 
            strokeWidth={3} 
            dot={{ fill: 'var(--accent-green)', r: 4, strokeWidth: 2, stroke: 'var(--bg-primary)' }}
            activeDot={{ r: 6, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
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
  const { data, isLoading: isOverviewLoading, error: overviewError } = useDashboardOverview()
  const { data: trendsData, isLoading: isTrendsLoading } = useSpendingTrends(6)
  const { data: fhsHistory, isLoading: isFHSLoading } = useFHSHistory(12)

  const isLoading = isOverviewLoading || isTrendsLoading || isFHSLoading
  const error = overviewError

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
        <SpendingTrendsChart data={trendsData || []} />
        <FHSHistoryChart data={fhsHistory || []} />
      </div>
      <TransactionTable transactions={data.recent_transactions || []} />
    </div>
  )
}
