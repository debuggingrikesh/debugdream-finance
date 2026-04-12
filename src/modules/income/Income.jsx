import { useState, useMemo } from 'react'
import { Plus, Download, ArrowUpRight, Trash2, Link } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useAllIncome, useInvoices } from '../../hooks/useFirestore'
import { addDocument, updateDocument, deleteDocument } from '../../firebase/firestore'
import { formatNPR } from '../../utils/formatUtils'
import { adToBS, formatDualDate, BS_MONTHS, todayString } from '../../utils/dateUtils'
import {
  Card, SectionHeader, Button, Modal, Input, Select, Badge,
  Table, ConfirmDialog, EmptyState, Amount, SourceBadge
} from '../../components/ui/index'
import clsx from 'clsx'

const DEFAULT_CLIENTS = ['VXL', 'Shristi', 'Other']

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
    const set = new Set([...DEFAULT_CLIENTS, ...allIncome.map(t => t.clientName).filter(Boolean)])
    return [...set]
  }, [allIncome])

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
      ['Date AD', 'BS Date', 'Client', 'Description', 'Amount NPR', 'Source', 'Invoice'],
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
          <div className="text-white text-sm font-body">{row.date}</div>
          <div className="text-[#444] text-xs">{row.bsDay} {row.bsMonthName} {row.bsYear}</div>
        </div>
      )
    },
    {
      header: 'Client',
      render: (row) => <span className="font-body text-white text-sm">{row.clientName || '—'}</span>
    },
    {
      header: 'Description',
      render: (row) => <span className="text-[#888] text-sm font-body truncate max-w-[180px] block">{row.description || '—'}</span>
    },
    {
      header: 'Source',
      render: (row) => <SourceBadge source={row.paymentSource} />
    },
    {
      header: 'Amount',
      align: 'right',
      render: (row) => <span className="font-mono text-green-400 text-sm">+{formatNPR(row.amount)}</span>
    },
    {
      header: '',
      render: (row) => (
        <button
          onClick={e => { e.stopPropagation(); setDeleteId(row.id) }}
          className="w-7 h-7 rounded-lg hover:bg-red-500/10 flex items-center justify-center text-[#333] hover:text-red-400 transition-colors"
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
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="text-xs text-[#555] font-body uppercase tracking-wider mb-1">Total Income</div>
          <div className="font-mono text-white text-xl font-bold">{formatNPR(totalIncome)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-[#555] font-body uppercase tracking-wider mb-1">Bank</div>
          <div className="font-mono text-blue-400 text-xl font-bold">{formatNPR(totalBank)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-[#555] font-body uppercase tracking-wider mb-1">Cash</div>
          <div className="font-mono text-yellow-400 text-xl font-bold">{formatNPR(totalCash)}</div>
        </Card>
      </div>

      {/* Client filter pills */}
      <div className="flex gap-2 flex-wrap">
        {['all', ...clients].map(c => (
          <button
            key={c}
            onClick={() => setFilterClient(c)}
            className={clsx(
              'px-3 py-1 rounded-full text-xs font-body border transition-all',
              filterClient === c
                ? 'bg-[#E8192C] text-white border-transparent'
                : 'border-[#2a2a2a] text-[#555] hover:text-white hover:border-[#444]'
            )}
          >
            {c === 'all' ? 'All clients' : c}
          </button>
        ))}
      </div>

      {/* Client summary */}
      {clientSummary.length > 0 && (
        <Card className="p-5">
          <h3 className="font-display font-bold text-white text-sm mb-4">Client Summary · {monthLabel}</h3>
          <div className="space-y-2">
            {clientSummary.map(([client, amount]) => (
              <div key={client} className="flex items-center gap-3">
                <span className="text-sm font-body text-[#888] w-24 truncate">{client}</span>
                <div className="flex-1 h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#E8192C] rounded-full"
                    style={{ width: `${totalIncome > 0 ? (amount / totalIncome) * 100 : 0}%` }}
                  />
                </div>
                <span className="font-mono text-white text-sm w-28 text-right">{formatNPR(amount)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Transactions table ─────────────────────────────────────────────── */}
      <Card className="p-5">
        <h3 className="font-display font-bold text-white text-sm mb-4">
          Transactions · {filtered.length} entries
        </h3>
        {filtered.length === 0 && !loading ? (
          <EmptyState
            icon={ArrowUpRight}
            title="No income recorded"
            description={`No income entries for ${monthLabel}. Add your first income entry above.`}
          />
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
              <label className="text-xs text-[#888] font-body font-medium uppercase tracking-wider">BS Date</label>
              <div className="px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-sm font-body text-[#888]">
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
          <Input label="Amount (NPR)" type="number" prefix="NPR" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0" />

          {/* Payment source */}
          <div>
            <label className="text-xs text-[#888] font-body font-medium uppercase tracking-wider block mb-2">Payment Received Via</label>
            <div className="flex gap-2">
              {['bank', 'cash'].map(s => (
                <button
                  key={s}
                  onClick={() => set('paymentSource', s)}
                  className={clsx(
                    'flex-1 py-2.5 rounded-xl text-sm font-body border capitalize transition-all',
                    form.paymentSource === s
                      ? 'bg-[#E8192C]/10 border-[#E8192C] text-[#E8192C]'
                      : 'bg-[#1a1a1a] border-[#2a2a2a] text-[#555] hover:text-white'
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
