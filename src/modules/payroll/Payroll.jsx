import { useState, useMemo, useEffect } from 'react'
import { Play, FileText, Download, CheckCircle, Plus, Pencil, Trash2 } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useEmployees, usePayrollRuns, useTDS } from '../../hooks/useFirestore'
import { addDocument, updateDocument } from '../../firebase/firestore'
import { formatNPR } from '../../utils/formatUtils'
import { BS_MONTHS, adToBS, todayString } from '../../utils/dateUtils'
import {
  calculateFullTimePayroll, calculateInternPayroll, calculateRikeshPayroll,
  getPayrollDeposits, getFiscalYearPreviousMonths,
} from '../../utils/payrollUtils'
import { generatePayslipPDF } from '../../utils/pdfUtils'
import {
  Card, SectionHeader, Button, Modal, Input, Select,
  Badge, EmptyState, Toggle,
} from '../../components/ui/index'
import clsx from 'clsx'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const calcEmployee = (emp, carLoanEMI, ytd = {}) => {
  if (emp.type === 'fulltime' && emp.id === 'rikesh') return calculateRikeshPayroll(emp, carLoanEMI, ytd)
  if (emp.type === 'fulltime') return calculateFullTimePayroll(emp, ytd)
  return calculateInternPayroll(emp)
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Payroll() {
  const { selectedMonth, settings } = useApp()
  const { data: employees, add: addEmployee, update: updateEmployee } = useEmployees()
  const { data: payrollRuns, add: addRun } = usePayrollRuns()

  const [showRunModal, setShowRunModal] = useState(false)
  const [showEmployeeModal, setShowEmployeeModal] = useState(false)
  const [editEmployee, setEditEmployee] = useState(null)
  const [saving, setSaving] = useState(false)
  const [runResult, setRunResult] = useState(null)

  const monthLabel = selectedMonth
    ? `${BS_MONTHS[selectedMonth.month - 1]} ${selectedMonth.year}`
    : 'Current Month'

  const monthKey = selectedMonth
    ? `${selectedMonth.year}-${String(selectedMonth.month).padStart(2, '0')}`
    : null

  const activeEmployees = useMemo(() => employees.filter(e => e.active !== false), [employees])

  const existingRun = useMemo(
    () => payrollRuns.find(r => r.monthKey === monthKey),
    [payrollRuns, monthKey]
  )

  // ── YTD Data Aggregation ────────────────────────────────────────────────────
  const ytdMap = useMemo(() => {
    const prevMonths = getFiscalYearPreviousMonths(monthKey)
    const map = {}

    payrollRuns
      .filter(run => prevMonths.includes(run.monthKey))
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey)) // Chronological
      .forEach(run => {
        run.results.forEach(res => {
          if (!map[res.employeeId]) {
            map[res.employeeId] = { ytdTaxableIncome: 0, ytdTaxPaid: 0 }
          }
          map[res.employeeId].ytdTaxableIncome += (res.currentTaxableIncome || 0)
          map[res.employeeId].ytdTaxPaid += (res.monthlyTDS || 0)
        })
      })
    return map
  }, [payrollRuns, monthKey])

  const preview = useMemo(
    () => activeEmployees.map(emp => {
      const ytd = ytdMap[emp.id] || { ytdTaxableIncome: 0, ytdTaxPaid: 0 }
      return {
        ...emp,
        ...calcEmployee(emp, settings?.carLoanEMI || 62372, ytd)
      }
    }),
    [activeEmployees, settings?.carLoanEMI, ytdMap]
  )

  const deposits = useMemo(() => getPayrollDeposits(preview), [preview])

  const [selectedEmpIds, setSelectedEmpIds] = useState([])

  const openRunModal = () => {
    setSelectedEmpIds(activeEmployees.map(e => e.id))
    setShowRunModal(true)
  }

  const toggleEmp = (id) => {
    setSelectedEmpIds(current => 
      current.includes(id) ? current.filter(i => i !== id) : [...current, id]
    )
  }

  const selectedPreview = useMemo(() => {
    return preview.filter(e => selectedEmpIds.includes(e.id))
  }, [preview, selectedEmpIds])

  const selectedDeposits = useMemo(() => getPayrollDeposits(selectedPreview), [selectedPreview])

  // ── Run payroll ─────────────────────────────────────────────────────────────
  const handleRunPayroll = async () => {
    if (!monthKey || selectedEmpIds.length === 0) return
    setSaving(true)
    try {
      const allResults = activeEmployees.map(emp => ({ ...emp, ...calcEmployee(emp, settings?.carLoanEMI || 62372) }))
      const results    = allResults.filter(r => selectedEmpIds.includes(r.id))
      
      const depositTotals = getPayrollDeposits(results)
      const staffResults  = results.filter(r => !r.isOwner && r.id !== 'rikesh')
      const staffNetPay   = staffResults.reduce((s, r) => s + (r.netPay || 0), 0)

      const run = {
        monthKey,
        monthLabel,
        bsYear:    selectedMonth.year,
        bsMonth:   selectedMonth.month,
        results,
        deposits:  depositTotals,
        tdsStatus: 'pending',
        ssfStatus: 'pending',
        runAt:     new Date().toISOString(),
      }
      await addRun(run)

      // ── Automated Expense Entry (CASH ONLY) ────────────────────────────────
      // We only log an expense for actual CASH leaving the bank (Staff salaries)
      // Rikesh's salary is handled as a liability in his Ledger
      if (staffNetPay > 0) {
        const today = todayString()
        const bs = adToBS(today)
        await addDocument('expenses', {
          date:          today,
          category:      'Salary',
          description:   `Staff Salaries (Direct payout) - ${monthLabel}`,
          amount:        staffNetPay,
          paymentSource: 'bank',
          type:          'expense',
          bsYear:        bs.year,
          bsMonth:       bs.month,
          bsDay:         bs.day,
          bsMonthName:   bs.monthName,
          linkedRun:     monthKey,
        })
      }

      // ── Rikesh's salary ledger is managed manually ─────────────────────────
      // No auto-creation — user adds entries in Rikesh's Ledger tab

      // ── Compliance Reminders ──────────────────────────────────────────────
      const dueD = new Date()
      dueD.setMonth(dueD.getMonth() + 1); dueD.setDate(25)
      const dueDate = dueD.toISOString().split('T')[0]

      if (depositTotals.totalTDS > 0) {
        await addDocument('reminders', { title: `TDS: ${monthLabel}`, amount: depositTotals.totalTDS, dueDate, status: 'active', type: 'tds' })
        
        // Auto-add TDS Liabilities per employee
        for (const empRes of results) {
          if ((empRes.monthlyTDS || 0) > 0) {
            await addDocument('tdsLedger', {
              employeeName: empRes.name,
              monthLabel: monthLabel,
              amount: empRes.monthlyTDS,
              status: 'unpaid',
              addedAt: new Date().toISOString()
            })
          }
        }
      }
      if (depositTotals.totalSSF > 0) {
        await addDocument('reminders', { title: `SSF: ${monthLabel}`, amount: depositTotals.totalSSF, dueDate, status: 'active', type: 'ssf' })
      }

      setRunResult(run)
      setShowRunModal(false)
    } finally {
      setSaving(false)
    }
  }

  // ── Compliance status updates ───────────────────────────────────────────────
  const handleUpdateStatus = async (field, ref = '') => {
    if (!existingRun) return
    await updateDocument('payrollRuns', existingRun.id, {
      [field]: 'deposited',
      [`${field}Date`]: new Date().toISOString().split('T')[0],
      [`${field}Ref`]: ref,
    })
  }

  // ── Payslip generation ──────────────────────────────────────────────────────
  const handleGeneratePayslip = (emp) => {
    const company = settings?.company || {}
    generatePayslipPDF(emp, emp, monthLabel, company, settings?.logoBase64)
  }

  const handleGenerateAll = () => {
    ; (existingRun?.results || preview).forEach(r => handleGeneratePayslip(r))
  }

  return (
    <div className="space-y-5 md:space-y-6 animate-fade-in">
      <SectionHeader
        title="Payroll"
        subtitle={monthLabel}
        action={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" icon={Plus}
              onClick={() => { setEditEmployee(null); setShowEmployeeModal(true) }}>
              Add Employee
            </Button>
            {existingRun ? (
              <Button variant="ghost" size="sm" icon={Download} onClick={handleGenerateAll}>All Payslips</Button>
            ) : (
              <Button size="sm" icon={Play} onClick={openRunModal}>Run Payroll</Button>
            )}
          </div>
        }
      />

      {/* ── Payroll table ────────────────────────────────────────────────────── */}
      <Card className="p-4 md:p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display font-bold text-text-primary text-base">{monthLabel} Payroll</h2>
            {existingRun && (
              <p className="text-xs text-green-400 font-body mt-0.5 flex items-center gap-1">
                <CheckCircle size={10} /> Run {existingRun.runAt?.split('T')[0]}
              </p>
            )}
          </div>
          <div className="flex gap-4 text-right">
            <div>
              <div className="text-xs text-text-muted font-body">Net Payout</div>
              <div className="font-mono text-text-primary text-base md:text-lg font-bold">
                {formatNPR(preview.reduce((s, e) => s + (e.netPay || 0), 0))}
              </div>
            </div>
            <div>
              <div className="text-xs text-text-muted font-body">Total CTC</div>
              <div className="font-mono text-accent text-base md:text-lg font-bold">
                {formatNPR(preview.reduce((s, e) => s + (e.totalCTC || 0), 0))}
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable table — min-width prevents crush on mobile */}
        <div className="overflow-x-auto -mx-4 px-4 md:-mx-5 md:px-5">
          <table className="w-full text-sm font-body" style={{ minWidth: 950 }}>
            <thead>
              <tr className="border-b border-border">
                {['Employee', 'Gross', 'SSF (11%)', 'TDS', 'Net Pay', 'Employer SSF', 'Total CTC', '']
                  .filter(h => {
                    if (h === 'SSF (11%)' || h === 'Employer SSF') return deposits.totalSSF > 0
                    return true
                  })
                  .map((h, i) => (
                    <th key={i} className={clsx('pb-3 text-xs text-text-muted uppercase tracking-wider font-medium', (h === 'Employee') ? 'text-left' : 'text-right')}>
                      {h}
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-bg-elevated">
              {preview.map(emp => (
                <tr key={emp.id} className="hover:bg-bg-surface transition-colors">
                  <td className="py-3">
                    <div className="font-medium text-text-primary">{emp.name}</div>
                    <div className="text-xs text-text-muted capitalize">{emp.type}{emp.isOwner ? ' · CEO' : ''}</div>
                  </td>
                  <td className="py-3 font-mono text-text-primary text-right">{formatNPR(emp.grossPay)}</td>
                  {deposits.totalSSF > 0 && (
                    <td className="py-3 font-mono text-yellow-400 text-right">
                      {emp.employeeSSF ? `-${formatNPR(emp.employeeSSF)}` : '—'}
                    </td>
                  )}
                  <td className="py-3 font-mono text-orange-400 text-right">
                    {emp.monthlyTDS ? `-${formatNPR(emp.monthlyTDS)}` : '—'}
                  </td>
                  <td className="py-3 font-mono text-green-400 text-right font-bold">{formatNPR(emp.netPay)}</td>
                  {deposits.totalSSF > 0 && (
                    <td className="py-3 font-mono text-blue-400 text-right">{emp.employerSSF ? formatNPR(emp.employerSSF) : '—'}</td>
                  )}
                  <td className="py-3 font-mono text-accent text-right font-bold">{formatNPR(emp.totalCTC)}</td>
                  <td className="py-3 text-right">
                    <button
                      onClick={() => handleGeneratePayslip(emp)}
                      className="text-xs text-text-muted hover:text-text-primary border border-border hover:border-border-light px-2 py-1 rounded-lg transition-all"
                    >
                      <FileText size={11} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Compliance status ─────────────────────────────────────────────────── */}
      {existingRun && (
        <div className={clsx('grid gap-3 md:gap-4', (deposits.totalSSF > 0) ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1')}>
          <ComplianceCard
            title="TDS Deposit"
            subtitle={`Due 25th of following month · ${formatNPR(existingRun.deposits?.totalTDS)}`}
            status={existingRun.tdsStatus}
            onMarkDeposited={ref => handleUpdateStatus('tdsStatus', ref)}
          />
          {deposits.totalSSF > 0 && (
            <ComplianceCard
              title="SSF Deposit"
              subtitle={`Due 25th of following month · ${formatNPR(existingRun.deposits?.totalSSF)}`}
              status={existingRun.ssfStatus}
              onMarkDeposited={ref => handleUpdateStatus('ssfStatus', ref)}
            />
          )}
        </div>
      )}

      {/* ── Deposit summary ───────────────────────────────────────────────────── */}
      <div className={clsx('grid gap-2 md:gap-3', deposits.totalSSF > 0 ? 'grid-cols-3' : 'grid-cols-2')}>
        {deposits.totalSSF > 0 && (
          <Card className="p-3 md:p-4">
            <div className="text-xs text-text-muted font-body uppercase tracking-wider mb-1">Total SSF</div>
            <div className="font-mono text-blue-400 text-base md:text-lg font-bold">{formatNPR(deposits.totalSSF)}</div>
            <div className="text-xs text-text-muted mt-1 hidden md:block">Emp: {formatNPR(deposits.totalEmployeeSSF)} + Co: {formatNPR(deposits.totalEmployerSSF)}</div>
          </Card>
        )}
        <Card className="p-3 md:p-4">
          <div className="text-xs text-text-muted font-body uppercase tracking-wider mb-1">Total TDS</div>
          <div className="font-mono text-orange-400 text-base md:text-lg font-bold">{formatNPR(deposits.totalTDS)}</div>
          <div className="text-xs text-text-muted mt-1 hidden md:block">Due 25th next month</div>
        </Card>
        <Card className="p-3 md:p-4">
          <div className="text-xs text-text-muted font-body uppercase tracking-wider mb-1">Employees</div>
          <div className="font-mono text-text-primary text-base md:text-lg font-bold">{activeEmployees.length}</div>
          <div className="text-xs text-text-muted mt-1 hidden md:block">{activeEmployees.filter(e => e.type === 'fulltime').length} full-time</div>
        </Card>
      </div>

      {/* ── Employee list ─────────────────────────────────────────────────────── */}
      <Card className="p-4 md:p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-text-primary text-base">Employees</h2>
          <Button variant="ghost" size="xs" icon={Plus} onClick={() => { setEditEmployee(null); setShowEmployeeModal(true) }}>
            Add Employee
          </Button>
        </div>
        {employees.length === 0 ? (
          <EmptyState
            icon={undefined}
            title="No employees yet"
            description="Add employees to run payroll."
            action={<Button size="sm" icon={Plus} onClick={() => { setEditEmployee(null); setShowEmployeeModal(true) }}>Add Employee</Button>}
          />
        ) : (
          <div className="space-y-2">
            {employees.map(emp => (
              <div key={emp.id} className="flex items-center justify-between p-3 bg-bg-elevated rounded-xl hover:bg-bg-hover transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-border flex items-center justify-center text-sm font-display font-bold text-text-primary shrink-0">
                    {emp.name?.[0] || '?'}
                  </div>
                  <div className="min-w-0">
                    <div className="font-body font-medium text-text-primary text-sm flex items-center gap-2 flex-wrap">
                      {emp.name}
                      {emp.isOwner && <span className="text-[10px] text-accent border border-accent/20 px-1.5 py-0.5 rounded-md">CEO</span>}
                      {!emp.active && <span className="text-[10px] text-text-muted border border-border px-1.5 py-0.5 rounded-md">Inactive</span>}
                    </div>
                    <div className="text-xs text-text-muted truncate">
                      {emp.type === 'fulltime'
                        ? `Full-time · CTC ${formatNPR(emp.ctc)}`
                        : `${emp.type} · ${formatNPR(emp.flatPay)}/mo`}
                      {emp.gender === 'female' ? ' · 10% TDS rebate' : ''}
                      {emp.isMarried ? ' · Married threshold' : ''}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => { setEditEmployee(emp); setShowEmployeeModal(true) }}
                  className="w-7 h-7 rounded-lg hover:bg-border flex items-center justify-center text-text-muted hover:text-text-primary transition-colors shrink-0"
                >
                  <Pencil size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        isOpen={showRunModal}
        onClose={() => setShowRunModal(false)}
        title={`Run Payroll · ${monthLabel}`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowRunModal(false)}>Cancel</Button>
            <Button onClick={handleRunPayroll} loading={saving} icon={Play} disabled={selectedEmpIds.length === 0}>
              Confirm & Run ({selectedEmpIds.length})
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-text-muted mb-2 px-1">Select employees to include in this month's run:</p>
          
          <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
            {activeEmployees.map(emp => {
              const res = preview.find(p => p.id === emp.id)
              const selected = selectedEmpIds.includes(emp.id)
              return (
                <button
                  key={emp.id}
                  onClick={() => toggleEmp(emp.id)}
                  className={clsx(
                    "w-full flex items-center justify-between p-3 rounded-xl border transition-all",
                    selected ? "bg-accent/10 border-accent/30" : "bg-bg-elevated border-border opacity-60"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={clsx("w-4 h-4 rounded border flex items-center justify-center", selected ? "bg-accent border-accent text-white" : "border-text-muted")}>
                      {selected && <CheckCircle size={10} />}
                    </div>
                    <div className="text-left">
                      <div className="text-xs font-bold text-text-primary">{emp.name}</div>
                      <div className="text-[10px] text-text-muted">{emp.isOwner ? 'Liability Accrual' : 'Direct Cash Payout'}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-mono font-bold text-text-primary">{formatNPR(res?.netPay || 0)}</div>
                    <div className="text-[10px] text-text-muted uppercase tracking-wider">Net</div>
                  </div>
                </button>
              )
            })}
          </div>

          <div className="p-4 bg-bg-surface border border-border rounded-xl space-y-2">
            {[
              ['Cash Payout (Staff)', formatNPR(selectedPreview.filter(p => !p.isOwner).reduce((s, p) => s + (p.netPay || 0), 0)), 'text-orange-400'],
              ['Owner Accrual (Ledger)', formatNPR(selectedPreview.filter(p => p.isOwner).reduce((s, p) => s + (p.netPay || 0), 0)), 'text-blue-400'],
              ['Total Net', formatNPR(selectedPreview.reduce((s, e) => s + (e.netPay || 0), 0)), 'text-green-400 font-bold'],
            ].map(([label, val, color]) => (
              <div key={label} className="flex justify-between text-xs">
                <span className="text-text-muted">{label}</span>
                <span className={clsx('font-mono', color)}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {/* ── TDS Liability Ledger ──────────────────────────────────────────────── */}
      <TDSLedger />

      {/* ── Employee add/edit modal ───────────────────────────────────────────── */}
      <EmployeeModal
        isOpen={showEmployeeModal}
        onClose={() => { setShowEmployeeModal(false); setEditEmployee(null) }}
        employee={editEmployee}
        onSave={async (data) => {
          try {
            // Strict whitelisting: only send fields we explicitly want
            const cleanData = {
              name: data.name || 'Unnamed',
              type: data.type || 'fulltime',
              gender: data.gender || 'male',
              isMarried: Boolean(data.isMarried),
              active: Boolean(data.active),
              isOwner: Boolean(data.isOwner),
              ctc: parseFloat(data.ctc) || 0,
              flatPay: parseFloat(data.flatPay) || 0,
              allowances: (data.allowances || []).map(a => ({
                name: a.name || 'Unnamed',
                amount: parseFloat(a.amount) || 0,
              })),
              citMonthly: parseFloat(data.citMonthly) || 0,
              lifeInsAnnual: parseFloat(data.lifeInsAnnual) || 0,
              healthInsAnnual: parseFloat(data.healthInsAnnual) || 0,
              isSSFEnrolled: Boolean(data.isSSFEnrolled),
              remoteCategory: data.remoteCategory || 'none',
            }

            if (editEmployee?.id) {
              await updateEmployee(editEmployee.id, cleanData)
            } else {
              await addEmployee(cleanData)
            }

            setShowEmployeeModal(false)
            setEditEmployee(null)
          } catch (err) {
            console.error('Failed to save employee:', err)
            // Diagnostic Alert: Show the actual error message
            alert(`Error: ${err.message}`)
          }
        }}
      />
    </div>
  )
}

// ─── Compliance card ──────────────────────────────────────────────────────────
function ComplianceCard({ title, subtitle, status, onMarkDeposited }) {
  const [showRef, setShowRef] = useState(false)
  const [ref, setRef] = useState('')
  const deposited = status === 'deposited'

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-display font-bold text-text-primary text-sm">{title}</h3>
        <Badge variant={deposited ? 'success' : 'warning'}>{deposited ? '✓ Deposited' : 'Pending'}</Badge>
      </div>
      <p className="text-xs text-text-muted font-body mb-3">{subtitle}</p>
      {!deposited && (
        showRef ? (
          <div className="flex gap-2">
            <input
              value={ref}
              onChange={e => setRef(e.target.value)}
              placeholder="Reference number..."
              className="flex-1 bg-bg-elevated border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary font-body outline-none focus:border-accent"
            />
            <button
              onClick={() => onMarkDeposited(ref)}
              className="text-xs bg-green-500 hover:bg-green-600 text-text-primary px-3 py-1.5 rounded-lg font-body transition-colors"
            >
              Confirm
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowRef(true)}
            className="text-xs text-text-muted hover:text-text-primary border border-border hover:border-border-light px-3 py-1.5 rounded-lg font-body transition-all"
          >
            Mark as Deposited
          </button>
        )
      )}
    </Card>
  )
}

// ─── Employee modal ───────────────────────────────────────────────────────────
function EmployeeModal({ isOpen, onClose, employee, onSave }) {
  const [form, setForm] = useState({
    name: '', type: 'fulltime', ctc: '', flatPay: '',
    gender: 'male', isMarried: false, active: true, isOwner: false, isSSFEnrolled: true,
    allowances: [],
    citMonthly: '', lifeInsAnnual: '', healthInsAnnual: '',
    remoteCategory: 'none',
  })
  const [saving, setSaving] = useState(false)

  // Sync prop to state when modal opens or employee changes
  useEffect(() => {
    if (isOpen) {
      setForm(employee || {
        name: '', type: 'fulltime', ctc: '', flatPay: '',
        gender: 'male', isMarried: false, active: true, isOwner: false, isSSFEnrolled: true,
        allowances: [],
        citMonthly: '', lifeInsAnnual: '', healthInsAnnual: '',
        remoteCategory: 'none',
      })
    }
  }, [employee, isOpen])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave({ ...form, ctc: parseFloat(form.ctc) || 0, flatPay: parseFloat(form.flatPay) || 0, allowances: form.allowances || [] })
    } finally {
      setSaving(false)
    }
  }

  // Live preview for full-time
  let calcPreview = null
  if (form.type === 'fulltime' && parseFloat(form.ctc) > 0) {
    try {
      calcPreview = calculateFullTimePayroll({
        ctc: parseFloat(form.ctc),
        gender: form.gender,
        isMarried: form.isMarried,
        allowances: form.allowances || [],
        citMonthly: form.citMonthly,
        lifeInsAnnual: form.lifeInsAnnual,
        healthInsAnnual: form.healthInsAnnual,
        isSSFEnrolled: form.isSSFEnrolled,
        remoteCategory: form.remoteCategory
      })
    }
    catch { /* ignore */ }
  }

  const addAllowance = () => {
    set('allowances', [...(form.allowances || []), { name: '', amount: 0 }])
  }
  const updateAllowance = (i, k, v) => {
    const list = [...(form.allowances || [])]
    list[i] = { ...list[i], [k]: v }
    set('allowances', list)
  }
  const removeAllowance = (i) => {
    set('allowances', (form.allowances || []).filter((_, idx) => idx !== i))
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={employee ? `Edit ${employee.name}` : 'Add Employee'}
      size="sm"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={handleSave} loading={saving}>Save</Button></>}
    >
      <div className="space-y-4">
        <Input label="Name" value={form.name} onChange={e => set('name', e.target.value)} />

        <Select label="Employee Type" value={form.type} onChange={e => set('type', e.target.value)}>
          <option value="fulltime">Full-time</option>
          <option value="trainee">Trainee</option>
          <option value="intern">Intern</option>
        </Select>

        {form.type === 'fulltime' ? (
          <>
            <Input label="Target CTC (Monthly Expense)" type="number" prefix="NPR" value={form.ctc} onChange={e => set('ctc', e.target.value)} />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs text-text-secondary font-body font-medium uppercase tracking-wider">Other Allowances</label>
                <button onClick={addAllowance} className="text-[10px] text-accent hover:underline">+ Add Allowance</button>
              </div>
              {(form.allowances || []).map((a, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={a.name}
                    onChange={e => updateAllowance(i, 'name', e.target.value)}
                    placeholder="e.g. Fuel"
                    className="flex-1 bg-bg-elevated border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary font-body outline-none focus:border-accent"
                  />
                  <input
                    type="number"
                    value={a.amount}
                    onChange={e => updateAllowance(i, 'amount', parseFloat(e.target.value) || 0)}
                    placeholder="Amount"
                    className="w-24 bg-bg-elevated border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary font-body outline-none focus:border-accent"
                  />
                  <button onClick={() => removeAllowance(i)} className="text-text-muted hover:text-red-400">×</button>
                </div>
              ))}
            </div>
          </>
        ) : (
          <Input label="Flat Pay (Monthly NPR)" type="number" prefix="NPR" value={form.flatPay} onChange={e => set('flatPay', e.target.value)} />
        )}

        <div className="grid grid-cols-2 gap-3">
          <Select label="Gender" value={form.gender} onChange={e => set('gender', e.target.value)}>
            <option value="male">Male</option>
            <option value="female">Female (10% TDS rebate)</option>
          </Select>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-text-secondary font-body font-medium uppercase tracking-wider">Marital Status</label>
            <div className="flex gap-2 mt-1">
              {[['false', 'Single'], ['true', 'Married']].map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => set('isMarried', val === 'true')}
                  className={clsx(
                    'flex-1 py-1.5 rounded-lg text-xs font-body border transition-all',
                    String(form.isMarried) === val
                      ? 'bg-accent/10 border-accent text-accent'
                      : 'bg-bg-elevated border-border text-text-muted'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 p-3 bg-bg-surface border border-border rounded-xl">
          <div className="flex items-center justify-between">
            <Toggle checked={form.active} onChange={v => set('active', v)} label="Active employee" />
            <Toggle checked={form.isOwner} onChange={v => set('isOwner', v)} label="Owner / CEO" />
          </div>
          <div className="pt-2 border-t border-border">
            <Toggle checked={form.isSSFEnrolled} onChange={v => set('isSSFEnrolled', v)} label="Contribute to SSF" />
            <p className="text-[10px] text-text-muted mt-1 px-8">Enables 11% employee + 20% employer contribution. If disabled, 1% local tax applies.</p>
          </div>
        </div>

        {form.type === 'fulltime' && (
          <div className="p-4 bg-bg-surface border border-border rounded-xl space-y-4">
            <h4 className="text-[10px] text-text-muted uppercase tracking-widest font-bold">Tax Savings & Deductions (Voluntary)</h4>
            <div className="grid grid-cols-1 gap-3">
              <Input
                label="Monthly CIT Contribution"
                type="number"
                placeholder="0"
                value={form.citMonthly}
                onChange={e => set('citMonthly', e.target.value)}
                hint="Deducted monthly from salary for Citizen Investment Trust."
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Annual Life Insurance"
                  type="number"
                  placeholder="0"
                  value={form.lifeInsAnnual}
                  onChange={e => set('lifeInsAnnual', e.target.value)}
                  hint="Capped at 40k NPR/year"
                />
                <Input
                  label="Annual Health Insurance"
                  type="number"
                  placeholder="0"
                  value={form.healthInsAnnual}
                  onChange={e => set('healthInsAnnual', e.target.value)}
                  hint="Capped at 20k NPR/year"
                />
              </div>
              <Select
                label="Remote Area Category"
                value={form.remoteCategory}
                onChange={e => set('remoteCategory', e.target.value)}
                hint="Deduction: A=50k, B=40k, C=30k, D=20k, E=10k"
              >
                <option value="none">None / Grade E</option>
                <option value="A">Category A (Prohibited)</option>
                <option value="B">Category B (Remote)</option>
                <option value="C">Category C (Semi-Remote)</option>
                <option value="D">Category D (Developed)</option>
              </Select>
            </div>
          </div>
        )}

        {calcPreview && (
          <div className="bg-bg-elevated rounded-xl border border-border/50 overflow-hidden">
            <div className="bg-bg-surface p-3 border-b border-border/50 flex justify-between items-center">
              <span className="text-[10px] text-text-muted uppercase tracking-widest font-bold">Payroll Journey (Layman Breakdown)</span>
              <Badge variant="secondary" className="text-[9px]">FY 2080/81 Rules</Badge>
            </div>

            <div className="p-3 space-y-3 font-body">
              {/* Stage 1: Gross & Cost */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-text-secondary">Gross Salary (Monthly)</span>
                  <span className="text-text-primary font-mono">{formatNPR(calcPreview.grossPayMonthly)}</span>
                </div>
                {calcPreview.isSSFEnrolled && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-text-secondary flex items-center gap-1">Employer SSF (20%) <Badge variant="secondary" className="scale-75 origin-left">Company Paid</Badge></span>
                    <span className="text-blue-400 font-mono">{formatNPR(calcPreview.employerSSFMonthly)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-xs font-bold pt-1 border-t border-border/30">
                  <span className="text-accent">{calcPreview.isSSFEnrolled ? 'Total Monthly Expense (CTC)' : 'Total Monthly Expense'}</span>
                  <span className="text-accent font-mono">{formatNPR(calcPreview.totalCTC)}</span>
                </div>
              </div>

              {/* Stage 2: Cumulative Context */}
              <div className="space-y-1.5 p-2 bg-bg-surface rounded-lg border border-border/30">
                <div className="text-[9px] text-text-muted uppercase tracking-tight font-bold mb-1">Fiscal Year YTD Context</div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-text-muted">Total Taxable Income (Shrawan YTD)</span>
                  <span className="text-text-secondary font-mono">{formatNPR(calcPreview.totalTaxableIncomeYTD)}</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-text-muted text-[10px] pl-2">— Earned in Previous Months</span>
                  <span className="text-text-muted font-mono">{formatNPR(calcPreview.totalTaxableIncomeYTD - calcPreview.currentTaxableIncome)}</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-text-muted text-[10px] pl-2">— Taxable This Month</span>
                  <span className="text-text-secondary font-mono">{formatNPR(calcPreview.currentTaxableIncome)}</span>
                </div>

                <div className="flex justify-between items-center text-[11px] pt-1 mt-1 border-t border-border/20">
                  <span className="text-text-secondary font-semibold">Total Tax Liability So Far</span>
                  <span className="text-text-primary font-mono">{formatNPR(calcPreview.targetNetTax)}</span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-text-muted pl-2">— Already Paid (TDS YTD)</span>
                  <span className="text-text-muted font-mono">-{formatNPR(calcPreview.ytdTaxPaid)}</span>
                </div>
              </div>

              {/* Stage 3: The Paycheck */}
              <div className="space-y-1.5 pt-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-text-secondary">Gross Monthly Earnings</span>
                  <span className="text-text-primary font-mono">{formatNPR(calcPreview.grossPayMonthly)}</span>
                </div>
                {calcPreview.isSSFEnrolled && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-text-secondary">Employee SSF (11%)</span>
                    <span className="text-yellow-400 font-mono">-{formatNPR(calcPreview.employeeSSFMonthly)}</span>
                  </div>
                )}
                {calcPreview.citMonthly > 0 && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-text-secondary">CIT Contribution</span>
                    <span className="text-text-muted font-mono">-{formatNPR(calcPreview.citMonthly)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-xs border-t border-border/10 pt-1 mt-1">
                  <span className="text-text-primary font-semibold flex items-center gap-1 group">
                    Monthly TDS <span className="text-[9px] font-normal text-text-muted">(Step-up Method)</span>
                    <Badge variant="secondary" className="scale-75 origin-left">{calcPreview.isSSFEnrolled ? 'SSF Enrolled' : 'No SSF (1%)'}</Badge>
                    {calcPreview.medicalTaxCredit > 0 && <Badge variant="secondary" className="scale-75 origin-left text-blue-400">Med Credit</Badge>}
                  </span>
                  <span className="text-orange-400 font-mono font-bold">-{formatNPR(calcPreview.monthlyTDS)}</span>
                </div>

                <div className="group relative pt-1">
                  <div className="flex justify-between items-center font-bold text-green-400 text-sm py-2 px-3 bg-green-400/5 rounded-lg border border-green-400/20">
                    <span>Monthly Take-Home</span>
                    <span className="font-mono text-base">{formatNPR(calcPreview.netPayMonthly)}</span>
                  </div>
                  <p className="text-[10px] text-text-muted mt-2 px-1 italic">
                    * This is the amount actually credited to the bank account.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

// ─── TDS Liability Ledger Component ───────────────────────────────────────────
function TDSLedger() {
  const { data: tdsEntries, loading, add: addTds, update: updateTds, remove: removeTds } = useTDS()
  const [showAddForm, setShowAddForm] = useState(false)
  const [loadingAdd, setLoadingAdd] = useState(false)
  const [form, setForm] = useState({ employeeName: '', monthLabel: '', amount: '' })

  // One-time Initial Seeding
  useEffect(() => {
    if (!loading && tdsEntries.length === 0 && !localStorage.getItem('tds_seeded_v3')) {
      localStorage.setItem('tds_seeded_v3', '1')
      const initialData = [
        { employeeName: 'Rikesh', monthLabel: 'Magh', amount: 410, status: 'unpaid' },
        { employeeName: 'Rikesh', monthLabel: 'Falgun', amount: 410, status: 'unpaid' },
        { employeeName: 'Pranesh', monthLabel: 'Falgun', amount: 700, status: 'unpaid' },
        { employeeName: 'Samana', monthLabel: 'Magh', amount: 300, status: 'unpaid' },
        { employeeName: 'Samana', monthLabel: 'Falgun', amount: 220, status: 'unpaid' },
        { employeeName: 'Sapana', monthLabel: 'Falgun', amount: 50, status: 'unpaid' },
      ]
      initialData.forEach(d => addTds({ ...d, addedAt: new Date().toISOString() }))
    }
  }, [loading, tdsEntries.length, addTds])

  const unpaidTotal = tdsEntries.filter(t => t.status === 'unpaid').reduce((s, t) => s + (t.amount || 0), 0)

  // Group by Employee -> { unpaid: [], paid: [] }
  const groupedEntries = useMemo(() => {
    const map = {}
    tdsEntries.forEach(e => {
      if (!map[e.employeeName]) map[e.employeeName] = { unpaid: [], paid: [] }
      if (e.status === 'unpaid') map[e.employeeName].unpaid.push(e)
      else map[e.employeeName].paid.push(e)
    })
    return Object.fromEntries(Object.entries(map).sort(([a], [b]) => a.localeCompare(b)))
  }, [tdsEntries])

  const handleMarkPaid = async (id) => {
    if (window.confirm('Mark this TDS amount as paid/deposited?')) {
      await updateTds(id, { status: 'paid', paidAt: new Date().toISOString() })
    }
  }

  const handleDelete = async (id) => {
    if (window.confirm('Delete this TDS record?')) {
      await removeTds(id)
    }
  }

  const handleMarkAllPaid = async (empName) => {
    if (window.confirm(`Mark all unpaid TDS for ${empName} as paid?`)) {
      setLoadingAdd(true)
      try {
        const toPay = groupedEntries[empName].unpaid
        await Promise.all(toPay.map(entry => updateTds(entry.id, { status: 'paid', paidAt: new Date().toISOString() })))
      } finally {
        setLoadingAdd(false)
      }
    }
  }

  const handleManualAdd = async () => {
    if (!form.employeeName || !form.monthLabel || !form.amount) return
    setLoadingAdd(true)
    try {
      await addTds({
        employeeName: form.employeeName,
        monthLabel: form.monthLabel,
        amount: parseFloat(form.amount) || 0,
        status: 'unpaid',
        addedAt: new Date().toISOString()
      })
      setShowAddForm(false)
      setForm({ employeeName: '', monthLabel: '', amount: '' })
    } finally {
      setLoadingAdd(false)
    }
  }

  if (loading) return null

  return (
    <Card className="p-4 md:p-5 mt-6 border-l-4 border-l-orange-500">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-display font-bold text-text-primary text-base">TDS Liability Ledger</h2>
          <p className="text-xs text-text-muted mt-0.5">Track unpaid Tax Deducted at Source across all months</p>
        </div>
        <div className="flex gap-4 items-center">
          <div className="text-right">
            <div className="text-[10px] uppercase font-bold text-text-muted tracking-wider">Total Due</div>
            <div className="font-mono text-orange-400 font-bold text-lg">{formatNPR(unpaidTotal)}</div>
          </div>
          <Button variant="secondary" size="xs" icon={Plus} onClick={() => setShowAddForm(true)}>Add TDS</Button>
        </div>
      </div>

      <div className="overflow-x-auto -mx-4 px-4 md:-mx-5 md:px-5">
        <table className="w-full text-sm font-body" style={{ minWidth: 700 }}>
          <thead>
            <tr className="border-b border-border">
              <th className="pb-3 text-xs text-text-muted uppercase tracking-wider font-medium text-left">Employee</th>
              <th className="pb-3 text-xs text-text-muted uppercase tracking-wider font-medium text-left">Pending Months Breakdown</th>
              <th className="pb-3 text-xs text-text-muted uppercase tracking-wider font-medium text-right">Total Unpaid</th>
              <th className="pb-3 text-xs text-text-muted uppercase tracking-wider font-medium text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-bg-elevated">
            {Object.entries(groupedEntries).map(([empName, data]) => {
              const empUnpaidTotal = data.unpaid.reduce((s, t) => s + (t.amount || 0), 0)
              
              return (
                <tr key={empName} className="hover:bg-bg-surface transition-colors">
                  <td className="py-4 align-top">
                    <div className="font-bold text-text-primary text-base">{empName}</div>
                    {data.paid.length > 0 && (
                      <div className="text-[10px] text-text-muted mt-1">{data.paid.length} historic paid entries</div>
                    )}
                  </td>
                  <td className="py-4 align-top max-w-lg">
                    {data.unpaid.length === 0 ? (
                      <span className="text-xs text-text-muted italic flex items-center gap-1">
                        <CheckCircle size={12} className="text-green-500" /> Fully cleared
                      </span>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {data.unpaid.sort((a,b) => a.addedAt?.localeCompare(b.addedAt) || 0).map(entry => (
                          <div key={entry.id} className="flex items-stretch bg-orange-500/10 border border-orange-500/20 rounded-md overflow-hidden group">
                            <div className="px-2 py-1 text-xs text-orange-400 font-medium border-r border-orange-500/20 flex flex-col justify-center">
                              <span className="font-bold">{entry.monthLabel}</span>
                              <span className="font-mono text-[10px]">{formatNPR(entry.amount)}</span>
                            </div>
                            <div className="flex flex-col bg-bg-elevated/50 opacity-0 group-hover:opacity-100 transition-opacity w-0 group-hover:w-6">
                              <button onClick={() => handleMarkPaid(entry.id)} title="Mark Paid" className="flex-1 flex items-center justify-center text-green-400 hover:bg-green-500 hover:text-white transition-colors">
                                <CheckCircle size={10} />
                              </button>
                              <button onClick={() => handleDelete(entry.id)} title="Delete Entry" className="flex-1 flex items-center justify-center text-text-muted hover:bg-red-500 hover:text-white transition-colors border-t border-border">
                                <Trash2 size={10} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="py-4 align-top text-right">
                    <div className={clsx("font-mono font-bold text-lg", empUnpaidTotal > 0 ? "text-orange-400" : "text-text-muted")}>
                      {formatNPR(empUnpaidTotal)}
                    </div>
                  </td>
                  <td className="py-4 align-top text-right">
                    {data.unpaid.length > 0 && (
                      <button onClick={() => handleMarkAllPaid(empName)} className="text-[10px] bg-green-500/10 text-green-400 hover:bg-green-500 hover:text-white px-3 py-1.5 rounded-lg font-bold transition-colors uppercase tracking-wider">
                        Clear All
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {Object.keys(groupedEntries).length === 0 && (
          <div className="text-center p-6 text-xs text-text-muted italic">No TDS liabilities tracked yet.</div>
        )}
      </div>

      {showAddForm && (
        <Modal isOpen={showAddForm} onClose={() => setShowAddForm(false)} title="Add Manual TDS Entry" size="sm" footer={<><Button variant="ghost" onClick={() => setShowAddForm(false)}>Cancel</Button><Button onClick={handleManualAdd} loading={loadingAdd}>Save</Button></>}>
          <div className="space-y-3">
            <Input label="Employee Name" placeholder="e.g. Rikesh" value={form.employeeName} onChange={e => setForm(f => ({...f, employeeName: e.target.value}))} />
            <Input label="Month Label" placeholder="e.g. Magh" value={form.monthLabel} onChange={e => setForm(f => ({...f, monthLabel: e.target.value}))} />
            <Input label="TDS Amount" type="number" prefix="NPR" value={form.amount} onChange={e => setForm(f => ({...f, amount: e.target.value}))} />
          </div>
        </Modal>
      )}
    </Card>
  )
}
