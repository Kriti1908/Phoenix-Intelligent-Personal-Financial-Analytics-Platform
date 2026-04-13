import { useBudgetRecommendations } from '../api/recommendations'

export default function Recommendations() {
  const { data, isLoading } = useBudgetRecommendations()

  if (isLoading) return <div className="loading-spinner"><div className="spinner" /></div>

  return (
    <div>
      <h1 className="page-title">Budget Recommendations</h1>
      {data && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-title">Strategy</div>
          <p style={{ color: 'var(--text-secondary)' }}>
            Using <strong style={{ color: 'var(--accent-secondary)' }}>{data.strategy_used}</strong> strategy
            based on <strong>{data.months_of_history}</strong> months of history
          </p>
        </div>
      )}
      <div className="dashboard-grid">
        {data?.recommendations?.map((rec: {
          category_id: number; category_name: string;
          recommended_amount: number; bucket?: string; strategy: string
        }) => (
          <div key={rec.category_id} className="card">
            <div className="card-title">{rec.category_name}</div>
            <div className="stat-value">₹{rec.recommended_amount.toLocaleString()}</div>
            <div className="stat-label">
              {rec.bucket ? `${rec.bucket.toUpperCase()} bucket` : rec.strategy}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
