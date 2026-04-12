import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, TrendingUp, Receipt, User, Users,
  FileText, Building2, BookOpen, Package, Car,
  Bell, Settings, ChevronLeft, ChevronRight, X
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import clsx from 'clsx'

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/income', icon: TrendingUp, label: 'Income' },
  { to: '/expenses', icon: Receipt, label: 'Expenses' },
  { to: '/my-expenses', icon: User, label: 'My Expenses' },
  { to: '/payroll', icon: Users, label: 'Payroll' },
  { to: '/invoices', icon: FileText, label: 'Invoices' },
  { to: '/office-setup', icon: Building2, label: 'Office Setup' },
  { to: '/salary-ledger', icon: BookOpen, label: 'Salary Ledger' },
  { to: '/inventory', icon: Package, label: 'Inventory' },
  { to: '/car-loan', icon: Car, label: 'Car Loan' },
  { to: '/reminders', icon: Bell, label: 'Reminders' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export default function Sidebar() {
  const { sidebarOpen, toggleSidebar, reminders } = useApp()
  const location = useLocation()
  const activeReminders = reminders?.filter(r => r.status === 'active')?.length || 0

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <aside className={clsx(
        'fixed left-0 top-0 h-screen z-40 flex flex-col',
        'bg-[#0a0a0a] border-r border-[#1a1a1a]',
        'transition-all duration-300 ease-in-out',
        sidebarOpen ? 'w-56' : 'w-[60px]',
        'lg:relative lg:z-auto'
      )}>
        {/* Logo area */}
        <div className={clsx(
          'flex items-center h-16 px-4 border-b border-[#1a1a1a] shrink-0',
          sidebarOpen ? 'justify-between' : 'justify-center'
        )}>
          {sidebarOpen && (
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded bg-[#E8192C] flex items-center justify-center shrink-0">
                <span className="text-white font-display font-black text-xs">D</span>
              </div>
              <div>
                <div className="font-display font-bold text-white text-sm leading-none">debug</div>
                <div className="font-display font-bold text-[#E8192C] text-sm leading-none">dream</div>
              </div>
            </div>
          )}

          <button
            onClick={toggleSidebar}
            className="w-7 h-7 rounded-lg bg-[#1a1a1a] hover:bg-[#222] flex items-center justify-center text-[#555] hover:text-white transition-colors shrink-0"
          >
            {sidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => {
            const isActive = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)
            const isReminders = to === '/reminders'

            return (
              <NavLink
                key={to}
                to={to}
                className={clsx(
                  'flex items-center gap-3 rounded-lg px-2.5 py-2 transition-all duration-150 group relative',
                  isActive
                    ? 'bg-[#E8192C]/10 text-[#E8192C]'
                    : 'text-[#555] hover:text-white hover:bg-[#1a1a1a]',
                  !sidebarOpen && 'justify-center'
                )}
              >
                <div className="relative shrink-0">
                  <Icon size={17} />
                  {isReminders && activeReminders > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-[#E8192C] rounded-full text-white text-[9px] flex items-center justify-center font-bold">
                      {activeReminders > 9 ? '9+' : activeReminders}
                    </span>
                  )}
                </div>
                {sidebarOpen && (
                  <span className="font-body text-sm font-medium whitespace-nowrap">{label}</span>
                )}
                {/* Tooltip for collapsed */}
                {!sidebarOpen && (
                  <div className="absolute left-full ml-2 px-2.5 py-1.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white text-xs font-body whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-xl">
                    {label}
                  </div>
                )}
              </NavLink>
            )
          })}
        </nav>

        {/* Bottom - version */}
        {sidebarOpen && (
          <div className="p-4 border-t border-[#1a1a1a] shrink-0">
            <div className="text-[10px] text-[#2a2a2a] font-mono">v1.0.0 · debugdream</div>
          </div>
        )}
      </aside>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 h-16 bg-[#0a0a0a] border-t border-[#1a1a1a] z-40 flex lg:hidden">
        {NAV_ITEMS.slice(0, 5).map(({ to, icon: Icon, label }) => {
          const isActive = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)
          return (
            <NavLink
              key={to}
              to={to}
              className={clsx(
                'flex-1 flex flex-col items-center justify-center gap-1 transition-colors',
                isActive ? 'text-[#E8192C]' : 'text-[#333]'
              )}
            >
              <Icon size={20} />
              <span className="text-[9px] font-body">{label.split(' ')[0]}</span>
            </NavLink>
          )
        })}
      </nav>
    </>
  )
}
