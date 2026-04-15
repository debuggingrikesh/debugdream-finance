import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, TrendingUp, Receipt, User, Users,
  FileText, Building2, BookOpen, Package, Car,
  Bell, Settings, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import clsx from 'clsx'

const NAV_ITEMS = [
  { to: '/',              icon: LayoutDashboard, label: 'Dashboard'     },
  { to: '/income',        icon: TrendingUp,      label: 'Income'        },
  { to: '/expenses',      icon: Receipt,         label: 'Expenses'      },
  { to: '/my-expenses',   icon: User,            label: 'My Expenses'   },
  { to: '/payroll',       icon: Users,           label: 'Payroll'       },
  { to: '/invoices',      icon: FileText,        label: 'Invoices'      },
  { to: '/salary-ledger', icon: BookOpen,        label: "Rikesh's Ledger" },
  { to: '/inventory',     icon: Package,         label: 'Inventory'     },
  { to: '/car-loan',      icon: Car,             label: 'Car Loan'      },
  { to: '/reminders',     icon: Bell,            label: 'Reminders'     },
  { to: '/settings',      icon: Settings,        label: 'Settings'      },
]

export default function Sidebar() {
  const { sidebarOpen, toggleSidebar, reminders } = useApp()
  const location = useLocation()
  const activeReminders = reminders?.filter(r => r.status === 'active')?.length || 0

  return (
    <>
      {/* ── Desktop sidebar — hidden below lg ─────────────────────────────── */}
      <aside className={clsx(
        'hidden lg:flex flex-col',
        'fixed left-0 top-0 h-screen z-40 lg:relative lg:z-auto',
        'bg-bg-primary border-r border-bg-elevated',
        'transition-all duration-300 ease-in-out',
        sidebarOpen ? 'w-56' : 'w-[60px]',
      )}>
        {/* Logo / collapse row */}
        <div className={clsx(
          'flex items-center h-16 px-4 border-b border-bg-elevated shrink-0',
          sidebarOpen ? 'justify-between' : 'justify-center'
        )}>
          {sidebarOpen && (
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded bg-accent flex items-center justify-center shrink-0">
                <span className="text-text-primary font-display font-black text-xs">D</span>
              </div>
              <div>
                <div className="font-display font-bold text-text-primary text-sm leading-none">debug</div>
                <div className="font-display font-bold text-accent text-sm leading-none">dream</div>
              </div>
            </div>
          )}
          <button
            onClick={toggleSidebar}
            className="w-7 h-7 rounded-lg bg-bg-elevated hover:bg-bg-hover flex items-center justify-center text-text-muted hover:text-text-primary transition-colors shrink-0"
          >
            {sidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => {
            const isActive   = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)
            const isReminder = to === '/reminders'
            return (
              <NavLink
                key={to}
                to={to}
                className={clsx(
                  'flex items-center gap-3 rounded-lg px-2.5 py-2 transition-all duration-150 group relative',
                  isActive ? 'bg-accent/10 text-accent' : 'text-text-muted hover:text-text-primary hover:bg-bg-elevated',
                  !sidebarOpen && 'justify-center'
                )}
              >
                <div className="relative shrink-0">
                  <Icon size={17} />
                  {isReminder && activeReminders > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-accent rounded-full text-text-primary text-[9px] flex items-center justify-center font-bold">
                      {activeReminders > 9 ? '9+' : activeReminders}
                    </span>
                  )}
                </div>
                {sidebarOpen && (
                  <span className="font-body text-sm font-medium whitespace-nowrap">{label}</span>
                )}
                {/* Hover tooltip when collapsed */}
                {!sidebarOpen && (
                  <div className="absolute left-full ml-2 px-2.5 py-1.5 bg-bg-elevated border border-border rounded-lg text-text-primary text-xs font-body whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-xl">
                    {label}
                  </div>
                )}
              </NavLink>
            )
          })}
        </nav>

        {sidebarOpen && (
          <div className="p-4 border-t border-bg-elevated shrink-0">
            <div className="text-[10px] text-[#2a2a2a] font-mono">v1.0.0 · debugdream</div>
          </div>
        )}
      </aside>

      {/* ── Mobile bottom nav — all 12 items, horizontally scrollable ───── */}
      <nav className="fixed bottom-0 inset-x-0 h-14 bg-bg-primary border-t border-bg-elevated z-40 flex overflow-x-auto scrollbar-none lg:hidden">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => {
          const isActive   = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)
          const isReminder = to === '/reminders'
          return (
            <NavLink
              key={to}
              to={to}
              className={clsx(
                'flex-shrink-0 flex flex-col items-center justify-center gap-0.5 px-3.5 min-w-[60px] transition-colors relative',
                isActive ? 'text-accent' : 'text-text-muted'
              )}
            >
              <div className="relative">
                <Icon size={18} />
                {isReminder && activeReminders > 0 && (
                  <span className="absolute -top-1 -right-1.5 w-3 h-3 bg-accent rounded-full text-text-primary text-[8px] flex items-center justify-center font-bold">
                    {activeReminders > 9 ? '9+' : activeReminders}
                  </span>
                )}
              </div>
              <span className="text-[9px] font-body whitespace-nowrap leading-tight">{label.split(' ')[0]}</span>
            </NavLink>
          )
        })}
      </nav>
    </>
  )
}
