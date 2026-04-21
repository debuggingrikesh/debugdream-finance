import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import {
  TrendingUp, TrendingDown, Wallet, Landmark, Banknote,
  ArrowUpRight, ArrowDownRight, Bell, FileText,
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useAllIncome, useAllExpenses, useReminders, useInvoices } from '../../hooks/useFirestore'
import { formatNPR, formatCompact, formatByCurrency } from '../../utils/formatUtils'
import { useInvoiceReminders } from '../../hooks/useInvoiceReminders'
import { getFiscalYearMonths, BS_MONTHS } from '../../utils/dateUtils'
import { StatCard, Card, Badge, SectionHeader, EmptyState } from '../../components/ui/index'
import clsx from 'clsx'

const PIE_COLORS = ['#E8192C', '#ff6b6b', '#ff9f43', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff', '#5f27cd']

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-bg-elevated border border-border rounded-xl p-3 shadow-2xl">
      <p className="text-xs text-text-muted font-body mb-2">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-text-secondary">{p.name}:</span>
          <span className="font-mono text-text-primary">{formatNPR(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function Dashboard() {
  useInvoiceReminders()
  const { selectedMonth, currentFY, bankBalance, cashBalance } = useApp()
  const { data: allIncome,   loading: incomeLoading } = useAllIncome()
  const { data: allExpenses, loading: expLoading    } = useAllExpenses()
  const { data: reminders  } = useReminders()
  const { data: invoices   } = useInvoices()

  const loading = incomeLoading || expLoading

  // Filter to selected month
  const monthIncome   = useMemo(() => allIncome.filter(t   => t.bsYear === selectedMonth?.year && t.bsMonth === selectedMonth?.month), [allIncome,   selectedMonth])
  const monthExpenses = useMemo(() => allExpenses.filter(t => t.bsYear === selectedMonth?.year && t.bsMonth === selectedMonth?.month), [allExpenses, selectedMonth])

  const totalIncome   = monthIncome.reduce((s, t)   => s + (t.amount || 0), 0)
  const totalExpenses = monthExpenses.reduce((s, t) => s + (t.amount || 0), 0)
  const netBalance    = totalIncome - totalExpenses

  // Fiscal year bar chart
  const fyMonths    = useMemo(() => getFiscalYearMonths(currentFY.start), [currentFY])
  const fyChartData = useMemo(() => fyMonths.map(({ year, month, name }) => ({
    name: name.slice(0, 3),
    income:   allIncome.filter(t   => t.bsYear === year && t.bsMonth === month).reduce((s, t) => s + (t.amount || 0), 0),
    expenses: allExpenses.filter(t => t.bsYear === year && t.bsMonth === month).reduce((s, t) => s + (t.amount || 0), 0),
  })), [fyMonths, allIncome, allExpenses])

  // Expense by category (pie)
  const expenseByCategory = useMemo(() => {
    const cats = {}
    monthExpenses.forEach(t => { const c = t.category || 'Other'; cats[c] = (cats[c] || 0) + (t.amount || 0) })
    return Object.entries(cats).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  }, [monthExpenses])

  // Recent transactions
  const recentTx = useMemo(() => {
    const inc = allIncome.map(t   => ({ ...t, _type: 'income'  }))
    const exp = allExpenses.map(t => ({ ...t, _type: 'expense' }))
    return [...inc, ...exp].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 10)
  }, [allIncome, allExpenses])

  // Upcoming reminders (next 7 days)
  const upcomingReminders = useMemo(() => {
    const weekOut = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    return reminders.filter(r => !r.dueDate || new Date(r.dueDate) <= weekOut).slice(0, 5)
  }, [reminders])

  const outstandingInvoices = useMemo(() => invoices.filter(i => i.status === 'Sent' || i.status === 'Overdue'), [invoices])

  const monthLabel = selectedMonth ? `${BS_MONTHS[selectedMonth.month - 1]} ${selectedMonth.year}` : 'This Month'

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      <SectionHeader title="Dashboard" subtitle={`${monthLabel} · ${currentFY.label}`} />

      {/* ── Stat cards: 2 col → 3 col (sm) → 5 col (lg) ─────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 md:gap-3">
        <StatCard label="Income (NPR)"       value={formatNPR(totalIncome)}   icon={TrendingUp}                               loading={loading} />
        <StatCard label="Expenses (NPR)"     value={formatNPR(totalExpenses)} icon={TrendingDown}                             loading={loading} />
        <StatCard label="Net Balance (NPR)"  value={formatNPR(netBalance)}    icon={netBalance >= 0 ? ArrowUpRight : ArrowDownRight} accent={netBalance >= 0} loading={loading} />
        <StatCard label="Bank Balance (NPR)" value={formatNPR(bankBalance)}   icon={Landmark}                                loading={loading} />
        <StatCard label="Cash in Hand (NPR)" value={formatNPR(cashBalance)}   icon={Banknote}                                loading={loading} />
      </div>

      {/* ── Charts: stacked on mobile, side-by-side on lg ────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4">
        {/* Bar chart */}
        <Card className="p-4 md:p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display font-bold text-text-primary text-sm md:text-base">Income vs Expenses</h2>
              <p className="text-xs text-text-muted font-body">{currentFY.label} · All 12 months</p>
            </div>
            <div className="flex items-center gap-3 text-xs font-body text-text-muted">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-accent inline-block" />Inc</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-border inline-block" />Exp</span>
            </div>
          </div>
          {loading ? (
            <div className="h-44 bg-bg-elevated rounded-xl animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={fyChartData} barGap={2}>
                <XAxis dataKey="name" tick={{ fill: 'var(--color-text-muted)', fontSize: 10, fontFamily: 'DM Sans' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--color-text-muted)', fontSize: 10, fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} tickFormatter={v => formatCompact(v)} width={44} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
                <Bar dataKey="income"   fill="var(--color-accent)" radius={[4,4,0,0]} maxBarSize={18} />
                <Bar dataKey="expenses" fill="var(--color-border)" radius={[4,4,0,0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Pie chart */}
        <Card className="p-4 md:p-5">
          <h2 className="font-display font-bold text-text-primary text-sm md:text-base mb-1">By Category</h2>
          <p className="text-xs text-text-muted font-body mb-3">{monthLabel}</p>
          {loading ? (
            <div className="h-36 bg-bg-elevated rounded-xl animate-pulse" />
          ) : expenseByCategory.length === 0 ? (
            <div className="flex items-center justify-center h-36">
              <p className="text-text-muted text-sm font-body">No expenses this month</p>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={130}>
                <PieChart>
                  <Pie data={expenseByCategory} cx="50%" cy="50%" innerRadius={36} outerRadius={58} paddingAngle={3} dataKey="value">
                    {expenseByCategory.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {expenseByCategory.slice(0, 4).map((cat, i) => (
                  <div key={cat.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-text-secondary font-body truncate max-w-[90px]">{cat.name}</span>
                    </div>
                    <span className="font-mono text-text-primary">{formatNPR(cat.value)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* ── Bottom: transactions + sidebar panels ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4">
        {/* Recent transactions */}
        <Card className="p-4 md:p-5 lg:col-span-2">
          <h2 className="font-display font-bold text-text-primary text-sm md:text-base mb-4">Recent Transactions</h2>
          {loading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-10 bg-bg-elevated rounded-lg animate-pulse" />)}</div>
          ) : recentTx.length === 0 ? (
            <EmptyState icon={Wallet} title="No transactions yet" description="Add your first income or expense to get started" />
          ) : (
            <div className="space-y-0">
              {recentTx.map(tx => (
                <div key={tx.id} className="flex items-center justify-between py-2.5 border-b border-bg-elevated last:border-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={clsx('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', tx._type === 'income' ? 'bg-green-500/10' : 'bg-bg-elevated')}>
                      {tx._type === 'income'
                        ? <ArrowUpRight size={13} className="text-green-400" />
                        : <ArrowDownRight size={13} className="text-text-muted" />
                      }
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-body text-text-primary truncate">
                        {tx.description || tx.clientName || tx.category || '—'}
                      </div>
                      <div className="text-xs text-text-muted font-body">
                        {tx.date || ''} · {tx._type === 'income' ? (tx.clientName || 'Income') : (tx.category || 'Expense')}
                      </div>
                    </div>
                  </div>
                  <div className={clsx('font-mono text-sm shrink-0 ml-3 text-right', tx._type === 'income' ? 'text-green-400' : 'text-text-primary')}>
                    <div>{tx._type === 'income' ? '+' : '-'}{formatNPR(tx.amount)}</div>
                    {tx.originalCurrency && tx.originalCurrency !== 'NPR' && (
                      <div className="text-[10px] text-text-muted">~ {tx.originalCurrency} {tx.originalAmount}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Right column */}
        <div className="space-y-3 md:space-y-4">
          {/* Reminders */}
          <Card className="p-4 md:p-5">
            <div className="flex items-center gap-2 mb-3">
              <Bell size={13} className="text-accent" />
              <h2 className="font-display font-bold text-text-primary text-sm">Upcoming</h2>
              {upcomingReminders.length > 0 && (
                <span className="ml-auto bg-accent/10 text-accent text-xs px-1.5 py-0.5 rounded-md font-mono">
                  {upcomingReminders.length}
                </span>
              )}
            </div>
            {upcomingReminders.length === 0 ? (
              <p className="text-text-muted text-xs font-body py-3 text-center">No upcoming reminders</p>
            ) : (
              <div className="space-y-2">
                {upcomingReminders.map(r => (
                  <div key={r.id} className="p-2.5 bg-bg-elevated rounded-xl">
                    <div className="text-sm text-text-primary font-body">{r.title}</div>
                    {r.amount > 0 && (
                      <div className="text-xs text-accent font-mono mt-0.5">
                        {r.currency && r.currency !== 'NPR' ? formatByCurrency(r.amount, r.currency) : formatNPR(r.amount)}
                      </div>
                    )}
                    {r.dueDate && <div className="text-xs text-text-muted mt-0.5">{r.dueDate}</div>}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Outstanding invoices */}
          <Card className="p-4 md:p-5">
            <div className="flex items-center gap-2 mb-3">
              <FileText size={13} className="text-text-muted" />
              <h2 className="font-display font-bold text-text-primary text-sm">Outstanding</h2>
              {outstandingInvoices.length > 0 && (
                <span className="ml-auto bg-yellow-500/10 text-yellow-400 text-xs px-1.5 py-0.5 rounded-md font-mono">
                  {outstandingInvoices.length}
                </span>
              )}
            </div>
            {outstandingInvoices.length === 0 ? (
              <p className="text-text-muted text-xs font-body py-3 text-center">No outstanding invoices</p>
            ) : (
              <div className="space-y-2">
                {outstandingInvoices.slice(0, 3).map(inv => (
                  <div key={inv.id} className="p-2.5 bg-bg-elevated rounded-xl">
                    <div className="flex justify-between items-start">
                      <div className="text-sm text-text-primary font-body">{inv.clientName}</div>
                      <span className={clsx('text-xs px-1.5 py-0.5 rounded font-body', inv.status === 'Overdue' ? 'text-red-400 bg-red-500/10' : 'text-blue-400 bg-blue-500/10')}>
                        {inv.status}
                      </span>
                    </div>
                    <div className="text-xs font-mono text-accent mt-0.5">{formatByCurrency(inv.total || 0, inv.currency)}</div>
                    <div className="text-xs text-text-muted">{inv.invoiceNumber}</div>
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
