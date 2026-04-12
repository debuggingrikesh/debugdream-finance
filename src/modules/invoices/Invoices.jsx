import { useState, useMemo } from 'react'
import { Plus, FileText, Send, CheckCircle, Clock, AlertCircle, Download, Trash2, Pencil } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useInvoices } from '../../hooks/useFirestore'
import { addDocument, updateDocument, deleteDocument } from '../../firebase/firestore'
import { formatNPR, formatByCurrency, generateInvoiceNumber } from '../../utils/formatUtils'
import { adToBS, BS_MONTHS, todayString } from '../../utils/dateUtils'
import { generateInvoicePDF } from '../../utils/pdfUtils'
import {
  Card, SectionHeader, Button, Modal, Input, Select, Badge,
  ConfirmDialog, EmptyState, Textarea
} from '../../components/ui/index'
import clsx from 'clsx'

const STATUS_CONFIG = {
  Draft:   { color: 'warning', icon: Clock },
  Sent:    { color: 'info', icon: Send },
  Paid:    { color: 'success', icon: CheckCircle },
  Overdue: { color: 'danger', icon: AlertCircle },
}

const DEFAULT_CLIENTS = [
  { name: 'VXL', currency: 'NPR' },
  { name: 'Shristi', currency: 'AUD', recurring: true, recurringAmount: 550 },
]

function emptyInvoice(bsYear) {
  return {
    clientName: '',
    clientAddress: '',
    invoiceDate: todayString(),
    dueDate: '',
    currency: 'NPR',
    lineItems: [{ description: '', qty: 1, rate: '' }],
    notes: 'Payment via bank transfer.\nAccount: DebugDream · Bank: [Bank Name] · Account No: [Account]',
    status: 'Draft',
  }
}

export default function Invoices() {
  const { settings } = useApp()
  const { data: invoices, loading, add: addInvoice, update: updateInvoice, remove: removeInvoice } = useInvoices()

  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(emptyInvoice())
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterClient, setFilterClient] = useState('all')
  const [showDetail, setShowDetail] = useState(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const openAdd = () => {
    setEditId(null)
    setForm(emptyInvoice())
    setShowForm(true)
  }

  const openEdit = (inv) => {
    setEditId(inv.id)
    setForm({ ...inv })
    setShowForm(true)
  }

  // ── Line items ─────────────────────────────────────────────────────────────
  const setLineItem = (i, k, v) => {
    const items = [...form.lineItems]
    items[i] = { ...items[i], [k]: v }
    set('lineItems', items)
  }
  const addLineItem = () => set('lineItems', [...form.lineItems, { description: '', qty: 1, rate: '' }])
  const removeLineItem = (i) => set('lineItems', form.lineItems.filter((_, idx) => idx !== i))

  const subtotal = form.lineItems.reduce((s, item) => s + ((item.qty || 1) * (parseFloat(item.rate) || 0)), 0)

  // ── Generate invoice number ────────────────────────────────────────────────
  const nextInvoiceNumber = useMemo(() => {
    const bs = adToBS(new Date())
    const count = invoices.filter(i => i.invoiceDate?.includes(new Date().getFullYear().toString())).length
    return generateInvoiceNumber(bs.year, count + 1)
  }, [invoices])

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true)
    const bs = adToBS(new Date(form.invoiceDate + 'T00:00:00'))
    const data = {
      ...form,
      total: subtotal,
      lineItems: form.lineItems.map(item => ({
        ...item,
        qty: parseFloat(item.qty) || 1,
        rate: parseFloat(item.rate) || 0,
        amount: (parseFloat(item.qty) || 1) * (parseFloat(item.rate) || 0),
      })),
      bsYear: bs.year,
      bsMonth: bs.month,
    }
    try {
      if (editId) {
        await updateInvoice(editId, data)
      } else {
        await addInvoice({ ...data, invoiceNumber: nextInvoiceNumber })
      }
      setShowForm(false)
    } finally {
      setSaving(false)
    }
  }

  // ── Status updates ────────────────────────────────────────────────────────
  const markSent = async (inv) => {
    await updateInvoice(inv.id, { status: 'Sent', sentDate: todayString() })
  }

  const markPaid = async (inv) => {
    await updateInvoice(inv.id, { status: 'Paid', paidDate: todayString() })
    // Optionally could auto-create income entry here
  }

  const handleDelete = async () => {
    if (deleteId) {
      await removeInvoice(deleteId)
      setDeleteId(null)
    }
  }

  // ── Generate PDF ──────────────────────────────────────────────────────────
  const handlePDF = (inv) => {
    const company = settings?.company || {}
    generateInvoicePDF(inv, company, settings?.logoBase64)
  }

  // ── Filter ────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return invoices
      .filter(i => filterStatus === 'all' || i.status === filterStatus)
      .filter(i => filterClient === 'all' || i.clientName === filterClient)
      .sort((a, b) => (b.invoiceDate || '').localeCompare(a.invoiceDate || ''))
  }, [invoices, filterStatus, filterClient])

  const clients = useMemo(() => {
    const set = new Set([...DEFAULT_CLIENTS.map(c => c.name), ...invoices.map(i => i.clientName).filter(Boolean)])
    return [...set]
  }, [invoices])

  const outstanding = invoices.filter(i => i.status === 'Sent' || i.status === 'Overdue')
  const totalOutstanding = outstanding.reduce((s, i) => s + (i.total || 0), 0)

  return (
    <div className="space-y-6 animate-fade-in">
      <SectionHeader
        title="Invoices"
        subtitle={`${invoices.length} total · ${outstanding.length} outstanding`}
        action={
          <Button size="sm" onClick={openAdd} icon={Plus}>New Invoice</Button>
        }
      />

      {/* Summary */}
      <div className="grid grid-cols-4 gap-3">
        {['Draft', 'Sent', 'Paid', 'Overdue'].map(status => {
          const { color } = STATUS_CONFIG[status]
          const count = invoices.filter(i => i.status === status).length
          const total = invoices.filter(i => i.status === status).reduce((s, i) => s + (i.total || 0), 0)
          return (
            <Card key={status} className={clsx('p-4 cursor-pointer', filterStatus === status && 'border-[#E8192C]')} hover onClick={() => setFilterStatus(filterStatus === status ? 'all' : status)}>
              <Badge variant={color}>{status}</Badge>
              <div className="mt-2 font-mono text-white text-lg font-bold">{count}</div>
              <div className="text-xs text-[#444] font-mono">{formatNPR(total)}</div>
            </Card>
          )
        })}
      </div>

      {/* Filters */}
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

      {/* Invoice list */}
      <div className="space-y-2">
        {loading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-20 bg-[#111] rounded-xl animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={FileText} title="No invoices" description="Create your first invoice above." action={<Button onClick={openAdd} icon={Plus}>New Invoice</Button>} />
        ) : (
          filtered.map(inv => {
            const { color, icon: StatusIcon } = STATUS_CONFIG[inv.status] || STATUS_CONFIG.Draft
            return (
              <Card key={inv.id} className="p-4" hover>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[#1a1a1a] flex items-center justify-center shrink-0">
                      <FileText size={16} className="text-[#555]" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-display font-bold text-white text-sm">{inv.invoiceNumber}</span>
                        <Badge variant={color}>{inv.status}</Badge>
                      </div>
                      <div className="text-xs text-[#555] font-body mt-0.5">
                        {inv.clientName} · {inv.invoiceDate}
                        {inv.dueDate && ` · Due ${inv.dueDate}`}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-mono text-white font-bold text-base">
                      {formatByCurrency(inv.total, inv.currency)}
                    </div>
                    <div className="text-xs text-[#444]">{inv.currency}</div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {inv.status === 'Draft' && (
                      <Button variant="secondary" size="xs" icon={Send} onClick={() => markSent(inv)}>Send</Button>
                    )}
                    {inv.status === 'Sent' && (
                      <Button variant="success" size="xs" icon={CheckCircle} onClick={() => markPaid(inv)}>Paid</Button>
                    )}
                    <button onClick={() => handlePDF(inv)} className="w-7 h-7 rounded-lg hover:bg-[#1a1a1a] flex items-center justify-center text-[#555] hover:text-white transition-colors">
                      <Download size={13} />
                    </button>
                    <button onClick={() => openEdit(inv)} className="w-7 h-7 rounded-lg hover:bg-[#1a1a1a] flex items-center justify-center text-[#555] hover:text-white transition-colors">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => setDeleteId(inv.id)} className="w-7 h-7 rounded-lg hover:bg-red-500/10 flex items-center justify-center text-[#333] hover:text-red-400 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </Card>
            )
          })
        )}
      </div>

      {/* Invoice Form Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editId ? 'Edit Invoice' : `New Invoice · ${nextInvoiceNumber}`}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button variant="secondary" onClick={() => { handleSave(); }} loading={false} icon={FileText}>
              Save as Draft
            </Button>
            <Button onClick={handleSave} loading={saving}>Save</Button>
          </>
        }
      >
        <div className="space-y-5">
          {/* Client + dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Select label="Client" value={form.clientName} onChange={e => {
                const client = DEFAULT_CLIENTS.find(c => c.name === e.target.value)
                set('clientName', e.target.value)
                if (client?.currency) set('currency', client.currency)
              }}>
                <option value="">Select client...</option>
                {clients.map(c => <option key={c} value={c}>{c}</option>)}
                <option value="__new">+ New Client</option>
              </Select>
            </div>
            <Select label="Currency" value={form.currency} onChange={e => set('currency', e.target.value)}>
              <option value="NPR">NPR — Nepali Rupee</option>
              <option value="AUD">AUD — Australian Dollar</option>
              <option value="USD">USD — US Dollar</option>
            </Select>
          </div>

          <Textarea label="Client Address" value={form.clientAddress} onChange={e => set('clientAddress', e.target.value)} rows={2} placeholder="Client's billing address..." />

          <div className="grid grid-cols-2 gap-4">
            <Input label="Invoice Date (AD)" type="date" value={form.invoiceDate} onChange={e => set('invoiceDate', e.target.value)} />
            <Input label="Due Date (AD)" type="date" value={form.dueDate} onChange={e => set('dueDate', e.target.value)} />
          </div>

          {/* Line items */}
          <div>
            <label className="text-xs text-[#888] font-body font-medium uppercase tracking-wider block mb-2">Line Items</label>
            <div className="space-y-2">
              {form.lineItems.map((item, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    value={item.description}
                    onChange={e => setLineItem(i, 'description', e.target.value)}
                    placeholder="Description"
                    className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white font-body outline-none focus:border-[#E8192C]"
                  />
                  <input
                    value={item.qty}
                    onChange={e => setLineItem(i, 'qty', e.target.value)}
                    type="number"
                    placeholder="Qty"
                    className="w-16 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white font-body outline-none focus:border-[#E8192C] text-center"
                  />
                  <input
                    value={item.rate}
                    onChange={e => setLineItem(i, 'rate', e.target.value)}
                    type="number"
                    placeholder="Rate"
                    className="w-28 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white font-mono outline-none focus:border-[#E8192C] text-right"
                  />
                  <div className="w-28 px-3 py-2 bg-[#111] border border-[#2a2a2a] rounded-lg text-sm font-mono text-[#888] text-right">
                    {formatByCurrency((item.qty || 1) * (parseFloat(item.rate) || 0), form.currency)}
                  </div>
                  {form.lineItems.length > 1 && (
                    <button onClick={() => removeLineItem(i)} className="text-[#333] hover:text-red-400 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={addLineItem} className="mt-2 text-xs text-[#555] hover:text-white font-body flex items-center gap-1 transition-colors">
              <Plus size={12} /> Add line item
            </button>
          </div>

          {/* Total */}
          <div className="flex justify-end">
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-5 py-3 flex items-center gap-4">
              <span className="text-sm text-[#555] font-body">Total</span>
              <span className="font-mono text-white text-xl font-bold">{formatByCurrency(subtotal, form.currency)}</span>
            </div>
          </div>

          <Textarea label="Notes / Payment Instructions" value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} />
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Invoice"
        message="This will permanently delete this invoice. Cannot be undone."
        confirmLabel="Delete"
      />
    </div>
  )
}
