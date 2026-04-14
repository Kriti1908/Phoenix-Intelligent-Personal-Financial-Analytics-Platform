import { useState } from 'react'
import { useBudgets, useOverrideBudget, BudgetRecommendation } from '../api/budgets'

function getStatus(spent: number, limit: number): 'ok' | 'warning' | 'over' {
    if (limit <= 0) return 'ok'
    const pct = spent / limit
    if (pct >= 1) return 'over'
    if (pct >= 0.8) return 'warning'
    return 'ok'
}

function statusIcon(status: 'ok' | 'warning' | 'over') {
    return status === 'over' ? '🔴' : status === 'warning' ? '⚠️' : '✅'
}

function bucketColor(bucket?: string) {
    if (bucket === 'needs') return 'var(--accent-primary)'
    if (bucket === 'wants') return 'var(--accent-amber)'
    if (bucket === 'savings') return 'var(--accent-green)'
    return 'var(--text-secondary)'
}

function BudgetRow({ item, month }: { item: BudgetRecommendation; month: string }) {
    // effective limit = user override if present, else recommended_amount
    const limit = item.current_limit ?? item.recommended_amount
    // current_spending may not come from the API (strategy doesn't compute it)
    // show 0 until the backend is wired to return it
    const spent = item.current_spending ?? 0
    const status = getStatus(spent, limit)
    const pct = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0

    const [editing, setEditing] = useState(false)
    const [inputVal, setInputVal] = useState(String(Math.round(limit)))
    const { mutate, isPending } = useOverrideBudget()

    function saveOverride() {
        const val = parseFloat(inputVal)
        if (!val || val <= 0) return
        mutate(
            { categoryId: item.category_id, limitAmount: val, month },
            { onSuccess: () => setEditing(false) }
        )
    }

    return (
        <div className="budget-row-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                    <span style={{ fontWeight: 600, fontSize: 15 }}>
                        {statusIcon(status)} {item.category_name}
                    </span>
                    {item.bucket && (
                        <span style={{
                            marginLeft: 8, fontSize: 11, padding: '2px 8px', borderRadius: 10,
                            background: `${bucketColor(item.bucket)}22`,
                            color: bucketColor(item.bucket), fontWeight: 600, textTransform: 'uppercase',
                        }}>
                            {item.bucket}
                        </span>
                    )}
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                        Recommended limit: ₹{item.recommended_amount.toLocaleString()}
                        {item.median_spending != null && (
                            <span> · Median spend: ₹{item.median_spending.toLocaleString()}</span>
                        )}
                    </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13 }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Limit: </span>
                        <span style={{ fontWeight: 700 }}>₹{limit.toLocaleString()}</span>
                    </div>
                    {!editing && (
                        <button
                            onClick={() => { setInputVal(String(Math.round(limit))); setEditing(true) }}
                            style={{
                                marginTop: 4, fontSize: 11, padding: '3px 10px', cursor: 'pointer',
                                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                                borderRadius: 20, color: 'var(--text-secondary)',
                            }}
                        >
                            ✏️ Edit
                        </button>
                    )}
                </div>
            </div>

            {/* Progress bar — shows 0 if spending data not yet available */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                <span>₹{spent.toLocaleString()} spent</span>
                <span>{pct.toFixed(0)}%</span>
            </div>
            <div className="budget-bar-track">
                <div className={`budget-bar-fill ${status}`} style={{ width: `${pct}%` }} />
            </div>

            {editing && (
                <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>New limit ₹</span>
                    <input
                        id={`budget-limit-${item.category_id}`}
                        type="number"
                        min="1"
                        step="100"
                        value={inputVal}
                        onChange={e => setInputVal(e.target.value)}
                        style={{
                            flex: 1, padding: '7px 12px', background: 'var(--bg-secondary)',
                            border: '1px solid var(--border)', borderRadius: 8,
                            color: 'var(--text-primary)', fontSize: 14, outline: 'none',
                        }}
                    />
                    <button
                        onClick={saveOverride}
                        disabled={isPending}
                        className="btn-primary"
                        style={{ width: 'auto', padding: '7px 18px', fontSize: 13 }}
                    >
                        {isPending ? '…' : 'Save'}
                    </button>
                    <button
                        onClick={() => setEditing(false)}
                        style={{
                            padding: '7px 14px', background: 'var(--bg-secondary)',
                            border: '1px solid var(--border)', borderRadius: 8,
                            color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13,
                        }}
                    >
                        Cancel
                    </button>
                </div>
            )}
        </div>
    )
}

export default function Budgets() {
    const now = new Date()
    const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const [month, setMonth] = useState(defaultMonth)

    const { data, isLoading, error } = useBudgets(month)

    const monthOptions = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        const label = d.toLocaleString('default', { month: 'long', year: 'numeric' })
        return { val, label }
    })

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
                <h1 className="page-title" style={{ margin: 0 }}>💰 Budget Management</h1>
                <select
                    id="budget-month-select"
                    className="form-select"
                    value={month}
                    onChange={e => setMonth(e.target.value)}
                >
                    {monthOptions.map(o => (
                        <option key={o.val} value={o.val}>{o.label}</option>
                    ))}
                </select>
            </div>

            {isLoading && <div className="loading-spinner"><div className="spinner" /></div>}

            {error && (
                <div className="card" style={{ textAlign: 'center', color: 'var(--accent-red)', padding: 32 }}>
                    Failed to load budget recommendations.
                </div>
            )}

            {data && (
                <>
                    <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
                        <div className="badge-chip">
                            📊 Strategy: <strong style={{ marginLeft: 4 }}>{data.strategy_used}</strong>
                        </div>
                        <div className="badge-chip">
                            📅 History: <strong style={{ marginLeft: 4 }}>{data.months_of_history} month{data.months_of_history !== 1 ? 's' : ''}</strong>
                        </div>
                        {data.months_of_history < 6 && (
                            <div className="badge-chip warning-chip">
                                ⚡ Add 6+ months of data for statistical budgets
                            </div>
                        )}
                    </div>

                    {!data.recommendations || data.recommendations.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">💰</div>
                            <h2>No Budget Data Yet</h2>
                            <p>Upload transactions to generate personalized budget recommendations.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
                            {data.recommendations.map((item: BudgetRecommendation) => (
                                <BudgetRow key={item.category_id} item={item} month={month} />
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
