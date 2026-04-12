import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import { useApp } from '../../context/AppContext'
import clsx from 'clsx'

export default function Layout() {
  const { sidebarOpen } = useApp()

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-white overflow-hidden font-body">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto">
          {/* Grain texture overlay */}
          <div className="fixed inset-0 pointer-events-none opacity-30 bg-grain z-0" />
          <div className="relative z-10 p-6 pb-20 lg:pb-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
