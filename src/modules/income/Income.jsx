import { useState, useMemo } from 'react'
import { Plus, Download, ArrowUpRight, Trash2, Link } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useAllIncome, useInvoices, useClients } from '../../hooks/useFirestore'
import { addDocument, updateDocument, deleteDocument } from '../../firebase/firestore'
import { formatNPR } from '../../utils/formatUtils'
import { adToBS, formatDualDate, BS_MONTHS, todayString } from '../../utils/dateUtils'
import {
  Card, SectionHeader, Button, Modal, Input, Select, Badge,
  Table, ConfirmDialog, EmptyState, Amount, SourceBadge
} from '../../components/ui/index'
import clsx from 'clsx'

// Clients are now loaded from Firestore via useClients()

function incomeForm() {
  return {
    date: todayString(),
    clientName: '',
    description: '',
    amount: '',
    paymentSource: 'bank',
    linkedInvoice: '',
    notes: '',
  }
}

export default function Income() {
  const { selectedMonth } = useApp()
  const { data: allIncome, loading } = useAllIncome()
  const { data: invoices } = useInvoices()
  const { data: clientsData } = useClients()

  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(incomeForm())
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [filterClient, setFilterClient] = useState('all')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Auto-compute BS when AD date changes
  const handleDateChange = (dateStr) => {
    set('date', dateStr)
  }

  const bsFromDate = (dateStr) => {
    if (!dateStr) return null
    try { return adToBS(new Date(dateStr + 'T00:00:00')) }
    catch { return null }
  }

  // ── Filter to selected month ──────────────────────────────────────────────
  const monthIncome = useMemo(() => {
    if (!selectedMonth) return allIncome
    return allIncome.filter(t => t.bsYear === selectedMonth.year && t.bsMonth === selectedMonth.month)
  }, [allIncome, selectedMonth])

  const filtered = useMemo(() => {
    if (filterClient === 'all') return monthIncome
    return monthIncome.filter(t => t.clientName === filterClient)
  }, [monthIncome, filterClient])

  const totalIncome = monthIncome.reduce((s, t) => s + (t.amount || 0), 0)
  const totalBank = monthIncome.filter(t => t.paymentSource === 'bank').reduce((s, t) => s + (t.amount || 0), 0)
  const totalCash = monthIncome.filter(t => t.paymentSource === 'cash').reduce((s, t) => s + (t.amount || 0), 0)

  // Per-client summary
  const clientSummary = useMemo(() => {
    const map = {}
    monthIncome.forEach(t => {
      const c = t.clientName || 'Other'
      map[c] = (map[c] || 0) + (t.amount || 0)
    })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [monthIncome])

  const clients = useMemo(() => {
    const set = new Set([...clientsData.map(c => c.name), ...allIncome.map(t => t.clientName).filter(Boolean)])
    return [...set]
  }, [allIncome, clientsData])

  // ── Save ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.amount || !form.date) return
    setSaving(true)
    const bs = bsFromDate(form.date)
    try {
      await addDocument('income', {
        ...form,
        amount: parseFloat(form.amount) || 0,
        bsYear: bs?.year,
        bsMonth: bs?.month,
        bsDay: bs?.day,
        bsMonthName: bs?.monthName,
      })
      setShowAdd(false)
      setForm(incomeForm())
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    await deleteDocument('income', deleteId)
    setDeleteId(null)
  }

  // ── Export CSV ─────────────────────────────────────────────────────────────
  const exportCSV = () => {
    const rows = [
      ['Date AD', 'BS Date', 'Client', 'Description', 'Amount (NPR Eq.)', 'Source', 'Invoice'],
      ...filtered.map(t => [
        t.date, `${t.bsDay} ${t.bsMonthName} ${t.bsYear}`,
        t.clientName, t.description, t.amount, t.paymentSource, t.linkedInvoice || ''
      ])
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `income-${selectedMonth?.year}-${selectedMonth?.month}.csv`
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
      header: 'Client',
      render: (row) => <span className="font-body text-text-primary text-sm">{row.clientName || '—'}</span>
    },
    {
      header: 'Description',
      render: (row) => <span className="text-text-secondary text-sm font-body truncate max-w-[180px] block">{row.description || '—'}</span>
    },
    {
      header: 'Source',
      render: (row) => <SourceBadge source={row.paymentSource} />
    },
    {
      header: 'Amount (NPR)',
      align: 'right',
      render: (row) => (
        <div className="flex flex-col items-end">
          <span className="font-mono text-green-400 text-sm">+{formatNPR(row.amount)}</span>
          {row.originalCurrency && row.originalCurrency !== 'NPR' && (
            <span className="text-[10px] text-text-muted font-mono">
              ~ {row.originalCurrency} {row.originalAmount}
            </span>
          )}
        </div>
      )
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
        title="Income"
        subtitle={monthLabel}
        action={
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={exportCSV} icon={Download}>Export</Button>
            <Button size="sm" onClick={() => setShowAdd(true)} icon={Plus}>Add Income</Button>
          </div>
        }
      />

      {/* ── Summary cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3 md:gap-4">
        <Card className="p-4 md:p-5 glass-card group">
          <div className="text-[10px] text-text-muted font-display uppercase tracking-widest mb-2 group-hover:text-accent transition-colors">Total Income</div>
          <div className="font-mono text-text-primary text-xl md:text-2xl font-bold leading-none">{formatNPR(totalIncome)}</div>
          <div className="w-full h-1 bg-accent/10 mt-3 rounded-full overflow-hidden">
            <div className="h-full bg-accent w-full" />
          </div>
        </Card>
        <Card className="p-4 md:p-5 glass-card group">
          <div className="text-[10px] text-text-muted font-display uppercase tracking-widest mb-2 group-hover:text-blue-400 transition-colors">Bank Ledger</div>
          <div className="font-mono text-blue-400 text-xl md:text-2xl font-bold leading-none">{formatNPR(totalBank)}</div>
          <div className="w-full h-1 bg-blue-400/10 mt-3 rounded-full overflow-hidden">
            <div className="h-full bg-blue-400" style={{ width: `${totalIncome > 0 ? (totalBank / totalIncome) * 100 : 0}%` }} />
          </div>
        </Card>
        <Card className="p-4 md:p-5 glass-card group">
          <div className="text-[10px] text-text-muted font-display uppercase tracking-widest mb-2 group-hover:text-yellow-400 transition-colors">Cash Ledger</div>
          <div className="font-mono text-yellow-400 text-xl md:text-2xl font-bold leading-none">{formatNPR(totalCash)}</div>
          <div className="w-full h-1 bg-yellow-400/10 mt-3 rounded-full overflow-hidden">
            <div className="h-full bg-yellow-400" style={{ width: `${totalIncome > 0 ? (totalCash / totalIncome) * 100 : 0}%` }} />
          </div>
        </Card>
      </div>

      {/* Client filter pills */}
      <div className="flex gap-2 flex-wrap">
        {['all', ...clients].map(c => (
          <button
            key={c}
            onClick={() => setFilterClient(c)}
            className={clsx(
              'px-4 py-1.5 rounded-xl text-xs font-display font-medium border transition-all duration-200',
              filterClient === c
                ? 'bg-accent text-text-primary border-accent shadow-lg shadow-accent/20'
                : 'bg-white/5 border-white/5 text-text-secondary hover:text-text-primary hover:border-white/10 hover:bg-white/10'
            )}
          >
            {c === 'all' ? 'All Clients' : c}
          </button>
        ))}
      </div>

      {/* Client summary */}
      {clientSummary.length > 0 && (
        <Card className="p-5 glass-card">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-display font-bold text-text-primary text-sm tracking-tight">Client Revenue Distribution</h3>
            <span className="text-[10px] text-text-muted font-mono uppercase">{monthLabel}</span>
          </div>
          <div className="space-y-4">
            {clientSummary.map(([client, amount]) => (
              <div key={client} className="group cursor-default">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-body text-text-secondary font-medium group-hover:text-text-primary transition-colors">{client}</span>
                  <span className="font-mono text-text-primary text-xs font-bold">{formatNPR(amount)}</span>
                </div>
                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden ring-1 ring-white/[0.02]">
                  <div
                    className="h-full bg-accent rounded-full transition-all duration-700 ease-out group-hover:shadow-[0_0_10px_#E8192C]"
                    style={{ width: `${totalIncome > 0 ? (amount / totalIncome) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Transactions table ─────────────────────────────────────────────── */}
      <Card className="p-0 overflow-hidden glass-card border-none ring-1 ring-white/5">
        <div className="p-5 border-b border-white/5 flex items-center justify-between">
          <h3 className="font-display font-bold text-text-primary text-sm tracking-tight">
            Transaction Ledger
          </h3>
          <span className="text-[10px] text-text-muted font-mono uppercase tracking-widest">{filtered.length} entries</span>
        </div>
        {filtered.length === 0 && !loading ? (
          <div className="p-10">
            <EmptyState
              icon={ArrowUpRight}
              title="No income recorded"
              description={`No income entries for ${monthLabel}. Add your first income entry above.`}
            />
          </div>
        ) : (
          <Table columns={columns} data={filtered} loading={loading} />
        )}
      </Card>

      {/* ── Add Income Modal ───────────────────────────────────────────────── */}
      <Modal
        isOpen={showAdd}
        onClose={() => { setShowAdd(false); setForm(incomeForm()) }}
        title="Add Income"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving} disabled={!form.amount || !form.date}>Save</Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Date */}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Date (AD)" type="date" value={form.date} onChange={e => handleDateChange(e.target.value)} />
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

          {/* Client */}
          <div>
            <Select
              label="Client"
              value={form.clientName}
              onChange={e => set('clientName', e.target.value)}
            >
              <option value="">Select client...</option>
              {clients.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>

          {/* Description */}
          <Input label="Description / Notes" value={form.description} onChange={e => set('description', e.target.value)} placeholder="e.g. Monthly retainer payment" />

          {/* Amount */}
          <Input label="Amount (NPR Equivalent)" type="number" prefix="NPR" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0" />

          {/* Payment source */}
          <div>
            <label className="text-xs text-text-secondary font-body font-medium uppercase tracking-wider block mb-2">Payment Received Via</label>
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

          {/* Linked invoice */}
          {invoices.length > 0 && (
            <Select label="Link to Invoice (optional)" value={form.linkedInvoice} onChange={e => set('linkedInvoice', e.target.value)}>
              <option value="">None</option>
              {invoices.filter(i => i.status !== 'Paid').map(inv => (
                <option key={inv.id} value={inv.id}>{inv.invoiceNumber} — {inv.clientName}</option>
              ))}
            </Select>
          )}
        </div>
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Income Entry"
        message="This will permanently remove this income entry and affect your balance. Cannot be undone."
        confirmLabel="Delete"
      />
    </div>
  )
}
