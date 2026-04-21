import { useState, useMemo } from 'react'
import { Plus, FileText, Send, CheckCircle, Clock, AlertCircle, Download, Trash2, Pencil, Eye, X } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useInvoices, useClients } from '../../hooks/useFirestore'
import { addDocument, updateDocument, deleteDocument } from '../../firebase/firestore'
import { formatNPR, formatByCurrency, generateInvoiceNumber } from '../../utils/formatUtils'
import { adToBS, BS_MONTHS, AD_MONTHS, todayString, getTodayBoth } from '../../utils/dateUtils'
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

// Clients are now loaded from Firestore via useClients()

// Hardcoded bank details — overridden by settings.defaultPaymentInstructions if set
const HARDCODED_PAYMENT_INSTRUCTIONS =
  `A/C Holder Name: DEBUGDREAM PVT LTD
Account Number: 28601040251341
Bank Name: NEPAL INVESTMENT MEGA BANK LTD
Bank Branch: BAGBAZAAR
SWIFT: NIBLNPKT`

function emptyInvoice(defaultNotes) {
  const { bs } = getTodayBoth()
  return {
    clientName: '',
    clientAddress: '',
    invoiceDate: todayString(),
    dueDate: '',
    currency: 'NPR',
    lineItems: [{ description: '', qty: 1, rate: '' }],
    notes: defaultNotes || HARDCODED_PAYMENT_INSTRUCTIONS,
    remarks: '',
    status: 'Draft',
    clientPersonName: '',
    servicePeriodStart: { month: bs.month, year: bs.year },
    servicePeriodEnd: null,
  }
}

export default function Invoices() {
  const { settings } = useApp()
  const { data: invoices, loading, add: addInvoice, update: updateInvoice, remove: removeInvoice } = useInvoices()
  const { data: clientsData } = useClients()

  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(emptyInvoice())
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterClient, setFilterClient] = useState('all')
  const [previewUrl,   setPreviewUrl]   = useState(null)
  
  // ── Payment conversion modal state ──────────────────────────────────────────
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [nprEquivalent, setNprEquivalent] = useState('')
  const [markingPaid, setMarkingPaid] = useState(false)

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
  
  const handleMarkPaid = (inv) => {
    if (inv.currency === 'NPR') {
      executeMarkPaid(inv, inv.total)
    } else {
      setSelectedInvoice(inv)
      setNprEquivalent('')
      setShowPaymentModal(true)
    }
  }

  const executeMarkPaid = async (inv, nprAmount) => {
    setMarkingPaid(true)
    try {
      await updateInvoice(inv.id, { status: 'Paid', paidDate: todayString(), nprEquivalent: parseFloat(nprAmount) || 0 })
      
      // Automated Income Entry
      const today = todayString()
      const bs = adToBS(today)
      await addDocument('income', {
        date: today,
        clientName: inv.clientName,
        description: `Payment for Invoice #${inv.invoiceNumber}${inv.currency !== 'NPR' ? ` (${formatByCurrency(inv.total, inv.currency)})` : ''}`,
        amount: parseFloat(nprAmount) || 0,
        originalAmount: inv.total,
        originalCurrency: inv.currency,
        paymentSource: 'bank',
        linkedInvoice: inv.id,
        bsYear: bs.year,
        bsMonth: bs.month,
        bsDay: bs.day,
        bsMonthName: bs.monthName,
      })
      setShowPaymentModal(false)
    } finally {
      setMarkingPaid(false)
    }
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
    const s = new Set([...clientsData.map(c => c.name), ...invoices.map(i => i.clientName).filter(Boolean)])
    return [...s]
  }, [invoices, clientsData])

  const outstanding = invoices.filter(i => i.status === 'Sent' || i.status === 'Overdue')

  return (
    <div className="space-y-5 md:space-y-6 animate-fade-in">
      <SectionHeader
        title="Invoices"
        subtitle={`${invoices.length} total · ${outstanding.length} outstanding`}
        action={<Button size="sm" onClick={openAdd} icon={Plus}>New Invoice</Button>}
      />

      {/* Status summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {['Draft', 'Sent', 'Paid', 'Overdue'].map(status => {
          const { color, icon: Icon } = STATUS_CONFIG[status]
          const statusInvoices = invoices.filter(i => i.status === status)
          const count = statusInvoices.length
          
          const totals = statusInvoices.reduce((acc, inv) => {
            const curr = inv.currency || 'NPR'
            acc[curr] = (acc[curr] || 0) + (inv.total || 0)
            return acc
          }, {})

          return (
            <Card
              key={status}
              className={clsx(
                'p-4 md:p-5 glass-card relative overflow-hidden group',
                filterStatus === status ? 'border-accent shadow-accent/10' : 'opacity-80 hover:opacity-100'
              )}
              hover
              onClick={() => setFilterStatus(filterStatus === status ? 'all' : status)}
            >
              <div className="flex items-center justify-between mb-3">
                <Badge variant={color}>{status}</Badge>
                <div className="p-1.5 rounded-lg bg-white/5 text-text-muted group-hover:text-text-primary transition-colors">
                  <Icon size={14} />
                </div>
              </div>
              <div className="font-display font-bold text-2xl text-text-primary leading-none mb-3">{count}</div>
              <div className="space-y-1">
                {Object.entries(totals).map(([curr, amt]) => (
                  <div key={curr} className="flex items-center justify-between">
                    <span className="text-[10px] text-text-muted font-display uppercase tracking-wider">{curr}</span>
                    <span className="text-xs text-text-secondary font-mono">{formatByCurrency(amt, curr).replace(curr, '').trim()}</span>
                  </div>
                ))}
                {count === 0 && (
                   <div className="flex items-center justify-between opacity-30">
                     <span className="text-[10px] text-text-muted font-display uppercase tracking-wider">NPR</span>
                     <span className="text-xs text-text-secondary font-mono">0.00</span>
                   </div>
                )}
              </div>
            </Card>
          )
        })}
      </div>

      {/* Client filter pills */}
      <div className="flex gap-2 flex-wrap pb-2">
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

      {/* Invoice list */}
      <div className="space-y-3">
        {loading ? (
          <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-24 bg-white/5 rounded-[2rem] animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No invoices found"
            description="Adjust your filters or create a new invoice to get started."
            action={<Button onClick={openAdd} icon={Plus}>New Invoice</Button>}
          />
        ) : (
          filtered.map(inv => {
            const { color } = STATUS_CONFIG[inv.status] || STATUS_CONFIG.Draft
            return (
              <Card key={inv.id} className="p-4 md:p-6 group relative overflow-hidden" hover>
                {/* Active hover indicator */}
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-accent scale-x-0 group-hover:scale-x-100 transition-transform origin-left rounded-r-full" />
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center shrink-0 border border-white/5 transition-colors group-hover:bg-accent/10 group-hover:border-accent/20">
                      <FileText size={20} className={clsx("transition-colors", inv.status === 'Paid' ? 'text-green-400' : 'text-text-muted group-hover:text-accent')} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-display font-bold text-text-primary text-base md:text-lg tracking-tight">{inv.invoiceNumber}</span>
                        <Badge variant={color}>{inv.status}</Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-text-secondary font-body">
                        <span className="font-medium text-text-primary">{inv.clientName}</span>
                        <span className="text-text-muted">·</span>
                        <span>Issued {inv.invoiceDate}</span>
                        {inv.dueDate && (
                          <>
                             <span className="text-text-muted">·</span>
                             <span className={clsx(inv.status === 'Overdue' ? 'text-red-400 font-medium' : 'text-text-muted')}>Due {inv.dueDate}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-none border-white/5 pt-4 md:pt-0">
                    <div className="text-left md:text-right shrink-0">
                      <div className="font-mono text-text-primary font-bold text-lg md:text-xl tracking-tight leading-none mb-1">
                        {formatByCurrency(inv.total, inv.currency)}
                      </div>
                      <div className="text-[10px] text-text-muted font-display uppercase tracking-[0.2em]">{inv.currency} Ledger</div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {inv.status === 'Draft' && (
                        <Button variant="outline" size="sm" icon={Send} onClick={() => markSent(inv)} className="rounded-xl border-white/10 hover:border-accent hover:text-accent">Send</Button>
                      )}
                      {inv.status === 'Sent' && (
                        <Button variant="success" size="sm" icon={CheckCircle} onClick={() => handleMarkPaid(inv)} className="rounded-xl border-green-500/20">Mark Paid</Button>
                      )}
                      <div className="h-8 w-[1px] bg-white/5 mx-1 hidden md:block" />
                      <button onClick={() => handlePreview(inv)} title="Preview" className="w-9 h-9 rounded-xl hover:bg-white/5 flex items-center justify-center text-text-muted hover:text-accent transition-all border border-transparent hover:border-white/10">
                        <Eye size={16} />
                      </button>
                      <button onClick={() => handlePDF(inv)} title="Download" className="w-9 h-9 rounded-xl hover:bg-white/5 flex items-center justify-center text-text-muted hover:text-text-primary transition-all border border-transparent hover:border-white/10">
                        <Download size={16} />
                      </button>
                      <button onClick={() => openEdit(inv)} title="Edit" className="w-9 h-9 rounded-xl hover:bg-white/5 flex items-center justify-center text-text-muted hover:text-text-primary transition-all border border-transparent hover:border-white/10">
                        <Pencil size={16} />
                      </button>
                      <button onClick={() => setDeleteId(inv.id)} title="Delete" className="w-9 h-9 rounded-xl hover:bg-red-500/10 flex items-center justify-center text-text-muted hover:text-red-400 transition-all border border-transparent hover:border-red-500/20">
                        <Trash2 size={16} />
                      </button>
                    </div>
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
                const client = clientsData.find(c => c.name === e.target.value)
                set('clientName', e.target.value)
                const newCurrency = client?.currency || 'NPR'
                set('currency', newCurrency)
                if (client?.address) set('clientAddress', client.address)
                if (client?.contactPerson) set('clientPersonName', client.contactPerson)
                
                // Smart default for service period
                if (newCurrency === 'NPR') {
                  const { bs } = getTodayBoth()
                  set('servicePeriodStart', { month: bs.month, year: bs.year })
                } else {
                  const d = new Date()
                  set('servicePeriodStart', { month: d.getMonth() + 1, year: d.getFullYear() })
                }
              }}
            >
              <option value="">Select client...</option>
              {clients.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
            <Select label="Currency" value={form.currency} onChange={e => {
              const newCurrency = e.target.value
              set('currency', newCurrency)
              // Smart default for service period
              if (newCurrency === 'NPR') {
                const { bs } = getTodayBoth()
                set('servicePeriodStart', { month: bs.month, year: bs.year })
              } else {
                const d = new Date()
                set('servicePeriodStart', { month: d.getMonth() + 1, year: d.getFullYear() })
              }
            }}>
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
          <div className="flex items-end justify-between mb-2">
            <label className="text-xs text-text-secondary font-body font-medium uppercase tracking-wider block">Line Items</label>
            {settings?.presetInvoiceItems?.length > 0 && (
              <div className="w-48">
                <Select
                  value=""
                  onChange={(e) => {
                    const val = e.target.value
                    if (!val) return
                    const items = [...form.lineItems]
                    const last = items[items.length - 1]
                    // If the last item is completely empty, overwrite it. Else, append a new row.
                    if (last && !last.description && !last.rate) {
                      items[items.length - 1] = { ...last, description: val }
                    } else {
                      items.push({ description: val, qty: 1, rate: '' })
                    }
                    set('lineItems', items)
                  }}
                >
                  <option value="">+ Add from presets...</option>
                  {settings.presetInvoiceItems.map(item => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </Select>
              </div>
            )}
          </div>
          <div>
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

          {/* Remarks / Comments */}
          <Textarea
            label="Remarks / Comments (Optional)"
            value={form.remarks || ''}
            onChange={e => set('remarks', e.target.value)}
            rows={3}
            placeholder="Add any additional remarks or comments for this invoice..."
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

      {/* ── Payment Conversion Modal ────────────────────────────────────────── */}
      <Modal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        title="Confirm Payment Received"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowPaymentModal(false)}>Cancel</Button>
            <Button 
                onClick={() => executeMarkPaid(selectedInvoice, nprEquivalent)} 
                loading={markingPaid}
                disabled={!nprEquivalent}
            >
              Confirm Received
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="p-4 bg-accent/5 border border-accent/20 rounded-xl">
            <div className="text-xs text-text-muted font-body uppercase tracking-wider mb-2">Invoice Amount</div>
            <div className="font-mono text-text-primary text-xl font-bold">
              {selectedInvoice && formatByCurrency(selectedInvoice.total, selectedInvoice.currency)}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-text-secondary font-body">
              How much **NPR** did you receive in your bank for this invoice?
            </p>
            <Input 
              label="Amount Received (NPR)" 
              type="number" 
              prefix="NPR"
              value={nprEquivalent}
              onChange={e => setNprEquivalent(e.target.value)}
              placeholder="e.g. 45000"
              autoFocus
            />
            <p className="text-[10px] text-text-muted font-body italic">
              * This will be recorded in your Income ledger for accurate balance tracking.
            </p>
          </div>
        </div>
      </Modal>

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
