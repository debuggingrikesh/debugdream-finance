import { useState, useMemo } from 'react'
import { Play, FileText, Download, Users, CheckCircle, XCircle, Plus, Pencil } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useEmployees, usePayrollRuns } from '../../hooks/useFirestore'
import { addDocument, updateDocument } from '../../firebase/firestore'
import { formatNPR } from '../../utils/formatUtils'
import { BS_MONTHS, getTodayBoth, adToBS } from '../../utils/dateUtils'
import { calculateFullTimePayroll, calculateInternPayroll, calculateRikeshPayroll, getPayrollDeposits, DEFAULT_EMPLOYEES } from '../../utils/payrollUtils'
import { generatePayslipPDF } from '../../utils/pdfUtils'
import {
  Card, SectionHeader, Button, Modal, Input, Select, Badge,
  Table, ConfirmDialog, EmptyState, ProgressBar, Divider, Toggle
} from '../../components/ui/index'
import clsx from 'clsx'

export default function Payroll() {
  const { selectedMonth, settings } = useApp()
  const { data: employees, loading: empLoading, add: addEmployee, update: updateEmployee } = useEmployees()
  const { data: payrollRuns, loading: runsLoading, add: addRun } = usePayrollRuns()

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

  // Active employees
  const activeEmployees = useMemo(() => employees.filter(e => e.active !== false), [employees])

  // Check if payroll already run for this month
  const existingRun = useMemo(() =>
    payrollRuns.find(r => r.monthKey === monthKey),
    [payrollRuns, monthKey]
  )

  // ── Calculate payroll ──────────────────────────────────────────────────────
  const calculatePayroll = (emps) => {
    return emps.map(emp => {
      let calc
      if (emp.id === 'rikesh' || emp.isOwner) {
        calc = calculateRikeshPayroll(emp, settings?.carLoanEMI || 62372)
      } else if (emp.type === 'fulltime') {
        calc = calculateFullTimePayroll(emp)
      } else {
        calc = calculateInternPayroll(emp)
      }
      return { ...emp, ...calc }
    })
  }

  const preview = useMemo(() => calculatePayroll(activeEmployees), [activeEmployees])
  const deposits = useMemo(() => getPayrollDeposits(preview), [preview])

  // ── Run payroll ─────────────────────────────────────────────────────────────
  const handleRunPayroll = async () => {
    if (!monthKey) return
    setSaving(true)
    try {
      const results = calculatePayroll(activeEmployees)
      const depositTotals = getPayrollDeposits(results)
      const run = {
        monthKey,
        monthLabel,
        bsYear: selectedMonth.year,
        bsMonth: selectedMonth.month,
        results,
        deposits: depositTotals,
        tdsStatus: 'pending',
        ssfStatus: 'pending',
        runAt: new Date().toISOString(),
      }
      await addRun(run)

      // Auto-create Salary Ledger entry for Rikesh
      const rikeshResult = results.find(r => r.isOwner || r.id === 'rikesh')
      if (rikeshResult) {
        const carLoanEMI = settings?.carLoanEMI || 62372
        const netOwed = (rikeshResult.grossPay || 0) - (rikeshResult.employeeSSF || 0) - carLoanEMI
        await addDocument('salaryLedger', {
          monthKey,
          monthLabel,
          bsYear: selectedMonth.year,
          bsMonth: selectedMonth.month,
          grossAccrued: rikeshResult.grossPay || 0,
          employeeSSF: rikeshResult.employeeSSF || 0,
          carLoanEMI,
          netOwed: Math.max(0, netOwed),
          totalPaid: 0,
          status: 'unpaid',
          payments: [],
        })
      }

      // Auto-create TDS and SSF reminders due 25th of following month
      const dueD = new Date()
      dueD.setMonth(dueD.getMonth() + 1)
      dueD.setDate(25)
      const dueDate = dueD.toISOString().split('T')[0]

      if (depositTotals.totalTDS > 0) {
        await addDocument('reminders', {
          title: `TDS deposit for ${monthLabel}`,
          amount: depositTotals.totalTDS,
          dueDate,
          status: 'active',
          type: 'tds',
          notes: 'Due to IRD by 25th of following month',
        })
      }
      if (depositTotals.totalSSF > 0) {
        await addDocument('reminders', {
          title: `SSF deposit for ${monthLabel}`,
          amount: depositTotals.totalSSF,
          dueDate,
          status: 'active',
          type: 'ssf',
          notes: 'Due to SSF by 25th of following month',
        })
      }

      setRunResult(run)
      setShowRunModal(false)
    } finally {
      setSaving(false)
    }
  }

  // ── Update compliance status ───────────────────────────────────────────────
  const handleUpdateStatus = async (field, value, reference = '') => {
    if (!existingRun) return
    await updateDocument('payrollRuns', existingRun.id, {
      [field]: value,
      [`${field}Date`]: new Date().toISOString().split('T')[0],
      [`${field}Ref`]: reference,
    })
  }

  // ── Generate payslip ───────────────────────────────────────────────────────
  const handleGeneratePayslip = (emp, calc) => {
    const company = settings?.company || {}
    generatePayslipPDF(emp, calc, monthLabel, company, settings?.logoBase64)
  }

  const handleGenerateAll = () => {
    const results = existingRun?.results || preview
    results.forEach(r => {
      handleGeneratePayslip(r, r)
    })
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <SectionHeader
        title="Payroll"
        subtitle={monthLabel}
        action={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => { setEditEmployee(null); setShowEmployeeModal(true) }} icon={Plus}>
              Add Employee
            </Button>
            {existingRun ? (
              <Button variant="ghost" size="sm" icon={Download} onClick={handleGenerateAll}>
                All Payslips
              </Button>
            ) : (
              <Button size="sm" icon={Play} onClick={() => setShowRunModal(true)}>
                Run Payroll
              </Button>
            )}
          </div>
        }
      />

      {/* ── Payroll preview / run result ──────────────────────────────────── */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-display font-bold text-white text-base">{monthLabel} Payroll</h2>
            {existingRun && (
              <p className="text-xs text-green-400 font-body mt-0.5 flex items-center gap-1">
                <CheckCircle size={11} /> Run on {existingRun.runAt?.split('T')[0]}
              </p>
            )}
          </div>
          <div className="flex gap-4 text-right">
            <div>
              <div className="text-xs text-[#555] font-body">Total Payout</div>
              <div className="font-mono text-white text-lg font-bold">
                {formatNPR(preview.reduce((s, e) => s + (e.netPay || 0), 0))}
              </div>
            </div>
            <div>
              <div className="text-xs text-[#555] font-body">Total CTC</div>
              <div className="font-mono text-[#E8192C] text-lg font-bold">
                {formatNPR(preview.reduce((s, e) => s + (e.totalCTC || 0), 0))}
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm font-body">
            <thead>
              <tr className="border-b border-[#2a2a2a]">
                {['Employee', 'Basic', 'Gross', 'Emp SSF', 'TDS', 'Net Pay', 'Emp SSF (Co.)', ''].map((h, i) => (
                  <th key={i} className={clsx('pb-3 text-xs text-[#555] uppercase tracking-wider font-medium', i > 1 ? 'text-right' : 'text-left')}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a1a1a]">
              {preview.map((emp) => (
                <tr key={emp.id} className="hover:bg-[#111] transition-colors">
                  <td className="py-3">
                    <div className="font-medium text-white">{emp.name}</div>
                    <div className="text-xs text-[#444] capitalize">{emp.type} {emp.isOwner ? '· CEO' : ''}</div>
                  </td>
                  <td className="py-3 font-mono text-[#888] text-right">{formatNPR(emp.basic)}</td>
                  <td className="py-3 font-mono text-white text-right">{formatNPR(emp.grossPay)}</td>
                  <td className="py-3 font-mono text-yellow-400 text-right">{emp.employeeSSF ? `-${formatNPR(emp.employeeSSF)}` : '—'}</td>
                  <td className="py-3 font-mono text-orange-400 text-right">
                    {emp.isOwner ? <span className="text-[#444] text-xs">On withdrawal</span> : (emp.monthlyTDS ? `-${formatNPR(emp.monthlyTDS)}` : '—')}
                  </td>
                  <td className="py-3 font-mono text-green-400 text-right font-bold">{formatNPR(emp.netPay)}</td>
                  <td className="py-3 font-mono text-blue-400 text-right">{emp.employerSSF ? formatNPR(emp.employerSSF) : '—'}</td>
                  <td className="py-3 text-right">
                    <button
                      onClick={() => handleGeneratePayslip(emp, emp)}
                      className="text-xs text-[#555] hover:text-white border border-[#2a2a2a] hover:border-[#444] px-2 py-1 rounded-lg transition-all"
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

      {/* ── Compliance tracking ───────────────────────────────────────────── */}
      {existingRun && (
        <div className="grid grid-cols-2 gap-4">
          <ComplianceCard
            title="TDS Deposit"
            subtitle={`Due 25th of following month · ${formatNPR(existingRun.deposits?.totalTDS)}`}
            status={existingRun.tdsStatus}
            onMarkDeposited={(ref) => handleUpdateStatus('tdsStatus', 'deposited', ref)}
          />
          <ComplianceCard
            title="SSF Deposit"
            subtitle={`Due 25th of following month · ${formatNPR(existingRun.deposits?.totalSSF)}`}
            status={existingRun.ssfStatus}
            onMarkDeposited={(ref) => handleUpdateStatus('ssfStatus', 'deposited', ref)}
          />
        </div>
      )}

      {/* ── Deposit summary ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="text-xs text-[#555] font-body uppercase tracking-wider mb-1">Total SSF (Combined)</div>
          <div className="font-mono text-blue-400 text-lg font-bold">{formatNPR(deposits.totalSSF)}</div>
          <div className="text-xs text-[#444] mt-1">Emp: {formatNPR(deposits.totalEmployeeSSF)} + Co: {formatNPR(deposits.totalEmployerSSF)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-[#555] font-body uppercase tracking-wider mb-1">Total TDS</div>
          <div className="font-mono text-orange-400 text-lg font-bold">{formatNPR(deposits.totalTDS)}</div>
          <div className="text-xs text-[#444] mt-1">Due 25th next month</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-[#555] font-body uppercase tracking-wider mb-1">Active Employees</div>
          <div className="font-mono text-white text-lg font-bold">{activeEmployees.length}</div>
          <div className="text-xs text-[#444] mt-1">{activeEmployees.filter(e => e.type === 'fulltime').length} full-time</div>
        </Card>
      </div>

      {/* ── Employee list ─────────────────────────────────────────────────── */}
      <Card className="p-5">
        <h2 className="font-display font-bold text-white text-base mb-4">Employees</h2>
        <div className="space-y-2">
          {employees.map(emp => (
            <div key={emp.id} className="flex items-center justify-between p-3 bg-[#1a1a1a] rounded-xl hover:bg-[#1e1e1e] transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#2a2a2a] flex items-center justify-center text-sm font-display font-bold text-white">
                  {emp.name?.[0]}
                </div>
                <div>
                  <div className="font-body font-medium text-white text-sm flex items-center gap-2">
                    {emp.name}
                    {emp.isOwner && <span className="text-[10px] text-[#E8192C] border border-[#E8192C]/20 px-1.5 py-0.5 rounded-md">CEO</span>}
                    {!emp.active && <span className="text-[10px] text-[#444] border border-[#2a2a2a] px-1.5 py-0.5 rounded-md">Inactive</span>}
                  </div>
                  <div className="text-xs text-[#444] capitalize">
                    {emp.type === 'fulltime' ? `Full-time · CTC ${formatNPR(emp.ctc)}` : `${emp.type} · ${formatNPR(emp.flatPay)}/mo`}
                    {emp.gender === 'female' && ' · 10% TDS rebate'}
                    {emp.isMarried && ' · Married threshold'}
                  </div>
                </div>
              </div>
              <button
                onClick={() => { setEditEmployee(emp); setShowEmployeeModal(true) }}
                className="w-7 h-7 rounded-lg hover:bg-[#2a2a2a] flex items-center justify-center text-[#444] hover:text-white transition-colors"
              >
                <Pencil size={12} />
              </button>
            </div>
          ))}
        </div>
      </Card>

      {/* Run Payroll Modal */}
      <Modal
        isOpen={showRunModal}
        onClose={() => setShowRunModal(false)}
        title={`Run Payroll · ${monthLabel}`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowRunModal(false)}>Cancel</Button>
            <Button onClick={handleRunPayroll} loading={saving} icon={Play}>Confirm & Run</Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="p-4 bg-[#1a1a1a] rounded-xl">
            <p className="text-sm text-[#888] font-body mb-3">This will calculate and lock payroll for {monthLabel}.</p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[#555]">Employees</span>
                <span className="text-white font-mono">{activeEmployees.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#555]">Total Net Payout</span>
                <span className="text-green-400 font-mono">{formatNPR(preview.reduce((s, e) => s + (e.netPay || 0), 0))}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#555]">TDS to deposit</span>
                <span className="text-orange-400 font-mono">{formatNPR(deposits.totalTDS)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#555]">SSF to deposit</span>
                <span className="text-blue-400 font-mono">{formatNPR(deposits.totalSSF)}</span>
              </div>
            </div>
          </div>
          <p className="text-xs text-[#444] font-body">
            Payroll reminders for TDS and SSF will be automatically created after running.
          </p>
        </div>
      </Modal>

      {/* Employee Modal */}
      <EmployeeModal
        isOpen={showEmployeeModal}
        onClose={() => { setShowEmployeeModal(false); setEditEmployee(null) }}
        employee={editEmployee}
        onSave={async (data) => {
          if (editEmployee?.id) {
            await updateEmployee(editEmployee.id, data)
          } else {
            await addEmployee(data)
          }
          setShowEmployeeModal(false)
        }}
      />
    </div>
  )
}

// ── Compliance Card ───────────────────────────────────────────────────────────
function ComplianceCard({ title, subtitle, status, onMarkDeposited }) {
  const [showRef, setShowRef] = useState(false)
  const [ref, setRef] = useState('')
  const deposited = status === 'deposited'

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-display font-bold text-white text-sm">{title}</h3>
        <span className={clsx(
          'text-xs px-2 py-0.5 rounded-md font-body',
          deposited ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'
        )}>
          {deposited ? '✓ Deposited' : 'Pending'}
        </span>
      </div>
      <p className="text-xs text-[#444] font-body mb-3">{subtitle}</p>
      {!deposited && (
        showRef ? (
          <div className="flex gap-2">
            <input
              value={ref}
              onChange={e => setRef(e.target.value)}
              placeholder="Reference number..."
              className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-1.5 text-xs text-white font-body outline-none focus:border-[#E8192C]"
            />
            <button onClick={() => onMarkDeposited(ref)} className="text-xs bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg font-body transition-colors">
              Confirm
            </button>
          </div>
        ) : (
          <button onClick={() => setShowRef(true)} className="text-xs text-[#555] hover:text-white border border-[#2a2a2a] hover:border-[#444] px-3 py-1.5 rounded-lg font-body transition-all">
            Mark as Deposited
          </button>
        )
      )}
    </Card>
  )
}

// ── Employee Modal ────────────────────────────────────────────────────────────
function EmployeeModal({ isOpen, onClose, employee, onSave }) {
  const [form, setForm] = useState(employee || {
    name: '', type: 'fulltime', ctc: '', flatPay: '',
    gender: 'male', isMarried: false, active: true, isOwner: false,
  })
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave({
        ...form,
        ctc: parseFloat(form.ctc) || 0,
        flatPay: parseFloat(form.flatPay) || 0,
        allowances: form.allowances || [],
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={employee ? `Edit ${employee.name}` : 'Add Employee'}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>Save</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input label="Name" value={form.name} onChange={e => set('name', e.target.value)} />
        <Select label="Employee Type" value={form.type} onChange={e => set('type', e.target.value)}>
          <option value="fulltime">Full-time</option>
          <option value="trainee">Trainee</option>
          <option value="intern">Intern</option>
        </Select>
        {form.type === 'fulltime' ? (
          <Input label="CTC (Monthly NPR)" type="number" prefix="NPR" value={form.ctc} onChange={e => set('ctc', e.target.value)} />
        ) : (
          <Input label="Flat Pay (Monthly NPR)" type="number" prefix="NPR" value={form.flatPay} onChange={e => set('flatPay', e.target.value)} />
        )}
        <div className="grid grid-cols-2 gap-3">
          <Select label="Gender" value={form.gender} onChange={e => set('gender', e.target.value)}>
            <option value="male">Male</option>
            <option value="female">Female (10% TDS rebate)</option>
          </Select>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[#888] font-body font-medium uppercase tracking-wider">Marital Status</label>
            <div className="flex gap-2 mt-1">
              {[['false', 'Single'], ['true', 'Married']].map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => set('isMarried', val === 'true')}
                  className={clsx(
                    'flex-1 py-2 rounded-lg text-xs font-body border transition-all',
                    String(form.isMarried) === val
                      ? 'bg-[#E8192C]/10 border-[#E8192C] text-[#E8192C]'
                      : 'bg-[#1a1a1a] border-[#2a2a2a] text-[#555]'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <Toggle checked={form.active} onChange={v => set('active', v)} label="Active employee" />
          <Toggle checked={form.isOwner} onChange={v => set('isOwner', v)} label="Owner / CEO" />
        </div>
        {form.type === 'fulltime' && form.ctc && (
          <div className="p-3 bg-[#1a1a1a] rounded-xl text-xs space-y-1 font-mono">
            {(() => {
              try {
                const calc = calculateFullTimePayroll({
                  ctc: parseFloat(form.ctc),
                  gender: form.gender,
                  isMarried: form.isMarried,
                  allowances: [],
                })
                return (
                  <>
                    <div className="flex justify-between text-[#555]"><span>Basic</span><span>{formatNPR(calc.basic)}</span></div>
                    <div className="flex justify-between text-[#555]"><span>Emp SSF (11%)</span><span>-{formatNPR(calc.employeeSSF)}</span></div>
                    <div className="flex justify-between text-[#555]"><span>Monthly TDS</span><span>-{formatNPR(calc.monthlyTDS)}</span></div>
                    <div className="border-t border-[#2a2a2a] my-1" />
                    <div className="flex justify-between text-green-400 font-bold"><span>Net Take-Home</span><span>{formatNPR(calc.netPay)}</span></div>
                  </>
                )
              } catch { return null }
            })()}
          </div>
        )}
      </div>
    </Modal>
  )
}
