// ─── Rikesh's Salary Ledger ───────────────────────────────────────────────────
import { useState } from 'react'
import { BookOpen, Wallet, CreditCard, MinusCircle, Edit2, PlusCircle, ArrowUpDown, RefreshCcw } from 'lucide-react'
import { useSalaryLedger, useCarLoan } from '../../hooks/useFirestore'
import { addDocument, updateDocument, deleteDocument } from '../../firebase/firestore'
import { formatNPR } from '../../utils/formatUtils'
import { todayString, adToBS, BS_MONTHS } from '../../utils/dateUtils'
import { Card, SectionHeader, Button, Modal, Input, Badge, EmptyState } from '../../components/ui/index'
import clsx from 'clsx'

export default function SalaryLedger() {
  const { data: ledger, loading: ledgerLoading } = useSalaryLedger()
  const { setup: carLoan, payments: carPayments, loading: loanLoading } = useCarLoan()

  const [showPayment, setShowPayment] = useState(null)
  const [payForm, setPayForm] = useState({ amount: '', date: todayString(), source: 'bank' })
  const [saving, setSaving] = useState(false)
  const [sortOrder, setSortOrder] = useState('desc') // 'desc' = newest first, 'asc' = oldest first
  const [isSyncing, setIsSyncing] = useState(false)

  const AGREED_SALARY = 150000
  const currentEMI    = carLoan?.emiAmount || 0

  const extractMonthKey = (label, key) => {
    if (key && key !== '0000-00') return key
    if (!label) return key
    const parts = label.trim().split(' ')
    if (parts.length >= 2) {
      const monthName = parts[0]
      const year = parts[1]
      const idx = BS_MONTHS.findIndex(m => m.toLowerCase() === monthName.toLowerCase())
      if (idx !== -1 && !isNaN(parseInt(year))) {
        return `${year}-${String(idx + 1).padStart(2, '0')}`
      }
    }
    return key
  }

  const sorted = [...ledger].sort((a, b) => {
    const keyA = extractMonthKey(a.monthLabel, a.monthKey)
    const keyB = extractMonthKey(b.monthLabel, b.monthKey)
    const cmp = (keyA || '').localeCompare(keyB || '')
    return sortOrder === 'desc' ? -cmp : cmp
  })

  // Computed Values
  const totalAccrued    = ledger.reduce((s, l) => s + (l.grossAccrued || AGREED_SALARY), 0)
  const totalEMIDeducted = ledger.reduce((s, l) => s + (l.carLoanEMI !== undefined ? l.carLoanEMI : currentEMI), 0)
  const totalPaid       = ledger.reduce((s, l) => s + (l.totalPaid || 0), 0)
  const netDueTotal     = totalAccrued - totalEMIDeducted
  const netBalance      = netDueTotal - totalPaid

  const handleLogPayment = async () => {
    if (!showPayment || !payForm.amount) return
    setSaving(true)
    try {
      const amt = parseFloat(payForm.amount)
      const current = showPayment.totalPaid || 0
      await updateDocument('salaryLedger', showPayment.id, {
        totalPaid: current + amt,
        payments: [
          ...(showPayment.payments || []), 
          { amount: amt, date: payForm.date, source: payForm.source, type: 'withdrawal' }
        ],
      })

      // ── Automated Expense Entry ───────────────────────────────────────────
      // When a withdrawal is recorded in the ledger, it becomes a CASH expense for the company.
      const bs = adToBS(payForm.date)
      await addDocument('expenses', {
        date:          payForm.date,
        category:      'Salary',
        description:   `CEO Salary Withdrawal - ${showPayment.monthLabel}`,
        amount:        amt,
        paymentSource: payForm.source,
        type:          'expense',
        bsYear:        bs.year,
        bsMonth:       bs.month,
        bsDay:         bs.day,
        bsMonthName:   bs.monthName,
        linkedLedger:  showPayment.id,
      })

      setShowPayment(null)
    } finally {
      setSaving(false)
    }
  }

  const handleEditField = async (id, field, currentVal) => {
    const newVal = prompt(`Enter new value for ${field}:`, currentVal)
    if (newVal === null || newVal === '') return
    try {
      const val = parseFloat(newVal)
      await updateDocument('salaryLedger', id, { [field]: val })
      
      // If editing EMI, sync to car loan
      if (field === 'carLoanEMI') {
        const entry = ledger.find(l => l.id === id)
        if (entry) {
          await syncEMIToCarLoan({ ...entry, [field]: val })
        }
      }
    } catch (e) { console.error(e) }
  }

  // ── EMI Sync Logic ────────────────────────────────────────────────────────
  const syncEMIToCarLoan = async (entry) => {
    const emi = entry.carLoanEMI || 0
    const existing = carPayments.find(p => p.linkedLedgerId === entry.id)

    if (emi > 0) {
      // Approximate AD date from BS monthKey (BS Year - 57)
      // Standardizes to 1st of the month
      let dateStr = ''
      let bsYear = 0
      let bsMonth = 0

      if (entry.monthKey) {
          const parts = entry.monthKey.split('-')
          bsYear = parseInt(parts[0])
          bsMonth = parseInt(parts[1])
          
          // Logic: Baisakh (1) -> May (5), Chaitra (12) -> April (4) next year
          let adYear = bsYear - 57
          let adMonth = bsMonth + 4
          if (adMonth > 12) {
            adMonth -= 12
            adYear += 1
          }
          dateStr = `${adYear}-${String(adMonth).padStart(2, '0')}-01`
      }

      const paymentData = {
        amount: emi,
        date: dateStr || todayString(),
        notes: `EMI from Salary Ledger - ${entry.monthLabel}`,
        bsYear,
        bsMonth,
        linkedLedgerId: entry.id,
        isLedgerSync: true
      }

      if (existing) {
        await updateDocument('carLoanPayments', existing.id, paymentData)
      } else {
        await addDocument('carLoanPayments', paymentData)
      }
    } else if (existing) {
      // If EMI is removed/zeroed in ledger, delete the car payment
      await deleteDocument('carLoanPayments', existing.id)
    }
  }

  const handleSyncAll = async () => {
    if (!confirm("This will scan all ledger entries and reconcile them with the Car Loan payment history. Continue?")) return
    setIsSyncing(true)
    try {
      for (const entry of ledger) {
        await syncEMIToCarLoan(entry)
      }
      alert("Synchronization complete!")
    } catch (err) {
      console.error(err)
      alert("Sync failed: " + err.message)
    } finally {
      setIsSyncing(false)
    }
  }

  const handleAddPrevMonth = async () => {
    const defaultYear = new Date().getFullYear() + 57
    const yearStr = prompt("Enter BS Year (e.g. 2081):", String(defaultYear))
    if (!yearStr) return
    const monthStr = prompt("Enter BS Month Number (1=Baisakh, 12=Chaitra):")
    if (!monthStr) return

    const bsYear = parseInt(yearStr)
    const bsMonth = parseInt(monthStr)
    if (isNaN(bsYear) || isNaN(bsMonth) || bsMonth < 1 || bsMonth > 12) {
      alert("Invalid Year or Month")
      return
    }

    const monthKey = `${bsYear}-${String(bsMonth).padStart(2, '0')}`
    const label = `${BS_MONTHS[bsMonth - 1]} ${bsYear}`

    const gross = prompt("Enter Agreed Salary (NPR):", "150000")
    if (!gross) return
    const emi = prompt("Enter Loan/EMI for this month (NPR):", "0")
    if (emi === null) return
    const taken = prompt("Enter Already Taken/Withdrawn (NPR):", "0")
    if (taken === null) return

    try {
      const g = parseFloat(gross)
      const e = parseFloat(emi)
      const t = parseFloat(taken)
      const newId = await addDocument('salaryLedger', {
        monthLabel: label,
        monthKey: monthKey,
        grossAccrued: g,
        carLoanEMI: e,
        totalPaid: t,
        status: t >= (g - e) ? 'cleared' : (t > 0 ? 'partial' : 'unpaid'),
        isAdjustment: true,
      })

      // Sync to car loan
      if (e > 0) {
        await syncEMIToCarLoan({ id: newId, monthLabel: label, monthKey: monthKey, carLoanEMI: e })
      }
    } catch (err) { console.error(err) }
  }

  const getStatusBadge = (entry) => {
    const paid = entry.totalPaid || 0
    const net = (entry.grossAccrued || AGREED_SALARY) - (entry.carLoanEMI !== undefined ? entry.carLoanEMI : currentEMI)
    if (paid >= net && net > 0) return <Badge variant="success">Cleared</Badge>
    if (paid > 0) return <Badge variant="warning">Partial</Badge>
    return <Badge variant="danger">Outstanding</Badge>
  }

  if (ledgerLoading || loanLoading) return <div className="p-10 text-center text-text-muted">Loading ledger...</div>

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <SectionHeader 
        title="Rikesh's Salary Ledger" 
        subtitle="Tracking accruals at NPR 150,000/mo - Car EMI deductions" 
        action={
          <div className="flex gap-2">
            <Button 
                variant="outline" 
                size="sm" 
                onClick={handleSyncAll} 
                icon={RefreshCcw} 
                loading={isSyncing}
            >
              Sync with Car Loan
            </Button>
            <Button variant="secondary" size="sm" onClick={handleAddPrevMonth} icon={PlusCircle}>
              Add Month Entry
            </Button>
          </div>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card className="p-4 border-l-4 border-l-blue-500">
          <div className="text-[10px] text-text-muted font-body uppercase tracking-wider mb-1">Total Agreed</div>
          <div className="font-mono text-text-primary text-lg font-bold">{formatNPR(totalAccrued)}</div>
        </Card>
        <Card className="p-4 border-l-4 border-l-red-500">
          <div className="text-[10px] text-text-muted font-body uppercase tracking-wider mb-1">Total Loan/EMI</div>
          <div className="font-mono text-text-primary text-lg font-bold">-{formatNPR(totalEMIDeducted)}</div>
        </Card>
        <Card className="p-4 border-l-4 border-l-green-500">
          <div className="text-[10px] text-text-muted font-body uppercase tracking-wider mb-1">Total Taken</div>
          <div className="font-mono text-text-primary text-lg font-bold">{formatNPR(totalPaid)}</div>
        </Card>
        <Card className="p-4 bg-accent/5 border-l-4 border-l-accent shadow-lg shadow-accent/5">
          <div className="text-[10px] text-accent font-body uppercase tracking-wider mb-1 font-bold">Net Balance Owed</div>
          <div className="font-mono text-accent text-2xl font-black">{formatNPR(netBalance)}</div>
          <div className="text-[10px] text-accent/60 mt-1">Amount company owes you</div>
        </Card>
      </div>

      {/* Ledger Table */}
      <Card className="p-0 overflow-hidden">
        {sorted.length === 0 ? (
          <div className="p-10">
            <EmptyState 
              icon={BookOpen} 
              title="No salary records" 
              description="Click 'Add Previous Month' above to import your historical data or run payroll to start." 
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-body">
              <thead className="bg-bg-elevated/50">
                <tr>
                  <th className="py-4 px-5 text-left text-xs text-text-muted uppercase tracking-wider font-bold">
                    <button
                      onClick={() => setSortOrder(s => s === 'desc' ? 'asc' : 'desc')}
                      className="flex items-center gap-1.5 hover:text-text-primary transition-colors group"
                    >
                      Month
                      <ArrowUpDown size={12} className="opacity-50 group-hover:opacity-100" />
                      <span className="text-[9px] font-normal normal-case text-text-muted">
                        {sortOrder === 'desc' ? '(newest)' : '(oldest)'}
                      </span>
                    </button>
                  </th>
                  <th className="py-4 px-5 text-right text-xs text-text-muted uppercase tracking-wider font-bold">Basis</th>
                  <th className="py-4 px-5 text-right text-xs text-text-muted uppercase tracking-wider font-bold">Loan/EMI</th>
                  <th className="py-4 px-5 text-right text-xs text-text-muted uppercase tracking-wider font-bold">Net Salary</th>
                  <th className="py-4 px-5 text-right text-xs text-text-muted uppercase tracking-wider font-bold">Taken</th>
                  <th className="py-4 px-5 text-right text-xs text-text-muted uppercase tracking-wider font-bold bg-bg-surface/50 border-x border-border/10 ring-1 ring-accent/10">Remain</th>
                  <th className="py-4 px-5 text-right text-xs text-text-muted uppercase tracking-wider font-bold">Status</th>
                  <th className="py-4 px-5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {sorted.map(entry => {
                  const gross = entry.grossAccrued || AGREED_SALARY
                  const emi   = entry.carLoanEMI !== undefined ? entry.carLoanEMI : currentEMI
                  const net   = gross - emi
                  const paid  = entry.totalPaid    || 0
                  const rem   = net - paid

                  return (
                    <tr key={entry.id} className="hover:bg-bg-surface/50 transition-colors">
                      <td className="py-4 px-5 font-bold text-text-primary uppercase text-xs">{entry.monthLabel}</td>
                      <td className="py-4 px-5 font-mono text-text-secondary text-right">
                        <button onClick={() => handleEditField(entry.id, 'grossAccrued', gross)} className="hover:text-accent flex items-center gap-1 justify-end ml-auto group">
                          {formatNPR(gross)}
                          <Edit2 size={10} className="opacity-0 group-hover:opacity-100" />
                        </button>
                      </td>
                      <td className="py-4 px-5 font-mono text-red-400 text-right">
                        <button onClick={() => handleEditField(entry.id, 'carLoanEMI', emi)} className="hover:text-accent flex items-center gap-1 justify-end ml-auto group">
                          -{formatNPR(emi)}
                          <Edit2 size={10} className="opacity-0 group-hover:opacity-100" />
                        </button>
                      </td>
                      <td className="py-4 px-5 font-mono text-text-primary text-right font-medium">{formatNPR(net)}</td>
                      <td className="py-4 px-5 font-mono text-green-400 text-right">{formatNPR(paid)}</td>
                      <td className="py-4 px-5 font-mono text-accent text-right font-black bg-accent/5 border-x border-accent/10">
                        {formatNPR(rem)}
                      </td>
                      <td className="py-4 px-5 text-right">{getStatusBadge(entry)}</td>
                      <td className="py-4 px-5 text-right">
                        <button
                          onClick={() => { 
                            setShowPayment(entry); 
                            setPayForm({ amount: rem, date: todayString(), source: 'bank' }) 
                          }}
                          className={clsx(
                            "flex items-center gap-1.5 ml-auto text-xs font-bold px-3 py-1.5 rounded-lg border transition-all",
                            rem <= 0 
                              ? "bg-bg-elevated border-border text-text-muted cursor-not-allowed"
                              : "bg-accent/10 border-accent/20 text-accent hover:bg-accent hover:text-white"
                          )}
                          disabled={rem <= 0}
                        >
                          <CreditCard size={14} />
                          Log Taken
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Summary Footer */}
      <div className="flex justify-between items-center px-5">
        <div className="flex items-center gap-3 text-xs text-text-muted font-body">
          <MinusCircle size={14} />
          <span>Click on Basis or Loan amounts to manually override them for previous months.</span>
        </div>
        <div className="text-sm font-mono text-text-muted">
          Final Settlement: <span className="text-accent font-bold">{formatNPR(netBalance)}</span>
        </div>
      </div>

      <Modal
        isOpen={!!showPayment}
        onClose={() => setShowPayment(null)}
        title={`Log Amount Taken · ${showPayment?.monthLabel}`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowPayment(null)}>Cancel</Button>
            <Button onClick={handleLogPayment} loading={saving}>Confirm</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="p-4 bg-bg-elevated rounded-2xl border border-border">
            <div className="flex justify-between text-xs mb-1.5 uppercase tracking-wider text-text-muted">Net After Loan</div>
            <div className="font-mono text-text-primary text-xl font-bold">
              {formatNPR((showPayment?.grossAccrued || AGREED_SALARY) - (showPayment?.carLoanEMI !== undefined ? showPayment.carLoanEMI : currentEMI))}
            </div>
            
            <div className="flex justify-between text-xs mt-4 mb-1.5 uppercase tracking-wider text-text-muted">Currently Taken</div>
            <div className="font-mono text-green-400 text-lg font-bold">{formatNPR(showPayment?.totalPaid || 0)}</div>
            
            <div className="border-t border-border/50 my-3" />
            <div className="flex justify-between items-center">
              <span className="text-xs uppercase tracking-wider text-accent font-bold">Remaining Balance</span>
              <span className="font-mono text-accent text-xl font-black">
                {formatNPR(((showPayment?.grossAccrued || AGREED_SALARY) - (showPayment?.carLoanEMI !== undefined ? showPayment.carLoanEMI : currentEMI)) - (showPayment?.totalPaid || 0))}
              </span>
            </div>
          </div>
          
          <Input label="Amount Taking (NPR)" type="number" prefix="NPR" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} />
          <Input label="Date Taken" type="date" value={payForm.date} onChange={e => setPayForm(f => ({ ...f, date: e.target.value }))} />
          
          <div>
            <label className="text-[10px] text-text-muted font-body font-bold uppercase tracking-widest block mb-2 px-1">Source</label>
            <div className="flex gap-2">
              {['bank', 'cash'].map(s => (
                <button key={s} onClick={() => setPayForm(f => ({ ...f, source: s }))}
                  className={clsx('flex-1 py-3 rounded-xl text-sm font-bold border transition-all flex items-center justify-center gap-2',
                    payForm.source === s ? 'bg-accent text-white border-accent' : 'bg-bg-elevated border-border text-text-muted hover:border-text-muted'
                  )}>
                  {s === 'bank' ? <BookOpen size={16} /> : <Wallet size={16} />}
                  <span className="capitalize">{s}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
