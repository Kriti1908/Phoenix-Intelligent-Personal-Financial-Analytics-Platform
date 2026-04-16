import { useState } from 'react'
import { useAddTransaction, ManualTransactionPayload } from '../api/transactions'

interface Props {
    onClose: () => void
}

export default function AddTransactionModal({ onClose }: Props) {
    const today = new Date().toISOString().split('T')[0]
    const [form, setForm] = useState<ManualTransactionPayload>({
        amount: 0,
        description: '',
        merchant_name: '',
        date: today,
        currency: 'INR',
    })
    const [success, setSuccess] = useState(false)
    const { mutate, isPending, error } = useAddTransaction()

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!form.amount || !form.description) return
        const payload: ManualTransactionPayload = {
            amount: Number(form.amount),
            description: form.description,
            currency: 'INR',
        }
        if (form.merchant_name) payload.merchant_name = form.merchant_name
        if (form.date) payload.date = form.date
        mutate(payload, {
            onSuccess: () => {
                setSuccess(true)
                setTimeout(onClose, 1200)
            },
        })
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <span>Add Transaction</span>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>

                {success ? (
                    <div style={{ textAlign: 'center', padding: '32px 0' }}>
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 12 }}>
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                            <polyline points="22 4 12 14.01 9 11.01"/>
                        </svg>
                        <div style={{ color: 'var(--accent-green)', fontSize: 16, fontWeight: 600 }}>
                            Transaction added successfully
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label>Amount (₹) <span style={{ color: 'var(--accent-red)' }}>*</span></label>
                            <input
                                id="txn-amount"
                                type="number"
                                step="0.01"
                                min="0.01"
                                required
                                placeholder="e.g. 500"
                                value={form.amount || ''}
                                onChange={e => setForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))}
                            />
                        </div>
                        <div className="form-group">
                            <label>Description <span style={{ color: 'var(--accent-red)' }}>*</span></label>
                            <input
                                id="txn-desc"
                                type="text"
                                required
                                placeholder="e.g. Coffee at Starbucks"
                                value={form.description}
                                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                            />
                        </div>
                        <div className="form-group">
                            <label>Merchant Name <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                            <input
                                id="txn-merchant"
                                type="text"
                                placeholder="e.g. Starbucks"
                                value={form.merchant_name ?? ''}
                                onChange={e => setForm(f => ({ ...f, merchant_name: e.target.value }))}
                            />
                        </div>
                        <div className="form-group">
                            <label>Date</label>
                            <input
                                id="txn-date"
                                type="date"
                                value={form.date ?? today}
                                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                                style={{ colorScheme: 'dark' }}
                            />
                        </div>

                        {error && (
                            <p style={{ color: 'var(--accent-red)', marginBottom: 16, fontSize: 14 }}>
                                {(error as Error).message || 'Failed to add transaction'}
                            </p>
                        )}

                        <div style={{ display: 'flex', gap: 12 }}>
                            <button type="button" className="btn-secondary" onClick={onClose} style={{ flex: 1, padding: 12 }}>
                                Cancel
                            </button>
                            <button type="submit" className="btn-primary" style={{ flex: 2 }} disabled={isPending}>
                                {isPending ? 'Saving…' : 'Add Transaction'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    )
}
