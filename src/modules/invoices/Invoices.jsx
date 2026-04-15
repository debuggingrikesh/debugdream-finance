import { useState, useMemo } from 'react'
import { Plus, FileText, Send, CheckCircle, Clock, AlertCircle, Download, Trash2, Pencil, Eye, X } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useInvoices } from '../../hooks/useFirestore'
import { addDocument, updateDocument, deleteDocument } from '../../firebase/firestore'
import { formatNPR, formatByCurrency, generateInvoiceNumber } from '../../utils/formatUtils'
import { adToBS, BS_MONTHS, AD_MONTHS, todayString } from '../../utils/dateUtils'
import { generateInvoicePDF } from '../../utils/pdfUtils'
import {
  Card, SectionHeader, Button, Modal, Input, Select, Badge,
  ConfirmDialog, EmptyState, Textarea,
} from '../../components/ui/index'
import clsx from 'clsx'

const STATUS_CONFIG = {
  Draft: { color: 'warning', icon: Clock },
  Sent: { color: 'info', icon: Send },
  Paid: { color: 'success', icon: CheckCircle },
  Overdue: { color: 'danger', icon: AlertCircle },
}

const DEFAULT_CLIENTS = [
  { name: 'VXL', currency: 'NPR' },
  { name: 'Shristi', currency: 'AUD', recurring: true, recurringAmount: 550 },
]

// Hardcoded bank details — overridden by settings.defaultPaymentInstructions if set
const HARDCODED_PAYMENT_INSTRUCTIONS =
  `A/C Holder Name: DEBUGDREAM PVT LTD
Account Number: 28601040251341
Bank Name: NEPAL INVESTMENT MEGA BANK LTD
Bank Branch: BAGBAZAAR
SWIFT: NIBLNPKT`

function emptyInvoice(defaultNotes) {
  return {
    clientName: '',
    clientAddress: '',
    invoiceDate: todayString(),
    dueDate: '',
    currency: 'NPR',
    lineItems: [{ description: '', qty: 1, rate: '' }],
    notes: defaultNotes || HARDCODED_PAYMENT_INSTRUCTIONS,
    status: 'Draft',
    clientPersonName: '',
    servicePeriodStart: { month: new Date().getMonth() + 1, year: new Date().getFullYear() },
    servicePeriodEnd: null,
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
  const [previewUrl,   setPreviewUrl]   = useState(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Always use settings value when it exists; fall back to hardcoded bank details
  const defaultNotes = settings?.defaultPaymentInstructions || HARDCODED_PAYMENT_INSTRUCTIONS

  const openAdd = () => {
    setEditId(null)
    setForm(emptyInvoice(defaultNotes))
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

  // ── Auto-generate invoice number ───────────────────────────────────────────
  const nextInvoiceNumber = useMemo(() => {
    const bs = adToBS(new Date())
    const count = invoices.filter(i => String(i.invoiceDate || '').startsWith(String(new Date().getFullYear()))).length
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

  // ── Status transitions ─────────────────────────────────────────────────────
  const markSent = async (inv) => updateInvoice(inv.id, { status: 'Sent', sentDate: todayString() })
  const markPaid = async (inv) => {
    await updateInvoice(inv.id, { status: 'Paid', paidDate: todayString() })
    
    // Automated Income Entry
    const today = todayString()
    const bs = adToBS(today)
    await addDocument('income', {
      date: today,
      clientName: inv.clientName,
      description: `Payment for Invoice #${inv.invoiceNumber}`,
      amount: inv.total,
      paymentSource: 'bank',
      linkedInvoice: inv.id,
      bsYear: bs.year,
      bsMonth: bs.month,
      bsDay: bs.day,
      bsMonthName: bs.monthName,
    })
  }

  const handleDelete = async () => {
    if (deleteId) { await removeInvoice(deleteId); setDeleteId(null) }
  }

  // ── PDF ────────────────────────────────────────────────────────────────────
  const handlePDF = (inv) => generateInvoicePDF(inv, settings?.company || {}, settings?.logoBase64)
  const handlePreview = (inv) => {
    const url = generateInvoicePDF(inv, settings?.company || {}, settings?.logoBase64, 'preview')
    setPreviewUrl(url)
  }

  // ── Filters ───────────────────────────────────────────────────────────────
  const filtered = useMemo(() =>
    invoices
      .filter(i => filterStatus === 'all' || i.status === filterStatus)
      .filter(i => filterClient === 'all' || i.clientName === filterClient)
      .sort((a, b) => (b.invoiceDate || '').localeCompare(a.invoiceDate || '')),
    [invoices, filterStatus, filterClient]
  )

  const clients = useMemo(() => {
    const s = new Set([...DEFAULT_CLIENTS.map(c => c.name), ...invoices.map(i => i.clientName).filter(Boolean)])
    return [...s]
  }, [invoices])

  const outstanding = invoices.filter(i => i.status === 'Sent' || i.status === 'Overdue')

  return (
    <div className="space-y-5 md:space-y-6 animate-fade-in">
      <SectionHeader
        title="Invoices"
        subtitle={`${invoices.length} total · ${outstanding.length} outstanding`}
        action={<Button size="sm" onClick={openAdd} icon={Plus}>New Invoice</Button>}
      />

      {/* Status summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
        {['Draft', 'Sent', 'Paid', 'Overdue'].map(status => {
          const { color } = STATUS_CONFIG[status]
          const count = invoices.filter(i => i.status === status).length
          const total = invoices.filter(i => i.status === status).reduce((s, i) => s + (i.total || 0), 0)
          return (
            <Card
              key={status}
              className={clsx('p-3 md:p-4 cursor-pointer', filterStatus === status && 'border-accent')}
              hover
              onClick={() => setFilterStatus(filterStatus === status ? 'all' : status)}
            >
              <Badge variant={color}>{status}</Badge>
              <div className="mt-2 font-mono text-text-primary text-lg font-bold">{count}</div>
              <div className="text-xs text-text-muted font-mono">{formatNPR(total)}</div>
            </Card>
          )
        })}
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
                ? 'bg-accent text-text-primary border-transparent'
                : 'border-border text-text-muted hover:text-text-primary hover:border-border-light'
            )}
          >
            {c === 'all' ? 'All clients' : c}
          </button>
        ))}
      </div>

      {/* Invoice list */}
      <div className="space-y-2">
        {loading ? (
          <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-20 bg-bg-surface rounded-xl animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No invoices"
            description="Create your first invoice above."
            action={<Button onClick={openAdd} icon={Plus}>New Invoice</Button>}
          />
        ) : (
          filtered.map(inv => {
            const { color } = STATUS_CONFIG[inv.status] || STATUS_CONFIG.Draft
            return (
              <Card key={inv.id} className="p-3 md:p-4" hover>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-bg-elevated flex items-center justify-center shrink-0">
                      <FileText size={15} className="text-text-muted" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-display font-bold text-text-primary text-sm">{inv.invoiceNumber}</span>
                        <Badge variant={color}>{inv.status}</Badge>
                      </div>
                      <div className="text-xs text-text-muted font-body mt-0.5">
                        {inv.clientName} · {inv.invoiceDate}{inv.dueDate ? ` · Due ${inv.dueDate}` : ''}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-mono text-text-primary font-bold text-sm md:text-base">
                      {formatByCurrency(inv.total, inv.currency)}
                    </div>
                    <div className="text-xs text-text-muted">{inv.currency}</div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {inv.status === 'Draft' && (
                      <Button variant="secondary" size="xs" icon={Send} onClick={() => markSent(inv)}>Send</Button>
                    )}
                    {inv.status === 'Sent' && (
                      <Button variant="success" size="xs" icon={CheckCircle} onClick={() => markPaid(inv)}>Paid</Button>
                    )}
                    <button onClick={() => handlePreview(inv)} title="Preview" className="w-7 h-7 rounded-lg hover:bg-bg-elevated flex items-center justify-center text-text-muted hover:text-accent transition-colors">
                      <Eye size={13} />
                    </button>
                    <button onClick={() => handlePDF(inv)} title="Download" className="w-7 h-7 rounded-lg hover:bg-bg-elevated flex items-center justify-center text-text-muted hover:text-text-primary transition-colors">
                      <Download size={13} />
                    </button>
                    <button onClick={() => openEdit(inv)} className="w-7 h-7 rounded-lg hover:bg-bg-elevated flex items-center justify-center text-text-muted hover:text-text-primary transition-colors">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => setDeleteId(inv.id)} className="w-7 h-7 rounded-lg hover:bg-accent/10 flex items-center justify-center text-text-muted hover:text-red-400 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </Card>
            )
          })
        )}
      </div>

      {/* ── Invoice form modal ────────────────────────────────────────────────── */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editId ? 'Edit Invoice' : `New Invoice · ${nextInvoiceNumber}`}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>Save</Button>
          </>
        }
      >
        <div className="space-y-4 md:space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            <Select
              label="Client"
              value={form.clientName}
              onChange={e => {
                const client = DEFAULT_CLIENTS.find(c => c.name === e.target.value)
                set('clientName', e.target.value)
                if (client?.currency) set('currency', client.currency)
              }}
            >
              <option value="">Select client...</option>
              {clients.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
            <Select label="Currency" value={form.currency} onChange={e => set('currency', e.target.value)}>
              <option value="NPR">NPR — Nepali Rupee</option>
              <option value="AUD">AUD — Australian Dollar</option>
              <option value="USD">USD — US Dollar</option>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            <Input label="Attention (Person Name)" value={form.clientPersonName} onChange={e => set('clientPersonName', e.target.value)} placeholder="e.g. John Doe" />
            <Textarea label="Client Address" value={form.clientAddress} onChange={e => set('clientAddress', e.target.value)} rows={1} placeholder="Client's billing address..." />
          </div>

          <div className="p-4 bg-bg-elevated border border-border rounded-xl space-y-3">
            <label className="text-xs text-text-secondary font-body font-medium uppercase tracking-wider block">Service Period</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Select label="Start Month" value={form.servicePeriodStart?.month} onChange={e => set('servicePeriodStart', { ...form.servicePeriodStart, month: parseInt(e.target.value) })}>
                {(form.currency === 'NPR' ? BS_MONTHS : AD_MONTHS).map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </Select>
              <Input label="Year" type="number" value={form.servicePeriodStart?.year} onChange={e => set('servicePeriodStart', { ...form.servicePeriodStart, year: parseInt(e.target.value) })} />
              
              <Select label="End Month (Optional)" value={form.servicePeriodEnd?.month || ''} onChange={e => set('servicePeriodEnd', e.target.value ? { month: parseInt(e.target.value), year: form.servicePeriodStart.year } : null)}>
                <option value="">None (Single Month)</option>
                {(form.currency === 'NPR' ? BS_MONTHS : AD_MONTHS).map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </Select>
              <div className="flex items-end pb-2">
                <span className="text-xs text-text-muted italic">Multi-month support auto-formats on PDF</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:gap-4">
            <Input label="Invoice Date (AD)" type="date" value={form.invoiceDate} onChange={e => set('invoiceDate', e.target.value)} />
            <Input label="Due Date (AD)" type="date" value={form.dueDate} onChange={e => set('dueDate', e.target.value)} />
          </div>

          {/* Line items */}
          <div>
            <label className="text-xs text-text-secondary font-body font-medium uppercase tracking-wider block mb-2">Line Items</label>
            <div className="space-y-2">
              {form.lineItems.map((item, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    value={item.description}
                    onChange={e => setLineItem(i, 'description', e.target.value)}
                    placeholder="Description"
                    className="flex-1 bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary font-body outline-none focus:border-accent min-w-0"
                  />
                  <input
                    value={item.qty}
                    onChange={e => setLineItem(i, 'qty', e.target.value)}
                    type="number"
                    placeholder="Qty"
                    className="w-14 bg-bg-elevated border border-border rounded-lg px-2 py-2 text-sm text-text-primary font-body outline-none focus:border-accent text-center shrink-0"
                  />
                  <input
                    value={item.rate}
                    onChange={e => setLineItem(i, 'rate', e.target.value)}
                    type="number"
                    placeholder="Rate"
                    className="w-24 bg-bg-elevated border border-border rounded-lg px-2 py-2 text-sm text-text-primary font-mono outline-none focus:border-accent text-right shrink-0"
                  />
                  <div className="w-24 px-2 py-2 bg-bg-surface border border-border rounded-lg text-xs font-mono text-text-secondary text-right shrink-0 hidden md:block">
                    {formatByCurrency((item.qty || 1) * (parseFloat(item.rate) || 0), form.currency)}
                  </div>
                  {form.lineItems.length > 1 && (
                    <button onClick={() => removeLineItem(i)} className="text-text-muted hover:text-red-400 transition-colors shrink-0">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={addLineItem} className="mt-2 text-xs text-text-muted hover:text-text-primary font-body flex items-center gap-1 transition-colors">
              <Plus size={12} /> Add line item
            </button>
          </div>

          {/* Total */}
          <div className="flex justify-end">
            <div className="bg-bg-elevated border border-border rounded-xl px-4 md:px-5 py-3 flex items-center gap-4">
              <span className="text-sm text-text-muted font-body">Total</span>
              <span className="font-mono text-text-primary text-lg md:text-xl font-bold">{formatByCurrency(subtotal, form.currency)}</span>
            </div>
          </div>

          {/* Notes — pre-filled with bank details */}
          <Textarea
            label="Notes / Payment Instructions"
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            rows={5}
          />
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

      {/* ── Preview Modal ──────────────────────────────────────────────────── */}
      {previewUrl && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 md:p-10 animate-fade-in">
          <div className="relative w-full h-full max-w-5xl bg-bg-surface rounded-2xl overflow-hidden flex flex-col shadow-2xl border border-white/10">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-sm font-display font-bold text-text-primary">Invoice Preview</h3>
                <p className="text-xs text-text-muted">Generated document preview</p>
              </div>
              <button 
                onClick={() => {
                  URL.revokeObjectURL(previewUrl)
                  setPreviewUrl(null)
                }}
                className="w-8 h-8 rounded-full hover:bg-bg-elevated flex items-center justify-center text-text-muted transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 bg-white/5 bg-checkered p-4 overflow-auto">
              <iframe 
                src={previewUrl} 
                className="w-full h-full border-none rounded-lg shadow-inner bg-white"
                title="Invoice PDF Preview"
              />
            </div>
            <div className="p-4 border-t border-border flex justify-end">
              <Button onClick={() => window.open(previewUrl, '_blank')}>
                Open in New Tab
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
