import { useState } from 'react'
import { Bell, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { formatNPR } from '../../utils/formatUtils'
import { BS_MONTHS, AD_MONTHS } from '../../utils/dateUtils'
import clsx from 'clsx'

export default function TopBar() {
  const { today, selectedMonth, setSelectedMonth, currentFY, bankBalance, cashBalance, reminders } = useApp()
  const [showMonthPicker, setShowMonthPicker] = useState(false)
  const activeAlerts = reminders?.filter(r => r.status === 'active')?.length || 0

  const { ad, bs } = today

  const displayMonth = selectedMonth || { year: bs.year, month: bs.month }

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

  const isCurrentMonth = displayMonth.year === bs.year && displayMonth.month === bs.month

  return (
    <header className="h-16 bg-[#0a0a0a] border-b border-[#1a1a1a] flex items-center px-4 gap-4 shrink-0 relative z-20">
      {/* Left — date display */}
      <div className="hidden md:flex flex-col leading-none">
        <span className="text-xs text-[#444] font-body">
          {ad.getDate()} {AD_MONTHS[ad.getMonth()]} {ad.getFullYear()}
        </span>
        <span className="text-xs text-[#E8192C] font-display font-semibold mt-0.5">
          {bs.day} {BS_MONTHS[bs.month - 1]} {bs.year}
        </span>
      </div>

      <div className="hidden md:block w-px h-8 bg-[#1a1a1a]" />

      {/* Fiscal year label */}
      <div className="hidden md:flex items-center">
        <span className="text-xs font-body text-[#444]">{currentFY.label}</span>
      </div>

      <div className="flex-1" />

      {/* Center — Month selector */}
      <div className="flex items-center gap-1">
        <button
          onClick={prevMonth}
          className="w-7 h-7 rounded-lg hover:bg-[#1a1a1a] flex items-center justify-center text-[#555] hover:text-white transition-colors"
        >
          <ChevronLeft size={14} />
        </button>

        <button
          onClick={() => setShowMonthPicker(!showMonthPicker)}
          className={clsx(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all',
            showMonthPicker
              ? 'bg-[#1a1a1a] border-[#E8192C] text-white'
              : 'hover:bg-[#1a1a1a] border-transparent text-[#888] hover:text-white'
          )}
        >
          <span className="font-display font-semibold text-sm">
            {BS_MONTHS[displayMonth.month - 1]}
          </span>
          <span className="font-mono text-xs text-[#555]">{displayMonth.year}</span>
          <ChevronDown size={12} />
        </button>

        <button
          onClick={nextMonth}
          className="w-7 h-7 rounded-lg hover:bg-[#1a1a1a] flex items-center justify-center text-[#555] hover:text-white transition-colors"
        >
          <ChevronRight size={14} />
        </button>

        {!isCurrentMonth && (
          <button
            onClick={() => setSelectedMonth(bs.year, bs.month)}
            className="text-xs text-[#E8192C] hover:underline font-body ml-1"
          >
            Today
          </button>
        )}
      </div>

      {/* Month picker dropdown */}
      {showMonthPicker && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50">
          <div className="bg-[#111] border border-[#2a2a2a] rounded-xl p-3 shadow-2xl">
            {/* Year selector */}
            <div className="flex items-center justify-between mb-2">
              <button onClick={() => setSelectedMonth(displayMonth.year - 1, displayMonth.month)} className="text-[#555] hover:text-white px-2 py-1 text-xs">‹ {displayMonth.year - 1}</button>
              <span className="font-display font-bold text-white text-sm">{displayMonth.year} BS</span>
              <button onClick={() => setSelectedMonth(displayMonth.year + 1, displayMonth.month)} className="text-[#555] hover:text-white px-2 py-1 text-xs">{displayMonth.year + 1} ›</button>
            </div>
            {/* Month grid */}
            <div className="grid grid-cols-4 gap-1">
              {BS_MONTHS.map((m, i) => {
                const isSelected = displayMonth.month === i + 1
                return (
                  <button
                    key={m}
                    onClick={() => {
                      setSelectedMonth(displayMonth.year, i + 1)
                      setShowMonthPicker(false)
                    }}
                    className={clsx(
                      'px-2 py-1.5 rounded-lg text-xs font-body transition-colors',
                      isSelected
                        ? 'bg-[#E8192C] text-white font-semibold'
                        : 'text-[#666] hover:text-white hover:bg-[#1a1a1a]'
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

      <div className="w-px h-8 bg-[#1a1a1a]" />

      {/* Balances */}
      <div className="hidden sm:flex items-center gap-4 text-xs font-body">
        <div className="flex flex-col items-end">
          <span className="text-[#444] uppercase tracking-wider text-[10px]">Bank</span>
          <span className="font-mono text-white font-medium">{formatNPR(bankBalance)}</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[#444] uppercase tracking-wider text-[10px]">Cash</span>
          <span className="font-mono text-white font-medium">{formatNPR(cashBalance)}</span>
        </div>
      </div>

      {/* Bell */}
      <button className="relative w-8 h-8 rounded-lg hover:bg-[#1a1a1a] flex items-center justify-center text-[#555] hover:text-white transition-colors">
        <Bell size={16} />
        {activeAlerts > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#E8192C] rounded-full text-white text-[9px] flex items-center justify-center font-bold">
            {activeAlerts > 9 ? '9+' : activeAlerts}
          </span>
        )}
      </button>
    </header>
  )
}
