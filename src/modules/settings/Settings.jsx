import { useState } from 'react'
import { LogOut, Upload, Download, Plus, X, Save } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { getDocuments } from '../../firebase/firestore'
import { getTodayBoth, BS_MONTHS } from '../../utils/dateUtils'
import { Card, SectionHeader, Button, Input, Divider, Alert } from '../../components/ui/index'
import clsx from 'clsx'

const HARDCODED_PAYMENT_INSTRUCTIONS =
`Payment Instructions:
A/C Holder Name: DEBUGDREAM PVT LTD
Account Number: 28601040251341
Bank Name: NEPAL INVESTMENT MEGA BANK LTD
Bank Branch: BAGBAZAAR`

export default function Settings({ onSignOut }) {
  const { settings, updateSettings } = useApp()

  const [form, setForm] = useState({
    company: { ...(settings.company || {}) },
    openingBank:  settings.openingBank  || '',
    openingCash:  settings.openingCash  || '',
    openingDate:  settings.openingDate  || '',
    expenseCategories:   [...(settings.expenseCategories   || [])],
    myExpenseCategories: [...(settings.myExpenseCategories || [])],
    inventoryCategories: [...(settings.inventoryCategories || [])],
    presetInvoiceItems:  [...(settings.presetInvoiceItems  || [])],
    rentReminderDay: settings.rentReminderDay || 16,
    rentAmount:      settings.rentAmount      || 30000,
    defaultPaymentInstructions: settings.defaultPaymentInstructions || HARDCODED_PAYMENT_INSTRUCTIONS,
  })

  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(false)
  const [logoBase64, setLogoBase64] = useState(settings.logoBase64 || null)

  const setCompany = (k, v) => setForm(f => ({ ...f, company: { ...f.company, [k]: v } }))

  const handleLogoUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setLogoBase64(ev.target.result)
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateSettings({ ...form, logoBase64 })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  // ── Category helpers ──────────────────────────────────────────────────────
  const addCat    = (field)         => setForm(f => ({ ...f, [field]: [...f[field], ''] }))
  const removeCat = (field, i)      => setForm(f => ({ ...f, [field]: f[field].filter((_, idx) => idx !== i) }))
  const editCat   = (field, i, val) => setForm(f => {
    const arr = [...f[field]]; arr[i] = val; return { ...f, [field]: arr }
  })

  // ── Full JSON backup ──────────────────────────────────────────────────────
  const handleExport = async () => {
    try {
      const collections = [
        'income','expenses','myExpenses','myExpenseMonths','employees',
        'payrollRuns','invoices','officeSetup','officeSetupTransactions',
        'salaryLedger','inventory','carLoan','carLoanPayments','reminders',
      ]
      const backup = {}
      for (const col of collections) backup[col] = await getDocuments(col)
      backup.settings   = settings
      backup.exportedAt = new Date().toISOString()

      const { bs }  = getTodayBoth()
      const fileName = `debugdream-backup-${bs.year}-${BS_MONTHS[bs.month - 1]}.json`
      const blob     = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const a        = document.createElement('a')
      a.href         = URL.createObjectURL(blob)
      a.download     = fileName
      a.click()
    } catch (err) {
      console.error('Backup failed:', err)
    }
  }

  // ── Category editor sub-component ─────────────────────────────────────────
  const CategoryEditor = ({ label, field }) => (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs text-text-secondary font-body font-medium uppercase tracking-wider">{label}</label>
        <button onClick={() => addCat(field)} className="text-xs text-accent hover:underline font-body flex items-center gap-1">
          <Plus size={10} /> Add
        </button>
      </div>
      <div className="space-y-1.5">
        {form[field].map((cat, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={cat}
              onChange={e => editCat(field, i, e.target.value)}
              className="flex-1 bg-bg-elevated border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary font-body outline-none focus:border-accent"
            />
            <button onClick={() => removeCat(field, i)} className="w-7 h-7 rounded-lg hover:bg-accent/10 flex items-center justify-center text-text-muted hover:text-red-400 transition-colors">
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="space-y-5 md:space-y-6 animate-fade-in max-w-2xl">
      <SectionHeader
        title="Settings"
        subtitle="Company profile, categories & app configuration"
        action={
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={handleExport} icon={Download}>Backup</Button>
            <Button size="sm" onClick={handleSave} loading={saving} icon={Save}>Save</Button>
          </div>
        }
      />

      {saved && <Alert type="success" message="Settings saved successfully." />}

      {/* ── Company profile ─────────────────────────────────────────────────── */}
      <Card className="p-4 md:p-5">
        <h3 className="font-display font-bold text-text-primary text-base mb-4">Company Profile</h3>
        <div className="space-y-4">
          {/* Logo */}
          <div>
            <label className="text-xs text-text-secondary font-body font-medium uppercase tracking-wider block mb-2">Company Logo</label>
            <div className="flex items-center gap-4">
              {logoBase64 ? (
                <img src={logoBase64} alt="Logo" className="h-12 object-contain bg-bg-elevated rounded-lg p-2" />
              ) : (
                <div className="h-12 w-24 bg-bg-elevated border border-border rounded-lg flex items-center justify-center">
                  <span className="text-text-muted text-xs font-body">No logo</span>
                </div>
              )}
              <label className="cursor-pointer">
                <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                <span className="text-xs text-text-muted hover:text-text-primary border border-border hover:border-border-light px-3 py-2 rounded-lg font-body transition-all flex items-center gap-1.5">
                  <Upload size={12} /> Upload Logo
                </span>
              </label>
            </div>
          </div>

          <Input label="Company Name" value={form.company.name || ''} onChange={e => setCompany('name', e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="PAN Number" value={form.company.pan || ''} onChange={e => setCompany('pan', e.target.value)} />
            <Input label="Registration No." value={form.company.registration || ''} onChange={e => setCompany('registration', e.target.value)} />
          </div>
          <Input label="Address" value={form.company.address || ''} onChange={e => setCompany('address', e.target.value)} />
          <Input label="Website"  value={form.company.website || ''} onChange={e => setCompany('website', e.target.value)} />
        </div>
      </Card>

      {/* ── Opening balances ─────────────────────────────────────────────────── */}
      <Card className="p-4 md:p-5">
        <h3 className="font-display font-bold text-text-primary text-base mb-4">Opening Balances</h3>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Opening Bank (NPR)" type="number" prefix="NPR" value={form.openingBank} onChange={e => setForm(f => ({ ...f, openingBank: e.target.value }))} />
            <Input label="Opening Cash (NPR)" type="number" prefix="NPR" value={form.openingCash} onChange={e => setForm(f => ({ ...f, openingCash: e.target.value }))} />
          </div>
          <Input label="Balance Start Date" type="date" value={form.openingDate} onChange={e => setForm(f => ({ ...f, openingDate: e.target.value }))} />
        </div>
      </Card>

      {/* ── Rent reminder ────────────────────────────────────────────────────── */}
      <Card className="p-4 md:p-5">
        <h3 className="font-display font-bold text-text-primary text-base mb-4">Rent Reminder</h3>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Reminder Day of Month" type="number" value={form.rentReminderDay} onChange={e => setForm(f => ({ ...f, rentReminderDay: parseInt(e.target.value) }))} />
          <Input label="Rent Amount (NPR)" type="number" prefix="NPR" value={form.rentAmount} onChange={e => setForm(f => ({ ...f, rentAmount: parseFloat(e.target.value) }))} />
        </div>
      </Card>

      {/* ── Default invoice payment instructions ────────────────────────────── */}
      <Card className="p-4 md:p-5">
        <h3 className="font-display font-bold text-text-primary text-base mb-1">Invoice Payment Instructions</h3>
        <p className="text-xs text-text-muted font-body mb-3">
          Pre-filled in the Notes field of every new invoice. Edit bank details here to update globally.
        </p>
        <textarea
          rows={6}
          value={form.defaultPaymentInstructions}
          onChange={e => setForm(f => ({ ...f, defaultPaymentInstructions: e.target.value }))}
          className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary font-mono resize-none outline-none focus:border-accent transition-colors"
        />
      </Card>

      {/* ── Categories ───────────────────────────────────────────────────────── */}
      <Card className="p-4 md:p-5">
        <h3 className="font-display font-bold text-text-primary text-base mb-5">Categories</h3>
        <div className="space-y-6">
          <CategoryEditor label="Expense Categories"    field="expenseCategories"   />
          <Divider />
          <CategoryEditor label="My Expense Categories" field="myExpenseCategories" />
          <Divider />
          <CategoryEditor label="Inventory Categories"  field="inventoryCategories" />
          <Divider />
          <CategoryEditor label="Preset Invoice Items"  field="presetInvoiceItems" />
        </div>
      </Card>

      {/* ── Account / danger zone ────────────────────────────────────────────── */}
      <Card className="p-4 md:p-5">
        <h3 className="font-display font-bold text-text-primary text-base mb-4">Account</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-bg-elevated rounded-xl">
            <div>
              <div className="text-sm text-text-primary font-body">Export Full Backup</div>
              <div className="text-xs text-text-muted font-body">Download all data as a JSON file</div>
            </div>
            <Button variant="ghost" size="sm" onClick={handleExport} icon={Download}>Export</Button>
          </div>
          <div className="flex items-center justify-between p-3 bg-red-500/5 border border-red-500/10 rounded-xl">
            <div>
              <div className="text-sm text-text-primary font-body">Sign Out</div>
              <div className="text-xs text-text-muted font-body">You'll need to sign in again to access the app</div>
            </div>
            <Button variant="danger" size="sm" onClick={onSignOut} icon={LogOut}>Sign Out</Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
