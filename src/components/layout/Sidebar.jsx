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
  { to: '/clients',       icon: Building2,       label: 'Clients'       },
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
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-accent flex items-center justify-center shrink-0 shadow-lg shadow-accent/20">
                <span className="text-text-primary font-display font-black text-sm">D</span>
              </div>
              <div className="flex flex-col">
                <span className="font-display font-bold text-text-primary text-sm tracking-tight leading-none">debug</span>
                <span className="font-display font-bold text-accent text-sm tracking-tight leading-none">dream</span>
              </div>
            </div>
          )}
          <button
            onClick={toggleSidebar}
            className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-text-muted hover:text-text-primary transition-all shrink-0 border border-white/5"
          >
            {sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
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
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 group relative',
                  isActive 
                    ? 'bg-accent/10 text-accent border border-accent/20 shadow-[0_0_20px_rgba(232,25,44,0.05)]' 
                    : 'text-text-secondary hover:text-text-primary hover:bg-white/5',
                  !sidebarOpen && 'justify-center mx-1'
                )}
              >
                <div className={clsx('relative shrink-0 transition-transform duration-200', isActive && 'scale-110')}>
                  <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                  {isReminder && activeReminders > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-accent rounded-full text-text-primary text-[10px] flex items-center justify-center font-bold shadow-lg shadow-accent/40">
                      {activeReminders > 9 ? '9+' : activeReminders}
                    </span>
                  )}
                </div>
                {sidebarOpen && (
                  <span className={clsx('font-body text-sm font-medium whitespace-nowrap', isActive ? 'text-text-primary' : 'text-inherit')}>
                    {label}
                  </span>
                )}
                {/* Active indicator dot */}
                {sidebarOpen && isActive && (
                  <div className="absolute right-3 w-1 h-1 rounded-full bg-accent shadow-[0_0_10px_#E8192C]" />
                )}
                {/* Hover tooltip when collapsed */}
                {!sidebarOpen && (
                  <div className="absolute left-full ml-4 px-3 py-2 bg-bg-elevated border border-white/10 rounded-xl text-text-primary text-xs font-body whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-all z-50 shadow-2xl translate-x-1 group-hover:translate-x-0">
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
