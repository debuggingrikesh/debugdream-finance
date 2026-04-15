import { useState, useMemo } from 'react'
import { Plus, Lock, History, Wallet, CheckCircle, Trash2 } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useMyExpenses } from '../../hooks/useFirestore'
import { addDocument, updateDocument } from '../../firebase/firestore'
import { formatNPR } from '../../utils/formatUtils'
import { adToBS, BS_MONTHS, todayString, getTodayBoth } from '../../utils/dateUtils'
import { Card, SectionHeader, Button, Modal, Input, Select, Badge, Table, EmptyState } from '../../components/ui/index'
import clsx from 'clsx'

export default function MyExpenses() {
  const { settings } = useApp()
  const { months, currentMonth, entries, loading } = useMyExpenses()

  const [activeTab, setActiveTab] = useState('active')
  const [showAdd, setShowAdd] = useState(false)
  const [showClose, setShowClose] = useState(false)
  const [selectedHistory, setSelectedHistory] = useState(null)
  const [form, setForm] = useState({ date: todayString(), category: 'Food', amount: '', note: '' })
  const [reimbursementSource, setReimbursementSource] = useState('cash')
  const [saving, setSaving] = useState(false)

  const categories = settings?.myExpenseCategories || ['Food', 'Misc', 'Transport', 'Other']

  const { bs: todayBS } = getTodayBoth()
  const currentMonthKey = `${todayBS.year}-${String(todayBS.month).padStart(2, '0')}`

  // Active month entries
  const activeEntries = useMemo(() =>
    entries.filter(e => e.monthKey === currentMonth?.key),
    [entries, currentMonth]
  )

  const activeTotal = activeEntries.reduce((s, e) => s + (e.amount || 0), 0)

  // History month entries
  const historyEntries = useMemo(() =>
    entries.filter(e => e.monthKey === selectedHistory?.key),
    [entries, selectedHistory]
  )

  const bsFromDate = (dateStr) => {
    try { return adToBS(new Date(dateStr + 'T00:00:00')) } catch { return null }
  }

  // ── Ensure active month exists ────────────────────────────────────────────
  const ensureActiveMonth = async () => {
    if (!currentMonth) {
      await addDocument('myExpenseMonths', {
        key: currentMonthKey,
        bsYear: todayBS.year,
        bsMonth: todayBS.month,
        monthLabel: `${BS_MONTHS[todayBS.month - 1]} ${todayBS.year}`,
        status: 'open',
        total: 0,
      })
    }
  }

  // ── Add entry ─────────────────────────────────────────────────────────────
  const handleAdd = async () => {
    if (!form.amount || !form.date) return
    setSaving(true)
    await ensureActiveMonth()
    const bs = bsFromDate(form.date)
    try {
      await addDocument('myExpenses', {
        ...form,
        amount: parseFloat(form.amount) || 0,
        monthKey: currentMonthKey,
        bsYear: bs?.year,
        bsMonth: bs?.month,
        bsDay: bs?.day,
      })
      setShowAdd(false)
      setForm({ date: todayString(), category: 'Food', amount: '', note: '' })
    } finally {
      setSaving(false)
    }
  }

  // ── Close and reimburse ───────────────────────────────────────────────────
  const handleClose = async () => {
    if (!currentMonth) return
    setSaving(true)
    const bs = bsFromDate(todayString())
    try {
      // Create reimbursement expense in company expenses
      await addDocument('expenses', {
        date: todayString(),
        category: 'Personal Reimbursement – Rikesh',
        description: `Personal expense reimbursement — ${currentMonth.monthLabel}`,
        amount: activeTotal,
        paymentSource: reimbursementSource,
        bsYear: bs?.year,
        bsMonth: bs?.month,
        bsDay: bs?.day,
        bsMonthName: bs?.monthName,
        type: 'expense',
        notes: `Reimburses ${activeEntries.length} entries from ${currentMonth.monthLabel}`,
      })

      // Lock the month
      await updateDocument('myExpenseMonths', currentMonth.id, {
        status: 'closed',
        total: activeTotal,
        reimbursedDate: todayString(),
        reimbursementSource,
      })

      setShowClose(false)
    } finally {
      setSaving(false)
    }
  }

  const closedMonths = months.filter(m => m.status === 'closed').sort((a, b) => (b.key || '').localeCompare(a.key || ''))

  const activeColumns = [
    {
      header: 'Date',
      render: (row) => (
        <div>
          <div className="text-text-primary text-sm">{row.date}</div>
          <div className="text-text-muted text-xs">{row.bsDay} — {row.bsMonth}</div>
        </div>
      )
    },
    { header: 'Category', render: (row) => <Badge>{row.category}</Badge> },
    { header: 'Note', render: (row) => <span className="text-text-secondary text-sm">{row.note || '—'}</span> },
    { header: 'Amount', align: 'right', render: (row) => <span className="font-mono text-text-primary text-sm">{formatNPR(row.amount)}</span> },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      <SectionHeader title="My Expenses" subtitle="Rikesh's personal expense tracker & reimbursement" />

      {/* Tabs */}
      <div className="flex gap-1 bg-bg-surface border border-border rounded-xl p-1 w-fit">
        {[{ id: 'active', label: 'Active Month' }, { id: 'history', label: 'History' }].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-body transition-all',
              activeTab === tab.id ? 'bg-accent text-text-primary' : 'text-text-muted hover:text-text-primary'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'active' && (
        <>
          {/* Active month total */}
          <Card className="p-6 border-l-4 border-l-accent">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-text-muted font-body uppercase tracking-wider mb-1">
                  {currentMonth?.monthLabel || `${BS_MONTHS[todayBS.month - 1]} ${todayBS.year}`} — Total Spent
                </div>
                <div className="font-mono text-text-primary text-3xl font-bold">{formatNPR(activeTotal)}</div>
                <div className="text-xs text-text-muted font-body mt-1">{activeEntries.length} entries · Pending reimbursement</div>
              </div>
              <div className="flex flex-col gap-2">
                <Button onClick={() => setShowAdd(true)} icon={Plus}>Add Expense</Button>
                {activeEntries.length > 0 && (
                  <Button variant="secondary" onClick={() => setShowClose(true)} icon={Lock}>
                    Close & Reimburse
                  </Button>
                )}
              </div>
            </div>
          </Card>

          {/* Entries */}
          <Card className="p-5">
            <h3 className="font-display font-bold text-text-primary text-sm mb-4">This Month's Entries</h3>
            {activeEntries.length === 0 ? (
              <EmptyState
                icon={Wallet}
                title="No expenses yet"
                description="Track personal expenses you pay on behalf of the company. You'll reimburse yourself at month end."
                action={<Button onClick={() => setShowAdd(true)} icon={Plus}>Add First Entry</Button>}
              />
            ) : (
              <Table columns={activeColumns} data={activeEntries} />
            )}
          </Card>
        </>
      )}

      {activeTab === 'history' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Month list */}
          <Card className="p-4">
            <h3 className="font-display font-bold text-text-primary text-sm mb-3">Closed Months</h3>
            {closedMonths.length === 0 ? (
              <p className="text-text-muted text-sm font-body text-center py-6">No closed months yet</p>
            ) : (
              <div className="space-y-1">
                {closedMonths.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedHistory(m)}
                    className={clsx(
                      'w-full flex items-center justify-between p-2.5 rounded-xl transition-all font-body text-sm',
                      selectedHistory?.id === m.id
                        ? 'bg-accent/10 text-accent'
                        : 'text-text-secondary hover:bg-bg-elevated hover:text-text-primary'
                    )}
                  >
                    <span>{m.monthLabel}</span>
                    <span className="font-mono">{formatNPR(m.total)}</span>
                  </button>
                ))}
              </div>
            )}
          </Card>

          {/* Month detail */}
          <div className="lg:col-span-2">
            {selectedHistory ? (
              <Card className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-display font-bold text-text-primary text-base">{selectedHistory.monthLabel}</h3>
                    <div className="text-xs text-green-400 font-body flex items-center gap-1 mt-0.5">
                      <CheckCircle size={10} /> Reimbursed via {selectedHistory.reimbursementSource}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-text-muted">Total Reimbursed</div>
                    <div className="font-mono text-text-primary text-xl font-bold">{formatNPR(selectedHistory.total)}</div>
                  </div>
                </div>
                <Table columns={activeColumns} data={historyEntries} emptyMessage="No entries for this month" />
              </Card>
            ) : (
              <Card className="p-8 flex items-center justify-center">
                <p className="text-text-muted text-sm font-body">Select a month to view details</p>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Add expense modal */}
      <Modal
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        title="Add Personal Expense"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAdd} loading={saving} disabled={!form.amount}>Save</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Date (AD)" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          <Select label="Category" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </Select>
          <Input label="Amount (NPR)" type="number" prefix="NPR" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
          <Input label="Note" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="What was this for?" />
        </div>
      </Modal>

      {/* Close month modal */}
      <Modal
        isOpen={showClose}
        onClose={() => setShowClose(false)}
        title="Close Month & Reimburse"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowClose(false)}>Cancel</Button>
            <Button onClick={handleClose} loading={saving} variant="success">Confirm Reimbursement</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="p-4 bg-bg-elevated rounded-xl text-center">
            <div className="text-xs text-text-muted font-body mb-1">Total to reimburse</div>
            <div className="font-mono text-text-primary text-2xl font-bold">{formatNPR(activeTotal)}</div>
            <div className="text-xs text-text-muted mt-1">{activeEntries.length} entries</div>
          </div>
          <div>
            <label className="text-xs text-text-secondary font-body font-medium uppercase tracking-wider block mb-2">Reimbursement Source</label>
            <div className="flex gap-2">
              {['bank', 'cash'].map(s => (
                <button key={s} onClick={() => setReimbursementSource(s)}
                  className={clsx('flex-1 py-2.5 rounded-xl text-sm font-body border capitalize transition-all',
                    reimbursementSource === s ? 'bg-accent/10 border-accent text-accent' : 'bg-bg-elevated border-border text-text-muted'
                  )}>
                  {s === 'bank' ? '🏦 Bank' : '💵 Cash'}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-text-muted font-body">
            This will create a "Personal Reimbursement – Rikesh" entry in Company Expenses and lock this month as read-only.
          </p>
        </div>
      </Modal>
    </div>
  )
}
