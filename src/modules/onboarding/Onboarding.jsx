import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle, ChevronRight, ChevronLeft, Building2, Wallet, Users, Car, Image } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { addDocument } from '../../firebase/firestore'
import { DEFAULT_EMPLOYEES } from '../../utils/payrollUtils'
import { Input, Button } from '../../components/ui/index'
import clsx from 'clsx'

const STEPS = [
  { id: 1, icon: Wallet, label: 'Opening Balances' },
  { id: 2, icon: Building2, label: 'Company Details' },
  { id: 3, icon: Image, label: 'Logo' },
  { id: 4, icon: Users, label: 'Employees' },
  { id: 5, icon: Car, label: 'Car Loan' },
]

export default function Onboarding() {
  const navigate = useNavigate()
  const { updateSettings } = useApp()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    openingBank: '',
    openingCash: '',
    openingDate: new Date().toISOString().split('T')[0],
    company: {
      name: 'debugdream',
      pan: '622445250',
      registration: '375208',
      address: 'Old Baneshwor, Kathmandu, Nepal',
      website: 'www.debugdream.com',
    },
    logoBase64: null,
    employees: DEFAULT_EMPLOYEES,
    carLoan: {
      lender: '',
      totalAmount: '',
      emiAmount: '62372',
      startDate: '',
      tenureMonths: '',
      interestRate: '',
    },
  })

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))
  const setCompany = (key, val) => setForm(f => ({ ...f, company: { ...f.company, [key]: val } }))
  const setCarLoan = (key, val) => setForm(f => ({ ...f, carLoan: { ...f.carLoan, [key]: val } }))

  const handleLogoUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => set('logoBase64', ev.target.result)
    reader.readAsDataURL(file)
  }

  const handleComplete = async () => {
    setSaving(true)
    try {
      // Save settings
      await updateSettings({
        openingBank: parseFloat(form.openingBank) || 0,
        openingCash: parseFloat(form.openingCash) || 0,
        openingDate: form.openingDate,
        company: form.company,
        logoBase64: form.logoBase64,
        onboardingComplete: true,
      })

      // Save employees
      for (const emp of form.employees) {
        await addDocument('employees', emp)
      }

      // Save car loan if filled
      if (form.carLoan.totalAmount) {
        await addDocument('carLoan', {
          ...form.carLoan,
          totalAmount: parseFloat(form.carLoan.totalAmount) || 0,
          emiAmount: parseFloat(form.carLoan.emiAmount) || 62372,
          tenureMonths: parseInt(form.carLoan.tenureMonths) || 0,
          interestRate: parseFloat(form.carLoan.interestRate) || 0,
        })
      }

      navigate('/', { replace: true })
    } catch (err) {
      console.error(err)
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-6">
      <div className="w-full max-w-xl animate-fade-in">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="font-display font-black text-2xl text-text-primary mb-1">
            debug<span className="text-accent">dream</span> Finance
          </div>
          <p className="text-text-muted text-sm font-body">First-time setup · Step {step} of {STEPS.length}</p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center flex-1">
              <div className={clsx(
                'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all',
                step > s.id ? 'bg-status-success text-text-primary' :
                step === s.id ? 'bg-accent text-text-primary' :
                'bg-bg-elevated text-text-muted border border-border'
              )}>
                {step > s.id ? <CheckCircle size={14} /> : s.id}
              </div>
              {i < STEPS.length - 1 && (
                <div className={clsx('flex-1 h-px mx-1', step > s.id ? 'bg-status-success' : 'bg-border')} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-bg-surface border border-border rounded-2xl p-7">
          {step === 1 && (
            <StepBalances form={form} set={set} />
          )}
          {step === 2 && (
            <StepCompany form={form} setCompany={setCompany} />
          )}
          {step === 3 && (
            <StepLogo form={form} handleLogoUpload={handleLogoUpload} />
          )}
          {step === 4 && (
            <StepEmployees employees={form.employees} />
          )}
          {step === 5 && (
            <StepCarLoan form={form} setCarLoan={setCarLoan} />
          )}
        </div>

        {/* Nav buttons */}
        <div className="flex justify-between mt-5">
          <Button
            variant="ghost"
            onClick={() => setStep(s => s - 1)}
            disabled={step === 1}
            icon={ChevronLeft}
          >
            Back
          </Button>

          {step < STEPS.length ? (
            <Button onClick={() => setStep(s => s + 1)} icon={ChevronRight}>
              Continue
            </Button>
          ) : (
            <Button onClick={handleComplete} loading={saving} variant="success">
              Launch DebugDream Finance
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Step components ───────────────────────────────────────────────────────────

function StepBalances({ form, set }) {
  return (
    <div>
      <h2 className="font-display font-bold text-xl text-text-primary mb-1">Opening Balances</h2>
      <p className="text-text-muted text-sm font-body mb-6">Set your starting bank and cash amounts. The app calculates all balances forward from this date.</p>
      <div className="space-y-4">
        <Input label="Opening Bank Balance (NPR)" type="number" prefix="NPR" value={form.openingBank} onChange={e => set('openingBank', e.target.value)} placeholder="0" />
        <Input label="Cash in Hand (NPR)" type="number" prefix="NPR" value={form.openingCash} onChange={e => set('openingCash', e.target.value)} placeholder="0" />
        <Input label="Balance Start Date (AD)" type="date" value={form.openingDate} onChange={e => set('openingDate', e.target.value)} />
      </div>
    </div>
  )
}

function StepCompany({ form, setCompany }) {
  return (
    <div>
      <h2 className="font-display font-bold text-xl text-text-primary mb-1">Company Details</h2>
      <p className="text-text-muted text-sm font-body mb-6">Pre-filled with your details. Edit if needed — these appear on all invoices and payslips.</p>
      <div className="space-y-4">
        <Input label="Company Name" value={form.company.name} onChange={e => setCompany('name', e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="PAN Number" value={form.company.pan} onChange={e => setCompany('pan', e.target.value)} />
          <Input label="Registration No." value={form.company.registration} onChange={e => setCompany('registration', e.target.value)} />
        </div>
        <Input label="Address" value={form.company.address} onChange={e => setCompany('address', e.target.value)} />
        <Input label="Website" value={form.company.website} onChange={e => setCompany('website', e.target.value)} />
      </div>
    </div>
  )
}

function StepLogo({ form, handleLogoUpload }) {
  return (
    <div>
      <h2 className="font-display font-bold text-xl text-text-primary mb-1">Company Logo</h2>
      <p className="text-text-muted text-sm font-body mb-6">Upload your logo — it'll appear in the app header and on all generated PDFs.</p>
      <label className="block w-full border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-accent/50 transition-colors">
        <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
        {form.logoBase64 ? (
          <div>
            <img src={form.logoBase64} alt="Logo preview" className="h-16 mx-auto object-contain mb-3" />
            <p className="text-text-muted text-sm">Click to change</p>
          </div>
        ) : (
          <div>
            <Image size={32} className="mx-auto text-text-muted mb-3" />
            <p className="text-text-primary text-sm font-body mb-1">Click to upload logo</p>
            <p className="text-text-muted text-xs">PNG, JPG · Transparent PNG recommended</p>
          </div>
        )}
      </label>
      <p className="text-xs text-text-muted mt-3 text-center">You can also upload this later in Settings</p>
    </div>
  )
}

function StepEmployees({ employees }) {
  return (
    <div>
      <h2 className="font-display font-bold text-xl text-text-primary mb-1">Team</h2>
      <p className="text-text-muted text-sm font-body mb-5">Your team is pre-configured. You can edit individual details in Payroll → Settings after launch.</p>
      <div className="space-y-2">
        {employees.map(emp => (
          <div key={emp.id} className="flex items-center justify-between p-3 bg-bg-elevated rounded-xl">
            <div>
              <div className="font-body font-medium text-text-primary text-sm">{emp.name}</div>
              <div className="text-text-muted text-xs capitalize">
                {emp.type === 'fulltime' ? `Full-time · CTC NPR ${emp.ctc?.toLocaleString()}` : `${emp.type} · NPR ${emp.flatPay?.toLocaleString()}/mo`}
              </div>
            </div>
            {emp.isOwner && (
              <span className="text-xs text-accent font-body border border-accent/20 px-2 py-0.5 rounded-md">CEO</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function StepCarLoan({ form, setCarLoan }) {
  return (
    <div>
      <h2 className="font-display font-bold text-xl text-text-primary mb-1">Car Loan</h2>
      <p className="text-text-muted text-sm font-body mb-6">Set up your vehicle loan. The EMI is pre-filled. Skip if not applicable.</p>
      <div className="space-y-4">
        <Input label="Lender / Bank Name" value={form.carLoan.lender} onChange={e => setCarLoan('lender', e.target.value)} placeholder="e.g. NMB Bank" />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Total Loan Amount (NPR)" type="number" value={form.carLoan.totalAmount} onChange={e => setCarLoan('totalAmount', e.target.value)} />
          <Input label="Monthly EMI (NPR)" type="number" value={form.carLoan.emiAmount} onChange={e => setCarLoan('emiAmount', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Loan Start Date" type="date" value={form.carLoan.startDate} onChange={e => setCarLoan('startDate', e.target.value)} />
          <Input label="Tenure (months)" type="number" value={form.carLoan.tenureMonths} onChange={e => setCarLoan('tenureMonths', e.target.value)} />
        </div>
        <Input label="Interest Rate % (optional)" type="number" value={form.carLoan.interestRate} onChange={e => setCarLoan('interestRate', e.target.value)} />
      </div>
    </div>
  )
}
