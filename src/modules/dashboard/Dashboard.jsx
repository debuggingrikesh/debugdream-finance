import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import {
  TrendingUp, TrendingDown, Wallet, Landmark, Banknote,
  ArrowUpRight, ArrowDownRight, Bell, FileText
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useAllIncome, useAllExpenses, useReminders, useInvoices } from '../../hooks/useFirestore'
import { formatNPR, formatCompact } from '../../utils/formatUtils'
import { formatDualDate, getFiscalYearMonths, adToBS, BS_MONTHS } from '../../utils/dateUtils'
import { StatCard, Card, Badge, SectionHeader, Spinner, ProgressBar, EmptyState } from '../../components/ui/index'
import clsx from 'clsx'

const PIE_COLORS = ['#E8192C', '#ff6b6b', '#ff9f43', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff', '#5f27cd']

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-3 shadow-2xl">
      <p className="text-xs text-[#555] font-body mb-2">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-[#888]">{p.name}:</span>
          <span className="font-mono text-white">{formatNPR(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const { selectedMonth, currentFY, settings, bankBalance, cashBalance } = useApp()
  const { data: allIncome, loading: incomeLoading } = useAllIncome()
  const { data: allExpenses, loading: expLoading } = useAllExpenses()
  const { data: reminders } = useReminders()
  const { data: invoices } = useInvoices()

  const loading = incomeLoading || expLoading

  // ── Filter to selected month ───────────────────────────────────────────────
  const monthIncome = useMemo(() => {
    if (!selectedMonth) return []
    return allIncome.filter(t => t.bsYear === selectedMonth.year && t.bsMonth === selectedMonth.month)
  }, [allIncome, selectedMonth])

  const monthExpenses = useMemo(() => {
    if (!selectedMonth) return []
    return allExpenses.filter(t => t.bsYear === selectedMonth.year && t.bsMonth === selectedMonth.month)
  }, [allExpenses, selectedMonth])

  const totalIncome = monthIncome.reduce((s, t) => s + (t.amount || 0), 0)
  const totalExpenses = monthExpenses.reduce((s, t) => s + (t.amount || 0), 0)
  const netBalance = totalIncome - totalExpenses

  // ── Fiscal year bar chart data ─────────────────────────────────────────────
  const fyMonths = useMemo(() => getFiscalYearMonths(currentFY.start), [currentFY])

  const fyChartData = useMemo(() => {
    return fyMonths.map(({ year, month, name }) => {
      const inc = allIncome
        .filter(t => t.bsYear === year && t.bsMonth === month)
        .reduce((s, t) => s + (t.amount || 0), 0)
      const exp = allExpenses
        .filter(t => t.bsYear === year && t.bsMonth === month)
        .reduce((s, t) => s + (t.amount || 0), 0)
      return { name: name.slice(0, 3), income: inc, expenses: exp }
    })
  }, [fyMonths, allIncome, allExpenses])

  // ── Expense breakdown by category ─────────────────────────────────────────
  const expenseByCategory = useMemo(() => {
    const cats = {}
    monthExpenses.forEach(t => {
      const cat = t.category || 'Other'
      cats[cat] = (cats[cat] || 0) + (t.amount || 0)
    })
    return Object.entries(cats)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [monthExpenses])

  // ── Recent transactions (combined) ────────────────────────────────────────
  const recentTx = useMemo(() => {
    const inc = allIncome.map(t => ({ ...t, _type: 'income' }))
    const exp = allExpenses.map(t => ({ ...t, _type: 'expense' }))
    return [...inc, ...exp]
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .slice(0, 10)
  }, [allIncome, allExpenses])

  // ── Upcoming reminders (next 7 days) ──────────────────────────────────────
  const upcomingReminders = useMemo(() => {
    const now = new Date()
    const weekOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    return reminders
      .filter(r => {
        if (!r.dueDate) return true // always show alerts without dates
        const d = new Date(r.dueDate)
        return d <= weekOut
      })
      .slice(0, 5)
  }, [reminders])

  // ── Outstanding invoices ───────────────────────────────────────────────────
  const outstandingInvoices = useMemo(() =>
    invoices.filter(i => i.status === 'Sent' || i.status === 'Overdue'),
    [invoices]
  )

  const monthLabel = selectedMonth
    ? `${BS_MONTHS[selectedMonth.month - 1]} ${selectedMonth.year}`
    : 'This Month'

  return (
    <div className="space-y-6 animate-fade-in">
      <SectionHeader
        title="Dashboard"
        subtitle={`${monthLabel} · ${currentFY.label}`}
      />

      {/* ── Stat cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard
          label="Income"
          value={formatNPR(totalIncome)}
          icon={TrendingUp}
          loading={loading}
        />
        <StatCard
          label="Expenses"
          value={formatNPR(totalExpenses)}
          icon={TrendingDown}
          loading={loading}
        />
        <StatCard
          label="Net Balance"
          value={formatNPR(netBalance)}
          icon={netBalance >= 0 ? ArrowUpRight : ArrowDownRight}
          accent={netBalance >= 0}
          loading={loading}
        />
        <StatCard
          label="Bank Balance"
          value={formatNPR(bankBalance)}
          icon={Landmark}
          loading={loading}
        />
        <StatCard
          label="Cash in Hand"
          value={formatNPR(cashBalance)}
          icon={Banknote}
          loading={loading}
        />
      </div>

      {/* ── Charts row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Bar chart — FY overview */}
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-display font-bold text-white text-base">Income vs Expenses</h2>
              <p className="text-xs text-[#444] font-body">{currentFY.label} · All 12 months</p>
            </div>
            <div className="flex items-center gap-3 text-xs font-body text-[#555]">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#E8192C] inline-block" />Income</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#2a2a2a] inline-block" />Expenses</span>
            </div>
          </div>
          {loading ? (
            <div className="h-52 bg-[#1a1a1a] rounded-xl animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={fyChartData} barGap={2}>
                <XAxis dataKey="name" tick={{ fill: '#444', fontSize: 10, fontFamily: 'DM Sans' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#444', fontSize: 10, fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} tickFormatter={v => formatCompact(v)} width={48} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
                <Bar dataKey="income" fill="#E8192C" radius={[4, 4, 0, 0]} maxBarSize={20} />
                <Bar dataKey="expenses" fill="#2a2a2a" radius={[4, 4, 0, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Pie — expense breakdown */}
        <Card className="p-5">
          <h2 className="font-display font-bold text-white text-base mb-1">Expenses by Category</h2>
          <p className="text-xs text-[#444] font-body mb-4">{monthLabel}</p>
          {loading ? (
            <div className="h-40 bg-[#1a1a1a] rounded-xl animate-pulse" />
          ) : expenseByCategory.length === 0 ? (
            <div className="flex items-center justify-center h-40">
              <p className="text-[#333] text-sm font-body">No expenses this month</p>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={expenseByCategory} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                    {expenseByCategory.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-3">
                {expenseByCategory.slice(0, 4).map((cat, i) => (
                  <div key={cat.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-[#888] font-body truncate max-w-[100px]">{cat.name}</span>
                    </div>
                    <span className="font-mono text-white">{formatNPR(cat.value)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* ── Bottom row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent transactions */}
        <Card className="p-5 lg:col-span-2">
          <h2 className="font-display font-bold text-white text-base mb-4">Recent Transactions</h2>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="h-10 bg-[#1a1a1a] rounded-lg animate-pulse" />)}
            </div>
          ) : recentTx.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="No transactions yet"
              description="Add your first income or expense to get started"
            />
          ) : (
            <div className="space-y-1">
              {recentTx.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between py-2.5 border-b border-[#1a1a1a] last:border-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={clsx(
                      'w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
                      tx._type === 'income' ? 'bg-green-500/10' : 'bg-[#1a1a1a]'
                    )}>
                      {tx._type === 'income'
                        ? <ArrowUpRight size={13} className="text-green-400" />
                        : <ArrowDownRight size={13} className="text-[#555]" />
                      }
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-body text-white truncate">
                        {tx.description || tx.clientName || tx.category || '—'}
                      </div>
                      <div className="text-xs text-[#444] font-body">
                        {tx.date || ''} · {tx._type === 'income' ? tx.clientName || 'Income' : tx.category || 'Expense'}
                      </div>
                    </div>
                  </div>
                  <div className={clsx(
                    'font-mono text-sm shrink-0 ml-3',
                    tx._type === 'income' ? 'text-green-400' : 'text-white'
                  )}>
                    {tx._type === 'income' ? '+' : '-'}{formatNPR(tx.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Right column: reminders + outstanding invoices */}
        <div className="space-y-4">
          {/* Reminders */}
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Bell size={14} className="text-[#E8192C]" />
              <h2 className="font-display font-bold text-white text-sm">Upcoming</h2>
              {upcomingReminders.length > 0 && (
                <span className="ml-auto bg-[#E8192C]/10 text-[#E8192C] text-xs px-1.5 py-0.5 rounded-md font-mono">
                  {upcomingReminders.length}
                </span>
              )}
            </div>
            {upcomingReminders.length === 0 ? (
              <p className="text-[#333] text-xs font-body py-4 text-center">No upcoming reminders</p>
            ) : (
              <div className="space-y-2">
                {upcomingReminders.map(r => (
                  <div key={r.id} className="p-2.5 bg-[#1a1a1a] rounded-xl">
                    <div className="text-sm text-white font-body">{r.title}</div>
                    {r.amount && <div className="text-xs text-[#E8192C] font-mono mt-0.5">{formatNPR(r.amount)}</div>}
                    {r.dueDate && <div className="text-xs text-[#444] mt-0.5">{r.dueDate}</div>}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Outstanding invoices */}
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <FileText size={14} className="text-[#555]" />
              <h2 className="font-display font-bold text-white text-sm">Outstanding</h2>
              {outstandingInvoices.length > 0 && (
                <span className="ml-auto bg-yellow-500/10 text-yellow-400 text-xs px-1.5 py-0.5 rounded-md font-mono">
                  {outstandingInvoices.length}
                </span>
              )}
            </div>
            {outstandingInvoices.length === 0 ? (
              <p className="text-[#333] text-xs font-body py-4 text-center">No outstanding invoices</p>
            ) : (
              <div className="space-y-2">
                {outstandingInvoices.slice(0, 3).map(inv => (
                  <div key={inv.id} className="p-2.5 bg-[#1a1a1a] rounded-xl">
                    <div className="flex justify-between items-start">
                      <div className="text-sm text-white font-body">{inv.clientName}</div>
                      <span className={clsx(
                        'text-xs px-1.5 py-0.5 rounded font-body',
                        inv.status === 'Overdue' ? 'text-red-400 bg-red-500/10' : 'text-blue-400 bg-blue-500/10'
                      )}>
                        {inv.status}
                      </span>
                    </div>
                    <div className="text-xs font-mono text-[#E8192C] mt-0.5">
                      {formatNPR(inv.total || 0)}
                    </div>
                    <div className="text-xs text-[#444]">{inv.invoiceNumber}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
