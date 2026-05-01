import { useState, useMemo } from 'react'
import { Plus, Download, ArrowDownRight, Trash2, Banknote } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useAllExpenses } from '../../hooks/useFirestore'
import { addDocument, deleteDocument, updateDocument, getDocuments, where } from '../../firebase/firestore'
import { formatNPR } from '../../utils/formatUtils'
import { adToBS, BS_MONTHS, todayString } from '../../utils/dateUtils'
import {
  Card, SectionHeader, Button, Modal, Input, Select, Badge,
  Table, ConfirmDialog, EmptyState, SourceBadge
} from '../../components/ui/index'
import clsx from 'clsx'

function expenseForm() {
  return {
    date: todayString(),
    category: '',
    description: '',
    amount: '',
    paymentSource: 'bank',
    notes: '',
  }
}

export default function Expenses() {
  const { selectedMonth, settings } = useApp()
  const { data: allExpenses, loading } = useAllExpenses()

  const [showAdd, setShowAdd] = useState(false)
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [form, setForm] = useState(expenseForm())
  const [withdrawForm, setWithdrawForm] = useState({ amount: '', date: todayString(), notes: '' })
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [filterCat, setFilterCat] = useState('all')

  const categories = settings?.expenseCategories || [
    'Rent', 'Operational', 'Misc', 'Car Loan EMI', 'Salary', 'Internet',
    'Travel', 'Utilities', 'Personal Reimbursement – Rikesh'
  ]

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const bsFromDate = (dateStr) => {
    if (!dateStr) return null
    try { return adToBS(new Date(dateStr + 'T00:00:00')) } catch { return null }
  }

  // Filter to selected month
  const monthExpenses = useMemo(() => {
    if (!selectedMonth) return allExpenses
    return allExpenses.filter(t => t.bsYear === selectedMonth.year && t.bsMonth === selectedMonth.month)
  }, [allExpenses, selectedMonth])

  const filtered = useMemo(() => {
    if (filterCat === 'all') return monthExpenses
    return monthExpenses.filter(t => t.category === filterCat)
  }, [monthExpenses, filterCat])

  const totalExpenses = monthExpenses.reduce((s, t) => s + (t.amount || 0), 0)
  const totalBank = monthExpenses.filter(t => t.paymentSource === 'bank').reduce((s, t) => s + (t.amount || 0), 0)
  const totalCash = monthExpenses.filter(t => t.paymentSource === 'cash').reduce((s, t) => s + (t.amount || 0), 0)

  const catSummary = useMemo(() => {
    const map = {}
    monthExpenses.forEach(t => {
      const c = t.category || 'Other'
      map[c] = (map[c] || 0) + (t.amount || 0)
    })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [monthExpenses])

  // ── Save expense ───────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.amount || !form.date) return
    setSaving(true)
    const bs = bsFromDate(form.date)
    try {
      const docData = {
        ...form,
        amount: parseFloat(form.amount) || 0,
        bsYear: bs?.year,
        bsMonth: bs?.month,
        bsDay: bs?.day,
        bsMonthName: bs?.monthName,
        type: 'expense',
      }
      const expenseId = await addDocument('expenses', docData)

      // Auto-update car loan tracker
      if (form.category === 'Car Loan EMI') {
        const emiAmount = parseFloat(form.amount) || 0
        await addDocument('carLoanPayments', {
          date: form.date,
          amount: emiAmount,
          notes: form.notes,
          bsYear: bs?.year,
          bsMonth: bs?.month,
          linkedExpenseId: expenseId,
        })

        // ── Auto-Sync to Salary Ledger ──────────────────────────────────────
        // Find or create a ledger entry for this BS month
        if (bs) {
          const monthKey = `${bs.year}-${String(bs.month).padStart(2, '0')}`
          
          const existing = await getDocuments('salaryLedger', [where('monthKey', '==', monthKey)])
          
          if (existing.length > 0) {
            // Update existing entry with the EMI amount
            await updateDocument('salaryLedger', existing[0].id, {
              carLoanEMI: emiAmount,
              linkedExpenseId: expenseId,
            })
          } else {
            // Create a new month entry for Rikesh with the EMI deduction
            await addDocument('salaryLedger', {
              monthLabel: `${bs.monthName} ${bs.year}`,
              monthKey: monthKey,
              grossAccrued: 150000, // Standard agreed salary
              carLoanEMI: emiAmount,
              totalPaid: 0,
              status: 'unpaid',
              linkedExpenseId: expenseId,
              isAutoCreated: true,
            })
          }
        }
      }

      setShowAdd(false)
      setForm(expenseForm())
    } finally {
      setSaving(false)
    }
  }

  // ── Cash withdrawal ────────────────────────────────────────────────────────
  const handleWithdraw = async () => {
    if (!withdrawForm.amount) return
    setSaving(true)
    const bs = bsFromDate(withdrawForm.date)
    try {
      await addDocument('expenses', {
        date: withdrawForm.date,
        category: 'Cash Withdrawal',
        description: `Cash withdrawal from bank${withdrawForm.notes ? ': ' + withdrawForm.notes : ''}`,
        amount: parseFloat(withdrawForm.amount) || 0,
        paymentSource: 'bank',
        type: 'cash_withdrawal',
        bsYear: bs?.year,
        bsMonth: bs?.month,
        bsDay: bs?.day,
        bsMonthName: bs?.monthName,
      })
      setShowWithdraw(false)
      setWithdrawForm({ amount: '', date: todayString(), notes: '' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    
    // Check if this was a Car Loan EMI expense
    const expense = filtered.find(e => e.id === deleteId)
    if (expense?.category === 'Car Loan EMI') {
      const linked = await getDocuments('salaryLedger', [where('linkedExpenseId', '==', deleteId)])
      for (const entry of linked) {
        // Clear the EMI if it was synced from this expense
        await updateDocument('salaryLedger', entry.id, { 
          carLoanEMI: 0, 
          linkedExpenseId: null 
        })
      }
      
      // Also clear from car loan payments
      const carPayments = await getDocuments('carLoanPayments', [where('linkedExpenseId', '==', deleteId)])
      for (const p of carPayments) {
        await deleteDocument('carLoanPayments', p.id)
      }
    }

    await deleteDocument('expenses', deleteId)
    setDeleteId(null)
  }

  const exportCSV = () => {
    const rows = [
      ['Date AD', 'BS Date', 'Category', 'Description', 'Amount NPR', 'Source', 'Notes'],
      ...filtered.map(t => [
        t.date, `${t.bsDay} ${t.bsMonthName} ${t.bsYear}`,
        t.category, t.description, t.amount, t.paymentSource, t.notes || ''
      ])
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `expenses-${selectedMonth?.year}-${selectedMonth?.month}.csv`
    a.click()
  }

  const monthLabel = selectedMonth
    ? `${BS_MONTHS[selectedMonth.month - 1]} ${selectedMonth.year}`
    : 'All time'

  const columns = [
    {
      header: 'Date',
      render: (row) => (
        <div>
          <div className="text-text-primary text-sm font-body">{row.date}</div>
          <div className="text-text-muted text-xs">{row.bsDay} {row.bsMonthName} {row.bsYear}</div>
        </div>
      )
    },
    {
      header: 'Category',
      render: (row) => (
        <span className={clsx(
          'text-xs px-2 py-0.5 rounded-md font-body',
          row.type === 'cash_withdrawal'
            ? 'bg-yellow-500/10 text-yellow-400'
            : 'bg-bg-elevated text-text-secondary'
        )}>
          {row.category || '—'}
        </span>
      )
    },
    {
      header: 'Description',
      render: (row) => <span className="text-text-secondary text-sm font-body">{row.description || '—'}</span>
    },
    {
      header: 'Source',
      render: (row) => <SourceBadge source={row.paymentSource} />
    },
    {
      header: 'Amount',
      align: 'right',
      render: (row) => <span className="font-mono text-text-primary text-sm">-{formatNPR(row.amount)}</span>
    },
    {
      header: '',
      render: (row) => (
        <button
          onClick={e => { e.stopPropagation(); setDeleteId(row.id) }}
          className="w-7 h-7 rounded-lg hover:bg-accent/10 flex items-center justify-center text-text-muted hover:text-red-400 transition-colors"
        >
          <Trash2 size={12} />
        </button>
      )
    },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      <SectionHeader
        title="Expenses"
        subtitle={monthLabel}
        action={
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={exportCSV} icon={Download}>Export</Button>
            <Button variant="secondary" size="sm" onClick={() => setShowWithdraw(true)} icon={Banknote}>
              Withdraw Cash
            </Button>
            <Button size="sm" onClick={() => setShowAdd(true)} icon={Plus}>Add Expense</Button>
          </div>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="text-[10px] text-text-muted font-body uppercase tracking-wider mb-1">Total Expenses</div>
          <div className="font-mono text-text-primary text-lg sm:text-xl font-bold">{formatNPR(totalExpenses)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[10px] text-text-muted font-body uppercase tracking-wider mb-1">Bank</div>
          <div className="font-mono text-blue-400 text-lg sm:text-xl font-bold">{formatNPR(totalBank)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[10px] text-text-muted font-body uppercase tracking-wider mb-1">Cash</div>
          <div className="font-mono text-yellow-400 text-lg sm:text-xl font-bold">{formatNPR(totalCash)}</div>
        </Card>
      </div>

      {/* Category breakdown */}
      {catSummary.length > 0 && (
        <Card className="p-4 sm:p-5">
          <h3 className="font-display font-bold text-text-primary text-xs sm:text-sm mb-4">Category Breakdown · {monthLabel}</h3>
          <div className="space-y-3 sm:space-y-2">
            {catSummary.map(([cat, amount]) => (
              <div key={cat} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                <span className="text-xs sm:text-sm font-body text-text-secondary w-full sm:w-40 truncate shrink-0">{cat}</span>
                <div className="flex-1 h-1.5 bg-bg-elevated rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all"
                    style={{ width: `${totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0}%` }}
                  />
                </div>
                <span className="font-mono text-text-primary text-xs sm:text-sm w-full sm:w-28 text-left sm:text-right shrink-0">{formatNPR(amount)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap">
        {['all', ...categories].map(c => (
          <button
            key={c}
            onClick={() => setFilterCat(c)}
            className={clsx(
              'px-3 py-1 rounded-full text-xs font-body border transition-all',
              filterCat === c
                ? 'bg-accent text-text-primary border-transparent'
                : 'border-border text-text-muted hover:text-text-primary hover:border-border-light'
            )}
          >
            {c === 'all' ? 'All categories' : c}
          </button>
        ))}
      </div>

      {/* Table */}
      <Card className="p-5">
        <h3 className="font-display font-bold text-text-primary text-sm mb-4">
          Transactions · {filtered.length} entries
        </h3>
        {filtered.length === 0 && !loading ? (
          <EmptyState
            icon={ArrowDownRight}
            title="No expenses recorded"
            description={`No expenses for ${monthLabel}. Add your first expense above.`}
          />
        ) : (
          <Table columns={columns} data={filtered} loading={loading} />
        )}
      </Card>

      {/* Add Expense Modal */}
      <Modal
        isOpen={showAdd}
        onClose={() => { setShowAdd(false); setForm(expenseForm()) }}
        title="Add Expense"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving} disabled={!form.amount || !form.date}>Save</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Date (AD)" type="date" value={form.date} onChange={e => set('date', e.target.value)} />
            <div className="flex flex-col gap-1">
              <label className="text-xs text-text-secondary font-body font-medium uppercase tracking-wider">BS Date</label>
              <div className="px-3 py-2 bg-bg-elevated border border-border rounded-lg text-sm font-body text-text-secondary">
                {form.date ? (() => {
                  const bs = bsFromDate(form.date)
                  return bs ? `${bs.day} ${bs.monthName} ${bs.year}` : '—'
                })() : '—'}
              </div>
            </div>
          </div>

          <Select label="Category" value={form.category} onChange={e => set('category', e.target.value)}>
            <option value="">Select category...</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </Select>

          {form.category === 'Car Loan EMI' && (
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <p className="text-xs text-blue-400 font-body">
                ✓ This will automatically log a payment in the Car Loan tracker.
              </p>
            </div>
          )}

          <Input label="Description" value={form.description} onChange={e => set('description', e.target.value)} placeholder="e.g. Office internet bill" />
          <Input label="Amount (NPR)" type="number" prefix="NPR" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0" />

          <div>
            <label className="text-xs text-text-secondary font-body font-medium uppercase tracking-wider block mb-2">Payment Source</label>
            <div className="flex gap-2">
              {['bank', 'cash'].map(s => (
                <button
                  key={s}
                  onClick={() => set('paymentSource', s)}
                  className={clsx(
                    'flex-1 py-2.5 rounded-xl text-sm font-body border capitalize transition-all',
                    form.paymentSource === s
                      ? 'bg-accent/10 border-accent text-accent'
                      : 'bg-bg-elevated border-border text-text-muted hover:text-text-primary'
                  )}
                >
                  {s === 'bank' ? '🏦 Bank' : '💵 Cash'}
                </button>
              ))}
            </div>
          </div>

          <Input label="Notes (optional)" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional details..." />
        </div>
      </Modal>

      {/* Cash Withdrawal Modal */}
      <Modal
        isOpen={showWithdraw}
        onClose={() => setShowWithdraw(false)}
        title="Withdraw Cash from Bank"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowWithdraw(false)}>Cancel</Button>
            <Button onClick={handleWithdraw} loading={saving} disabled={!withdrawForm.amount}>Confirm Withdrawal</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <p className="text-xs text-yellow-400 font-body">
              This will decrease your Bank balance and increase Cash in Hand by the same amount.
            </p>
          </div>
          <Input label="Date (AD)" type="date" value={withdrawForm.date} onChange={e => setWithdrawForm(f => ({ ...f, date: e.target.value }))} />
          <Input label="Amount (NPR)" type="number" prefix="NPR" value={withdrawForm.amount} onChange={e => setWithdrawForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" />
          <Input label="Notes (optional)" value={withdrawForm.notes} onChange={e => setWithdrawForm(f => ({ ...f, notes: e.target.value }))} />
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Expense"
        message="This will permanently remove this expense and affect your balance. Cannot be undone."
        confirmLabel="Delete"
      />
    </div>
  )
}
