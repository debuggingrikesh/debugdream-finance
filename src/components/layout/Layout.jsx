import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

export default function Layout() {
  return (
    <div className="flex h-screen bg-bg-primary text-text-primary overflow-hidden font-body">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto">
          {/* Subtle grain texture */}
          <div className="fixed inset-0 pointer-events-none opacity-30 bg-grain z-0" />
          {/* pb-16 on mobile reserves space above the bottom nav; lg gets normal padding */}
          <div className="relative z-10 p-4 pb-20 md:p-5 lg:p-6 lg:pb-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
