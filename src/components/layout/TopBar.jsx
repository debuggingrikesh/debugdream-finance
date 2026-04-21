import { useState } from 'react'
import { Bell, ChevronDown, ChevronLeft, ChevronRight, Sun, Moon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { formatNPR } from '../../utils/formatUtils'
import { BS_MONTHS, AD_MONTHS } from '../../utils/dateUtils'
import clsx from 'clsx'

export default function TopBar() {
  const navigate = useNavigate()
  const { today, selectedMonth, setSelectedMonth, currentFY, bankBalance, cashBalance, reminders } = useApp()
  const [showMonthPicker, setShowMonthPicker] = useState(false)

  // ── Dark / Light mode ────────────────────────────────────────────────────
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return true
    return localStorage.getItem('dd-theme') !== 'light'
  })

  const toggleTheme = () => {
    const next = !isDark
    setIsDark(next)
    if (next) {
      document.documentElement.classList.remove('light')
      localStorage.setItem('dd-theme', 'dark')
    } else {
      document.documentElement.classList.add('light')
      localStorage.setItem('dd-theme', 'light')
    }
  }

  const activeAlerts = reminders?.filter(r => r.status === 'active')?.length || 0
  const { ad, bs } = today
  const displayMonth  = selectedMonth || { year: bs.year, month: bs.month }
  const isCurrentMonth = displayMonth.year === bs.year && displayMonth.month === bs.month

  const prevMonth = () => {
    let { year, month } = displayMonth
    month--
    if (month < 1) { month = 12; year-- }
    setSelectedMonth(year, month)
  }

  const nextMonth = () => {
    let { year, month } = displayMonth
    month++
    if (month > 12) { month = 1; year++ }
    setSelectedMonth(year, month)
  }

  return (
    <header className="h-14 bg-bg-primary border-b border-border flex items-center px-3 gap-2 shrink-0 relative z-20">

      {/* Date — hidden on small screens */}
      <div className="hidden md:flex flex-col leading-none mr-1">
        <span className="text-xs text-text-muted font-body">
          {ad.getDate()} {AD_MONTHS[ad.getMonth()]} {ad.getFullYear()}
        </span>
        <span className="text-xs text-accent font-display font-semibold mt-0.5">
          {bs.day} {BS_MONTHS[bs.month - 1]} {bs.year}
        </span>
      </div>

      <div className="hidden md:block w-px h-6 bg-border" />

      {/* Fiscal year */}
      <div className="hidden md:flex">
        <span className="text-xs font-body text-text-muted">{currentFY.label}</span>
      </div>

      <div className="flex-1" />

      {/* ── Month selector ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-1">
        <button onClick={prevMonth} className="w-7 h-7 rounded-lg hover:bg-bg-elevated flex items-center justify-center text-text-muted hover:text-text-primary transition-colors">
          <ChevronLeft size={14} />
        </button>

        <button
          onClick={() => setShowMonthPicker(v => !v)}
          className={clsx(
            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all',
            showMonthPicker
              ? 'bg-bg-elevated border-accent text-text-primary'
              : 'hover:bg-bg-elevated border-transparent text-text-secondary hover:text-text-primary'
          )}
        >
          <span className="font-display font-semibold text-sm">{BS_MONTHS[displayMonth.month - 1]}</span>
          <span className="font-mono text-xs text-text-muted">{displayMonth.year}</span>
          <ChevronDown size={11} />
        </button>

        <button onClick={nextMonth} className="w-7 h-7 rounded-lg hover:bg-bg-elevated flex items-center justify-center text-text-muted hover:text-text-primary transition-colors">
          <ChevronRight size={14} />
        </button>

        {!isCurrentMonth && (
          <button onClick={() => setSelectedMonth(bs.year, bs.month)} className="text-xs text-accent hover:underline font-body ml-1">
            Today
          </button>
        )}
      </div>

      {/* Month picker dropdown */}
      {showMonthPicker && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50">
          <div className="bg-bg-surface border border-border rounded-xl p-3 shadow-2xl">
            <div className="flex items-center justify-between mb-2">
              <button onClick={() => setSelectedMonth(displayMonth.year - 1, displayMonth.month)} className="text-text-muted hover:text-text-primary px-2 py-1 text-xs">‹ {displayMonth.year - 1}</button>
              <span className="font-display font-bold text-text-primary text-sm">{displayMonth.year} BS</span>
              <button onClick={() => setSelectedMonth(displayMonth.year + 1, displayMonth.month)} className="text-text-muted hover:text-text-primary px-2 py-1 text-xs">{displayMonth.year + 1} ›</button>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {BS_MONTHS.map((m, i) => {
                const isSel = displayMonth.month === i + 1
                return (
                  <button
                    key={m}
                    onClick={() => { setSelectedMonth(displayMonth.year, i + 1); setShowMonthPicker(false) }}
                    className={clsx(
                      'px-2 py-1.5 rounded-lg text-xs font-body transition-colors',
                      isSel ? 'bg-accent text-white font-semibold' : 'text-text-muted hover:text-text-primary hover:bg-bg-elevated'
                    )}
                  >
                    {m.slice(0, 3)}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <div className="w-px h-6 bg-border" />

      {/* Balances — hidden on xs */}
      <div className="hidden sm:flex items-center gap-3 text-xs font-body">
        <div className="flex flex-col items-end">
          <span className="text-text-muted uppercase tracking-wider text-[10px]">Bank</span>
          <span className="font-mono text-text-primary font-medium">{formatNPR(bankBalance)}</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-text-muted uppercase tracking-wider text-[10px]">Cash</span>
          <span className="font-mono text-text-primary font-medium">{formatNPR(cashBalance)}</span>
        </div>
      </div>

      {/* Dark / Light toggle */}
      <button
        onClick={toggleTheme}
        title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        className="w-8 h-8 rounded-lg hover:bg-bg-elevated flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
      >
        {isDark ? <Sun size={15} /> : <Moon size={15} />}
      </button>

      {/* Bell */}
      <button 
        onClick={() => navigate('/reminders')}
        className="relative w-8 h-8 rounded-lg hover:bg-bg-elevated flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
      >
        <Bell size={15} />
        {activeAlerts > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-accent rounded-full text-white text-[9px] flex items-center justify-center font-bold">
            {activeAlerts > 9 ? '9+' : activeAlerts}
          </span>
        )}
      </button>
    </header>
  )
}
