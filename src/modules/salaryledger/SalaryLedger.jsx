// ─── Salary Ledger ───────────────────────────────────────────────────────────
import { useState, useMemo } from 'react'
import { BookOpen, DollarSign, TrendingDown } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useSalaryLedger, usePayrollRuns } from '../../hooks/useFirestore'
import { addDocument, updateDocument } from '../../firebase/firestore'
import { formatNPR } from '../../utils/formatUtils'
import { BS_MONTHS, todayString } from '../../utils/dateUtils'
import { calculateRikeshPayroll } from '../../utils/payrollUtils'
import { Card, SectionHeader, Button, Modal, Input, Badge, EmptyState } from '../../components/ui/index'
import clsx from 'clsx'

export default function SalaryLedger() {
  const { settings } = useApp()
  const { data: ledger, loading } = useSalaryLedger()
  const { data: payrollRuns } = usePayrollRuns()

  const [showPayment, setShowPayment] = useState(null)
  const [payForm, setPayForm] = useState({ amount: '', date: todayString(), source: 'bank' })
  const [saving, setSaving] = useState(false)

  const sorted = [...ledger].sort((a, b) => (b.monthKey || '').localeCompare(a.monthKey || ''))

  const totalAccrued = ledger.reduce((s, l) => s + (l.grossAccrued || 0), 0)
  const totalEMIDeducted = ledger.reduce((s, l) => s + (l.carLoanEMI || 0), 0)
  const totalPaid = ledger.reduce((s, l) => s + (l.totalPaid || 0), 0)
  const netOwed = totalAccrued - totalEMIDeducted - totalPaid

  const handleLogPayment = async () => {
    if (!showPayment || !payForm.amount) return
    setSaving(true)
    try {
      const amt = parseFloat(payForm.amount)
      const current = showPayment.totalPaid || 0
      await updateDocument('salaryLedger', showPayment.id, {
        totalPaid: current + amt,
        status: (current + amt) >= (showPayment.netOwed || 0) ? 'paid' : 'partially_paid',
        payments: [...(showPayment.payments || []), { amount: amt, date: payForm.date, source: payForm.source }],
      })
      // Create TDS reminder
      await addDocument('reminders', {
        title: `Rikesh TDS for ${showPayment.monthLabel}`,
        amount: Math.round(amt * 0.01), // approximate
        dueDate: payForm.date,
        status: 'active',
        type: 'tds',
      })
      setShowPayment(null)
    } finally {
      setSaving(false)
    }
  }

  const getStatusBadge = (entry) => {
    const paid = entry.totalPaid || 0
    const owed = entry.netOwed || 0
    if (paid >= owed && owed > 0) return <Badge variant="success">Paid</Badge>
    if (paid > 0) return <Badge variant="warning">Partial</Badge>
    return <Badge variant="danger">Unpaid</Badge>
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <SectionHeader title="Salary Ledger" subtitle="Rikesh's salary accrual, EMI deductions & payment tracking" />

      {/* Summary */}
      <div className="grid grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="text-xs text-[#555] font-body uppercase tracking-wider mb-1">Total Accrued</div>
          <div className="font-mono text-white text-lg font-bold">{formatNPR(totalAccrued)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-[#555] font-body uppercase tracking-wider mb-1">EMI Deducted</div>
          <div className="font-mono text-[#E8192C] text-lg font-bold">-{formatNPR(totalEMIDeducted)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-[#555] font-body uppercase tracking-wider mb-1">Total Paid Out</div>
          <div className="font-mono text-green-400 text-lg font-bold">{formatNPR(totalPaid)}</div>
        </Card>
        <Card className="p-4 border-l-4 border-l-[#E8192C]">
          <div className="text-xs text-[#555] font-body uppercase tracking-wider mb-1">Net Still Owed</div>
          <div className="font-mono text-[#E8192C] text-2xl font-bold">{formatNPR(netOwed)}</div>
        </Card>
      </div>

      {/* Ledger table */}
      <Card className="p-5">
        {sorted.length === 0 ? (
          <EmptyState icon={BookOpen} title="No salary records" description="Salary entries are auto-created when payroll is run each month." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-body">
              <thead>
                <tr className="border-b border-[#2a2a2a]">
                  {['Month', 'Gross Accrued', 'SSF', 'Car Loan EMI', 'Net Owed', 'Paid Out', 'Status', ''].map((h, i) => (
                    <th key={i} className={clsx('pb-3 text-xs text-[#555] uppercase tracking-wider font-medium', i > 0 ? 'text-right' : 'text-left')}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a1a1a]">
                {sorted.map(entry => (
                  <tr key={entry.id} className="hover:bg-[#111] transition-colors">
                    <td className="py-3 font-body text-white">{entry.monthLabel}</td>
                    <td className="py-3 font-mono text-white text-right">{formatNPR(entry.grossAccrued)}</td>
                    <td className="py-3 font-mono text-yellow-400 text-right">-{formatNPR(entry.employeeSSF)}</td>
                    <td className="py-3 text-right">
                      <div className="font-mono text-[#E8192C]">-{formatNPR(entry.carLoanEMI)}</div>
                      <div className="text-[10px] text-[#333]">Car Loan EMI</div>
                    </td>
                    <td className="py-3 font-mono text-white text-right font-bold">{formatNPR(entry.netOwed)}</td>
                    <td className="py-3 font-mono text-green-400 text-right">{formatNPR(entry.totalPaid || 0)}</td>
                    <td className="py-3 text-right">{getStatusBadge(entry)}</td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => { setShowPayment(entry); setPayForm({ amount: entry.netOwed - (entry.totalPaid || 0), date: todayString(), source: 'bank' }) }}
                        className="text-xs text-[#555] hover:text-white border border-[#2a2a2a] hover:border-[#444] px-2 py-1 rounded-lg transition-all"
                      >
                        Log Payment
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        isOpen={!!showPayment}
        onClose={() => setShowPayment(null)}
        title={`Log Payment · ${showPayment?.monthLabel}`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowPayment(null)}>Cancel</Button>
            <Button onClick={handleLogPayment} loading={saving}>Log Payment</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="p-3 bg-[#1a1a1a] rounded-xl">
            <div className="flex justify-between text-sm"><span className="text-[#555]">Net owed</span><span className="font-mono text-white">{formatNPR(showPayment?.netOwed)}</span></div>
            <div className="flex justify-between text-sm mt-1"><span className="text-[#555]">Already paid</span><span className="font-mono text-green-400">{formatNPR(showPayment?.totalPaid || 0)}</span></div>
            <div className="border-t border-[#2a2a2a] my-2" />
            <div className="flex justify-between text-sm"><span className="text-[#555]">Remaining</span><span className="font-mono text-[#E8192C] font-bold">{formatNPR((showPayment?.netOwed || 0) - (showPayment?.totalPaid || 0))}</span></div>
          </div>
          <Input label="Amount Paying (NPR)" type="number" prefix="NPR" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} />
          <Input label="Payment Date" type="date" value={payForm.date} onChange={e => setPayForm(f => ({ ...f, date: e.target.value }))} />
          <div>
            <label className="text-xs text-[#888] font-body font-medium uppercase tracking-wider block mb-2">Source</label>
            <div className="flex gap-2">
              {['bank', 'cash'].map(s => (
                <button key={s} onClick={() => setPayForm(f => ({ ...f, source: s }))}
                  className={clsx('flex-1 py-2 rounded-lg text-sm font-body border capitalize transition-all',
                    payForm.source === s ? 'bg-[#E8192C]/10 border-[#E8192C] text-[#E8192C]' : 'bg-[#1a1a1a] border-[#2a2a2a] text-[#555]'
                  )}>
                  {s === 'bank' ? '🏦 Bank' : '💵 Cash'}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-[#444] font-body">TDS will be calculated on this payment and a reminder will be created.</p>
        </div>
      </Modal>
    </div>
  )
}
