import { useState, useMemo } from 'react'
import { Plus, Lock, History, Wallet, CheckCircle, Trash2, Edit2 } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useMyExpenses } from '../../hooks/useFirestore'
import { addDocument, updateDocument, deleteDocument, batchWrite } from '../../firebase/firestore'
import { formatNPR } from '../../utils/formatUtils'
import { adToBS, BS_MONTHS, todayString, getTodayBoth, formatAD } from '../../utils/dateUtils'
import { Card, SectionHeader, Button, Modal, Input, Select, Badge, Table, EmptyState } from '../../components/ui/index'
import clsx from 'clsx'

export default function MyExpenses() {
  const { settings } = useApp()
  const { months, currentMonth, entries, loading } = useMyExpenses()

  const [activeTab, setActiveTab] = useState('active')
  const [showAdd, setShowAdd] = useState(false)
  const [showClose, setShowClose] = useState(false)
  const [selectedHistory, setSelectedHistory] = useState(null)
  const [editingEntry, setEditingEntry] = useState(null)
  const [form, setForm] = useState({ date: todayString(), category: 'Food', amount: '', note: '' })
  const [reimbursementSource, setReimbursementSource] = useState('cash')
  const [saving, setSaving] = useState(false)

  const categories = settings?.myExpenseCategories || ['Food', 'Misc', 'Transport', 'Other']

  const { bs: todayBS } = getTodayBoth()
  const currentMonthKey = `${todayBS.year}-${String(todayBS.month).padStart(2, '0')}`

  // Active month entries - Show ALL entries linked to any OPEN month record
  const activeEntries = useMemo(() => {
    const openMonths = months.filter(m => m.status === 'open')
    const openIds = openMonths.map(m => m.id)
    const openKeys = openMonths.map(m => m.key)

    return entries.filter(e => {
      // 1. If tied to an open month ID, show it
      if (e.monthId && openIds.includes(e.monthId)) return true
      
      // 2. If legacy (no ID), show if key matches any open month
      if (!e.monthId && openKeys.includes(e.monthKey)) return true
      
      return false
    })
  }, [entries, months])

  const activeTotal = activeEntries.reduce((s, e) => s + (e.amount || 0), 0)

  // History month entries
  const historyEntries = useMemo(() =>
    entries.filter(e => {
      if (!selectedHistory) return false
      // If entry has an ID, it MUST match the selected history month ID
      if (e.monthId) return e.monthId === selectedHistory.id
      // For legacy entries (no ID), fallback to monthKey matching
      return e.monthKey === selectedHistory.key
    }),
    [entries, selectedHistory]
  )

  const bsFromDate = (dateStr) => {
    try { return adToBS(new Date(dateStr + 'T00:00:00')) } catch { return null }
  }

  // ── Ensure active month exists ────────────────────────────────────────────
  const ensureActiveMonth = async (targetKey, bsInfo) => {
    // Look for an existing open month with this key first
    const existing = months.find(m => m.key === targetKey && m.status === 'open')
    if (existing) return existing.id

    // Otherwise create a new one for that specific month
    return await addDocument('myExpenseMonths', {
      key: targetKey,
      bsYear: bsInfo?.year || todayBS.year,
      bsMonth: bsInfo?.month || todayBS.month,
      monthLabel: `${BS_MONTHS[(bsInfo?.month || todayBS.month) - 1]} ${bsInfo?.year || todayBS.year}`,
      status: 'open',
      total: 0,
    })
  }

  // ── Add/Update entry ──────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.amount || !form.date) return
    setSaving(true)
    try {
      const bs = bsFromDate(form.date)
      const data = {
        ...form,
        amount: parseFloat(form.amount) || 0,
        bsYear: bs?.year,
        bsMonth: bs?.month,
        bsDay: bs?.day,
      }

      if (editingEntry) {
        await updateDocument('myExpenses', editingEntry.id, data)
      } else {
        // Link to the month based on the EXPENSE DATE, not today's date
        const entryMonthKey = bs ? `${bs.year}-${String(bs.month).padStart(2, '0')}` : currentMonthKey
        const monthId = await ensureActiveMonth(entryMonthKey, bs)
        
        await addDocument('myExpenses', {
          ...data,
          monthKey: entryMonthKey,
          monthId,
        })
      }
      
      setShowAdd(false)
      setEditingEntry(null)
      setForm({ date: todayString(), category: 'Food', amount: '', note: '' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this entry?')) return
    try {
      await deleteDocument('myExpenses', id)
    } catch (err) { console.error(err) }
  }

  const openEdit = (entry) => {
    setEditingEntry(entry)
    setForm({ date: entry.date, category: entry.category, amount: entry.amount, note: entry.note })
    setShowAdd(true)
  }

  // ── Close and reimburse ───────────────────────────────────────────────────
  const handleClose = async () => {
    // If we have open months, we prioritize the oldest one to close first
    const monthToClose = months.find(m => m.status === 'open')
    if (!monthToClose) return

    setSaving(true)
    const bs = bsFromDate(todayString())
    try {
      const ops = []

      // Calculate the REAL total for the specific month we are closing
      // (This prevents using the Baisakh total for a Chaitra closure)
      const entriesToSeal = entries.filter(e => e.monthKey === monthToClose.key)
      const totalToReimburse = entriesToSeal.reduce((s, e) => s + (e.amount || 0), 0)

      // 1. Create reimbursement expense in company expenses
      ops.push({
        type: 'set',
        collectionName: 'expenses',
        data: {
          date: todayString(),
          category: 'Personal Reimbursement – Rikesh',
          description: `Personal expense reimbursement — ${monthToClose.monthLabel}`,
          amount: totalToReimburse,
          paymentSource: reimbursementSource,
          bsYear: bs?.year,
          bsMonth: bs?.month,
          bsDay: bs?.day,
          bsMonthName: bs?.monthName,
          type: 'expense',
          notes: `Reimburses ${entriesToSeal.length} entries from ${monthToClose.monthLabel}`,
          myExpenseMonthId: monthToClose.id, // Reference for tracking
        }
      })

      // 2. Identify all open month records for this specific month key and close them
      const relatedOpenMonths = months.filter(m => m.key === monthToClose.key && m.status === 'open')
      relatedOpenMonths.forEach(m => {
        ops.push({
          type: 'update',
          collectionName: 'myExpenseMonths',
          id: m.id,
          data: {
            status: 'closed',
            total: m.id === monthToClose.id ? totalToReimburse : 0,
            reimbursedDate: todayString(),
            reimbursementSource,
          }
        })
      })

      // 3. Nuclear Seal: Force all entries matching this monthKey to have the master monthId.
      // This is what prevents them from 're-appearing' later.
      entriesToSeal.forEach(entry => {
        // Even if they already have an ID, we update it to the master ID to be safe
        ops.push({
          type: 'update',
          collectionName: 'myExpenses',
          id: entry.id,
          data: { monthId: monthToClose.id }
        })
      })

      await batchWrite(ops)

      setShowClose(false)
      setActiveTab('history')
      setSelectedHistory({ ...monthToClose, status: 'closed', total: totalToReimburse })
    } finally {
      setSaving(false)
    }
  }

  const closedMonths = months.filter(m => m.status === 'closed').sort((a, b) => (b.key || '').localeCompare(a.key || ''))

  const formatMonthKey = (label, key) => {
    if (label && !label.match(/^\d{4}-\d{2}$/)) return label
    if (!key) return label
    const [y, m] = key.split('-')
    const mNum = parseInt(m, 10)
    if (!isNaN(mNum) && mNum >= 1 && mNum <= 12) return `${BS_MONTHS[mNum - 1]} ${y}`
    return label || key
  }

  const activeColumns = [
    {
      header: 'Date',
      render: (row) => {
        const bsMonthName = row.bsMonth ? BS_MONTHS[row.bsMonth - 1] : ''
        const adFormatted = row.date ? formatAD(row.date) : ''
        return (
          <div>
            <div className="text-text-primary text-sm font-medium">
              {row.bsDay} {bsMonthName} {row.bsYear}
            </div>
            <div className="text-text-muted text-xs">{adFormatted}</div>
          </div>
        )
      }
    },
    { header: 'Category', render: (row) => <Badge>{row.category}</Badge> },
    { header: 'Note', render: (row) => <span className="text-text-secondary text-sm">{row.note || '—'}</span> },
    { header: 'Amount', align: 'right', render: (row) => <span className="font-mono text-text-primary text-sm">{formatNPR(row.amount)}</span> },
    {
      header: '',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <button 
            onClick={() => openEdit(row)} 
            className="p-1.5 rounded-lg text-text-muted hover:text-accent hover:bg-accent/10 transition-colors"
            title="Edit"
          >
            <Edit2 size={14} />
          </button>
          <button 
            onClick={() => handleDelete(row.id)} 
            className="p-1.5 rounded-lg text-text-muted hover:text-status-error hover:bg-status-error/10 transition-colors"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )
    },
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
                  {/* Show the label of the specific month we are currently seeing in the list */}
                  {(months.find(m => m.status === 'open')?.monthLabel) || `${BS_MONTHS[todayBS.month - 1]} ${todayBS.year}`} — Total Spent
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
                action={<Button onClick={() => { setEditingEntry(null); setShowAdd(true); }} icon={Plus}>Add First Entry</Button>}
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
                    <span>{formatMonthKey(m.monthLabel, m.key)}</span>
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
                    <h3 className="font-display font-bold text-text-primary text-base">{formatMonthKey(selectedHistory.monthLabel, selectedHistory.key)}</h3>
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
        onClose={() => { setShowAdd(false); setEditingEntry(null); }}
        title={editingEntry ? "Edit Expense" : "Add Personal Expense"}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setShowAdd(false); setEditingEntry(null); }}>Cancel</Button>
            <Button onClick={handleSave} loading={saving} disabled={!form.amount}>
              {editingEntry ? "Update" : "Save"}
            </Button>
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
