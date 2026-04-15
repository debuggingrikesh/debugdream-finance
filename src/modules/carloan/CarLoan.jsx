import { useState } from 'react'
import { Car, Plus, History, Pencil, Settings2 } from 'lucide-react'
import { useCarLoan } from '../../hooks/useFirestore'
import { addDocument, updateDocument } from '../../firebase/firestore'
import { formatNPR } from '../../utils/formatUtils'
import { todayString, adToBS } from '../../utils/dateUtils'
import { Card, SectionHeader, Button, Modal, Input, EmptyState, ProgressBar } from '../../components/ui/index'
import clsx from 'clsx'

export default function CarLoan() {
  const { setup, payments, totalPaid, outstanding, loading } = useCarLoan()

  // ── Setup modal state ─────────────────────────────────────────────────────
  const [showSetup, setShowSetup]   = useState(false)
  const [setupForm, setSetupForm]   = useState({
    lender: '', totalAmount: '', emiAmount: '62372',
    startDate: '', tenureMonths: '', interestRate: '',
  })
  const [setupSaving, setSetupSaving] = useState(false)

  // ── Past EMI modal state ──────────────────────────────────────────────────
  const [showPast, setShowPast]   = useState(false)
  const [pastForm, setPastForm]   = useState({ date: '', amount: '62372', notes: '' })
  const [pastSaving, setPastSaving] = useState(false)

  // ── Edit EMI modal state ──────────────────────────────────────────────────
  const [editPayment, setEditPayment]     = useState(null)
  const [editPayForm, setEditPayForm]     = useState({ date: '', amount: '', notes: '' })
  const [editPaySaving, setEditPaySaving] = useState(false)

  // ── Edit Setup modal state ────────────────────────────────────────────────
  const [showEditSetup, setShowEditSetup]     = useState(false)
  const [editSetupForm, setEditSetupForm]     = useState({})
  const [editSetupSaving, setEditSetupSaving] = useState(false)

  // ── Derived stats ─────────────────────────────────────────────────────────
  const emisCompleted = payments.length
  const totalEMIs     = setup?.tenureMonths || 0
  const estimatedPayoff = setup?.startDate && setup?.tenureMonths
    ? (() => {
        const d = new Date(setup.startDate)
        d.setMonth(d.getMonth() + parseInt(setup.tenureMonths))
        return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      })()
    : '—'

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSaveSetup = async () => {
    setSetupSaving(true)
    try {
      await addDocument('carLoan', {
        lender:       setupForm.lender,
        totalAmount:  parseFloat(setupForm.totalAmount)  || 0,
        emiAmount:    parseFloat(setupForm.emiAmount)    || 62372,
        tenureMonths: parseInt(setupForm.tenureMonths)   || 0,
        interestRate: parseFloat(setupForm.interestRate) || 0,
        startDate:    setupForm.startDate,
      })
      setShowSetup(false)
    } finally {
      setSetupSaving(false)
    }
  }

  // Adds a payment to carLoanPayments collection.
  // The useCarLoan hook live-calculates totalPaid and outstanding from this
  // collection via subscribeToCollection, so the numbers update immediately.
  const handleLogPastPayment = async () => {
    if (!pastForm.date || !pastForm.amount) return
    setPastSaving(true)
    const bs = adToBS(new Date(pastForm.date + 'T00:00:00'))
    try {
      await addDocument('carLoanPayments', {
        date:         pastForm.date,
        amount:       parseFloat(pastForm.amount) || 0,
        notes:        pastForm.notes || 'Past EMI (pre-app)',
        bsYear:       bs.year,
        bsMonth:      bs.month,
        isPastEntry:  true,
      })
      setShowPast(false)
      setPastForm({ date: '', amount: '62372', notes: '' })
    } finally {
      setPastSaving(false)
    }
  }

  // Edit an existing payment
  const handleEditPayment = async () => {
    if (!editPayment || !editPayForm.amount) return
    setEditPaySaving(true)
    try {
      await updateDocument('carLoanPayments', editPayment.id, {
        date:   editPayForm.date,
        amount: parseFloat(editPayForm.amount) || 0,
        notes:  editPayForm.notes,
      })
      setEditPayment(null)
    } finally {
      setEditPaySaving(false)
    }
  }

  const openEditPayment = (payment) => {
    setEditPayment(payment)
    setEditPayForm({
      date:   payment.date || '',
      amount: String(payment.amount || ''),
      notes:  payment.notes || '',
    })
  }

  // Edit loan setup
  const handleEditSetup = async () => {
    if (!setup) return
    setEditSetupSaving(true)
    try {
      await updateDocument('carLoan', setup.id, {
        lender:       editSetupForm.lender,
        totalAmount:  parseFloat(editSetupForm.totalAmount) || 0,
        emiAmount:    parseFloat(editSetupForm.emiAmount) || 0,
        tenureMonths: parseInt(editSetupForm.tenureMonths) || 0,
        interestRate: parseFloat(editSetupForm.interestRate) || 0,
        startDate:    editSetupForm.startDate,
      })
      setShowEditSetup(false)
    } finally {
      setEditSetupSaving(false)
    }
  }

  const openEditSetup = () => {
    setEditSetupForm({
      lender:       setup?.lender || '',
      totalAmount:  String(setup?.totalAmount || ''),
      emiAmount:    String(setup?.emiAmount || ''),
      tenureMonths: String(setup?.tenureMonths || ''),
      interestRate: String(setup?.interestRate || ''),
      startDate:    setup?.startDate || '',
    })
    setShowEditSetup(true)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <SectionHeader
        title="Car Loan"
        subtitle="EMI tracker — auto-synced from expenses"
        action={
          <div className="flex gap-2">
            {setup && (
              <>
                <Button variant="ghost" size="sm" onClick={openEditSetup} icon={Settings2}>
                  Edit Setup
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setShowPast(true)} icon={History}>
                  Log Past EMI
                </Button>
              </>
            )}
            {!setup && (
              <Button onClick={() => setShowSetup(true)} icon={Plus}>Setup Loan</Button>
            )}
          </div>
        }
      />

      {!setup ? (
        <EmptyState
          icon={Car}
          title="Car loan not configured"
          description="Set up your car loan details to track EMI payments and outstanding balance automatically."
          action={<Button onClick={() => setShowSetup(true)} icon={Plus}>Setup Loan</Button>}
        />
      ) : (
        <>
          {/* ── Loan overview card ─────────────────────────────────────────── */}
          <Card className="p-5 md:p-6">
            <div className="flex items-start justify-between mb-5">
              <div>
                <div className="text-xs text-text-muted font-body uppercase tracking-wider mb-1">Lender</div>
                <div className="font-display font-bold text-text-primary text-xl">{setup.lender || 'Loan'}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-text-muted font-body uppercase tracking-wider mb-1">Monthly EMI</div>
                <div className="font-mono text-accent text-2xl font-bold">{formatNPR(setup.emiAmount)}</div>
              </div>
            </div>

            <ProgressBar value={totalPaid} max={setup.totalAmount} showPercent={false} />
            <div className="flex justify-between text-xs font-body text-text-muted mt-1.5">
              <span>Paid: {formatNPR(totalPaid)}</span>
              <span>Outstanding: {formatNPR(outstanding)}</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 pt-5 border-t border-border">
              <div>
                <div className="text-xs text-text-muted mb-0.5">Total Loan</div>
                <div className="font-mono text-text-primary font-bold">{formatNPR(setup.totalAmount)}</div>
              </div>
              <div>
                <div className="text-xs text-text-muted mb-0.5">EMIs Done</div>
                <div className="font-mono text-text-primary font-bold">{emisCompleted} / {totalEMIs || '?'}</div>
              </div>
              <div>
                <div className="text-xs text-text-muted mb-0.5">Outstanding</div>
                <div className="font-mono text-accent font-bold">{formatNPR(outstanding)}</div>
              </div>
              <div>
                <div className="text-xs text-text-muted mb-0.5">Payoff Est.</div>
                <div className="font-mono text-text-primary font-bold">{estimatedPayoff}</div>
              </div>
            </div>
          </Card>

          {/* ── Payment history ──────────────────────────────────────────────── */}
          <Card className="p-5">
            <h3 className="font-display font-bold text-text-primary text-sm mb-4">
              Payment History · {payments.length} EMI{payments.length !== 1 ? 's' : ''}
            </h3>
            {payments.length === 0 ? (
              <div className="py-6 text-center space-y-2">
                <p className="text-text-muted text-sm font-body">
                  No payments yet. Log an expense under "Car Loan EMI" category to auto-record here.
                </p>
                <Button variant="ghost" size="sm" onClick={() => setShowPast(true)} icon={History}>
                  Log Past EMI
                </Button>
              </div>
            ) : (
              <div className="space-y-0">
                {payments.map((p, i) => (
                  <div key={p.id} className="flex items-center justify-between py-2.5 border-b border-bg-elevated last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-bg-elevated flex items-center justify-center text-[10px] font-mono text-text-muted">
                        {payments.length - i}
                      </div>
                      <div>
                        <div className="text-sm text-text-primary font-body">{p.date}</div>
                        <div className="flex items-center gap-2">
                          {p.notes && <div className="text-xs text-text-muted">{p.notes}</div>}
                          {p.isPastEntry && (
                            <span className="text-[10px] text-yellow-500 border border-yellow-500/20 px-1.5 py-0.5 rounded font-body">past entry</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-text-primary text-sm">{formatNPR(p.amount)}</span>
                      <button
                        onClick={() => openEditPayment(p)}
                        className="w-7 h-7 rounded-lg hover:bg-bg-elevated flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
                        title="Edit payment"
                      >
                        <Pencil size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      {/* ── Setup modal ───────────────────────────────────────────────────────── */}
      <Modal
        isOpen={showSetup}
        onClose={() => setShowSetup(false)}
        title="Car Loan Setup"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowSetup(false)}>Cancel</Button>
            <Button onClick={handleSaveSetup} loading={setupSaving}>Save</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Lender / Bank" value={setupForm.lender} onChange={e => setSetupForm(f => ({ ...f, lender: e.target.value }))} placeholder="e.g. NMB Bank" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Total Loan (NPR)" type="number" value={setupForm.totalAmount} onChange={e => setSetupForm(f => ({ ...f, totalAmount: e.target.value }))} />
            <Input label="EMI (NPR)" type="number" value={setupForm.emiAmount} onChange={e => setSetupForm(f => ({ ...f, emiAmount: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Start Date" type="date" value={setupForm.startDate} onChange={e => setSetupForm(f => ({ ...f, startDate: e.target.value }))} />
            <Input label="Tenure (months)" type="number" value={setupForm.tenureMonths} onChange={e => setSetupForm(f => ({ ...f, tenureMonths: e.target.value }))} />
          </div>
          <Input label="Interest Rate % (optional)" type="number" value={setupForm.interestRate} onChange={e => setSetupForm(f => ({ ...f, interestRate: e.target.value }))} />
        </div>
      </Modal>

      {/* ── Log past EMI modal ────────────────────────────────────────────────── */}
      <Modal
        isOpen={showPast}
        onClose={() => setShowPast(false)}
        title="Log Past EMI Payment"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowPast(false)}>Cancel</Button>
            <Button onClick={handleLogPastPayment} loading={pastSaving} disabled={!pastForm.date || !pastForm.amount}>
              Log Payment
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <p className="text-xs text-blue-400 font-body">
              Adds a payment directly to the history. The outstanding balance and EMI count update automatically.
              Use this for any EMI paid before you set up the app.
            </p>
          </div>
          <Input
            label="Payment Date (AD)"
            type="date"
            value={pastForm.date}
            onChange={e => setPastForm(f => ({ ...f, date: e.target.value }))}
          />
          <Input
            label="Amount (NPR)"
            type="number"
            prefix="NPR"
            value={pastForm.amount}
            onChange={e => setPastForm(f => ({ ...f, amount: e.target.value }))}
          />
          <Input
            label="Notes (optional)"
            value={pastForm.notes}
            onChange={e => setPastForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="e.g. Paid before app setup"
          />
        </div>
      </Modal>

      {/* ── Edit EMI payment modal ──────────────────────────────────────────────── */}
      <Modal
        isOpen={!!editPayment}
        onClose={() => setEditPayment(null)}
        title="Edit EMI Payment"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditPayment(null)}>Cancel</Button>
            <Button onClick={handleEditPayment} loading={editPaySaving} disabled={!editPayForm.date || !editPayForm.amount}>
              Save Changes
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <p className="text-xs text-yellow-400 font-body">
              Edit this payment's amount if your EMI changed due to floating interest rate.
              Outstanding balance will recalculate automatically.
            </p>
          </div>
          <Input
            label="Payment Date (AD)"
            type="date"
            value={editPayForm.date}
            onChange={e => setEditPayForm(f => ({ ...f, date: e.target.value }))}
          />
          <Input
            label="Amount (NPR)"
            type="number"
            prefix="NPR"
            value={editPayForm.amount}
            onChange={e => setEditPayForm(f => ({ ...f, amount: e.target.value }))}
          />
          <Input
            label="Notes (optional)"
            value={editPayForm.notes}
            onChange={e => setEditPayForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="e.g. Interest rate changed"
          />
        </div>
      </Modal>

      {/* ── Edit Loan Setup modal ──────────────────────────────────────────────── */}
      <Modal
        isOpen={showEditSetup}
        onClose={() => setShowEditSetup(false)}
        title="Edit Car Loan Setup"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowEditSetup(false)}>Cancel</Button>
            <Button onClick={handleEditSetup} loading={editSetupSaving}>Save</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Lender / Bank" value={editSetupForm.lender} onChange={e => setEditSetupForm(f => ({ ...f, lender: e.target.value }))} placeholder="e.g. NMB Bank" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Total Loan (NPR)" type="number" value={editSetupForm.totalAmount} onChange={e => setEditSetupForm(f => ({ ...f, totalAmount: e.target.value }))} />
            <Input label="EMI (NPR)" type="number" value={editSetupForm.emiAmount} onChange={e => setEditSetupForm(f => ({ ...f, emiAmount: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Start Date" type="date" value={editSetupForm.startDate} onChange={e => setEditSetupForm(f => ({ ...f, startDate: e.target.value }))} />
            <Input label="Tenure (months)" type="number" value={editSetupForm.tenureMonths} onChange={e => setEditSetupForm(f => ({ ...f, tenureMonths: e.target.value }))} />
          </div>
          <Input label="Interest Rate % (optional)" type="number" value={editSetupForm.interestRate} onChange={e => setEditSetupForm(f => ({ ...f, interestRate: e.target.value }))} />
        </div>
      </Modal>
    </div>
  )
}
