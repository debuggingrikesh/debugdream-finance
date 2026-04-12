import { useState } from 'react'
import { Car, Plus } from 'lucide-react'
import { useCarLoan } from '../../hooks/useFirestore'
import { addDocument, updateDocument } from '../../firebase/firestore'
import { formatNPR } from '../../utils/formatUtils'
import { todayString, adToBS } from '../../utils/dateUtils'
import { Card, SectionHeader, Button, Modal, Input, EmptyState, ProgressBar } from '../../components/ui/index'

export default function CarLoan() {
  const { setup, payments, totalPaid, outstanding, loading } = useCarLoan()
  const [showSetup, setShowSetup] = useState(false)
  const [setupForm, setSetupForm] = useState({ lender: '', totalAmount: '', emiAmount: '62372', startDate: '', tenureMonths: '', interestRate: '' })
  const [saving, setSaving] = useState(false)

  const emisCompleted = payments.length
  const totalEMIs = setup?.tenureMonths || 0
  const estimatedPayoff = setup?.startDate && setup?.tenureMonths
    ? (() => {
        const d = new Date(setup.startDate)
        d.setMonth(d.getMonth() + parseInt(setup.tenureMonths))
        return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      })()
    : '—'

  const handleSaveSetup = async () => {
    setSaving(true)
    try {
      await addDocument('carLoan', {
        ...setupForm,
        totalAmount: parseFloat(setupForm.totalAmount) || 0,
        emiAmount: parseFloat(setupForm.emiAmount) || 62372,
        tenureMonths: parseInt(setupForm.tenureMonths) || 0,
        interestRate: parseFloat(setupForm.interestRate) || 0,
      })
      setShowSetup(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <SectionHeader
        title="Car Loan"
        subtitle="EMI tracker — auto-synced from expenses"
        action={!setup && <Button onClick={() => setShowSetup(true)} icon={Plus}>Setup Loan</Button>}
      />

      {!setup ? (
        <EmptyState icon={Car} title="Car loan not configured" description="Set up your car loan details to track EMI payments automatically." action={<Button onClick={() => setShowSetup(true)} icon={Plus}>Setup Loan</Button>} />
      ) : (
        <>
          {/* Loan overview */}
          <Card className="p-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="text-xs text-[#555] font-body uppercase tracking-wider mb-1">Lender</div>
                <div className="font-display font-bold text-white text-xl">{setup.lender || 'Loan'}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-[#555] font-body uppercase tracking-wider mb-1">Monthly EMI</div>
                <div className="font-mono text-[#E8192C] text-2xl font-bold">{formatNPR(setup.emiAmount)}</div>
              </div>
            </div>

            <ProgressBar value={totalPaid} max={setup.totalAmount} label="" showPercent={false} />
            <div className="flex justify-between text-xs font-body text-[#555] mt-1.5">
              <span>Paid: {formatNPR(totalPaid)}</span>
              <span>Outstanding: {formatNPR(outstanding)}</span>
            </div>

            <div className="grid grid-cols-4 gap-4 mt-6 pt-5 border-t border-[#2a2a2a]">
              <div><div className="text-xs text-[#555] mb-0.5">Total Loan</div><div className="font-mono text-white font-bold">{formatNPR(setup.totalAmount)}</div></div>
              <div><div className="text-xs text-[#555] mb-0.5">EMIs Done</div><div className="font-mono text-white font-bold">{emisCompleted} / {totalEMIs || '?'}</div></div>
              <div><div className="text-xs text-[#555] mb-0.5">Outstanding</div><div className="font-mono text-[#E8192C] font-bold">{formatNPR(outstanding)}</div></div>
              <div><div className="text-xs text-[#555] mb-0.5">Payoff Est.</div><div className="font-mono text-white font-bold">{estimatedPayoff}</div></div>
            </div>
          </Card>

          {/* Payment history */}
          <Card className="p-5">
            <h3 className="font-display font-bold text-white text-sm mb-4">Payment History · {payments.length} EMIs</h3>
            {payments.length === 0 ? (
              <p className="text-[#333] text-sm font-body text-center py-6">No payments yet. Log an expense with "Car Loan EMI" category to auto-record here.</p>
            ) : (
              <div className="space-y-2">
                {payments.map((p, i) => (
                  <div key={p.id} className="flex items-center justify-between py-2.5 border-b border-[#1a1a1a] last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-[#1a1a1a] flex items-center justify-center text-[10px] font-mono text-[#555]">
                        {payments.length - i}
                      </div>
                      <div>
                        <div className="text-sm text-white font-body">{p.date}</div>
                        {p.notes && <div className="text-xs text-[#444]">{p.notes}</div>}
                      </div>
                    </div>
                    <span className="font-mono text-white text-sm">{formatNPR(p.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      <Modal isOpen={showSetup} onClose={() => setShowSetup(false)} title="Car Loan Setup" size="sm"
        footer={<><Button variant="ghost" onClick={() => setShowSetup(false)}>Cancel</Button><Button onClick={handleSaveSetup} loading={saving}>Save</Button></>}>
        <div className="space-y-4">
          <Input label="Lender / Bank" value={setupForm.lender} onChange={e => setSetupForm(f => ({ ...f, lender: e.target.value }))} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Total Loan (NPR)" type="number" value={setupForm.totalAmount} onChange={e => setSetupForm(f => ({ ...f, totalAmount: e.target.value }))} />
            <Input label="EMI (NPR)" type="number" value={setupForm.emiAmount} onChange={e => setSetupForm(f => ({ ...f, emiAmount: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Start Date" type="date" value={setupForm.startDate} onChange={e => setSetupForm(f => ({ ...f, startDate: e.target.value }))} />
            <Input label="Tenure (months)" type="number" value={setupForm.tenureMonths} onChange={e => setSetupForm(f => ({ ...f, tenureMonths: e.target.value }))} />
          </div>
          <Input label="Interest Rate %" type="number" value={setupForm.interestRate} onChange={e => setSetupForm(f => ({ ...f, interestRate: e.target.value }))} />
        </div>
      </Modal>
    </div>
  )
}
