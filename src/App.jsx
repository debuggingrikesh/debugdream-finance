import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { auth, googleProvider } from './firebase/config'
import { AppProvider, useApp } from './context/AppContext'
import { Loader2 } from 'lucide-react'

import Layout from './components/layout/Layout'
import Dashboard from './modules/dashboard/Dashboard'
import Income from './modules/income/Income'
import Expenses from './modules/expenses/Expenses'
import MyExpenses from './modules/myexpenses/MyExpenses'
import Payroll from './modules/payroll/Payroll'
import Invoices from './modules/invoices/Invoices'
import OfficeSetup from './modules/officesetup/OfficeSetup'
import SalaryLedger from './modules/salaryledger/SalaryLedger'
import Inventory from './modules/inventory/Inventory'
import CarLoan from './modules/carloan/CarLoan'
import Reminders from './modules/reminders/Reminders'
import Settings from './modules/settings/Settings'
import AuthScreen from './modules/auth/AuthScreen'
import Onboarding from './modules/onboarding/Onboarding'

const ALLOWED_EMAIL = import.meta.env.VITE_ALLOWED_EMAIL || 'rikesh@debugdream.com'

// ── Splash shown while Firebase auth initialises ──────────────────────────────
function Splash() {
  return (
    <div className="h-screen flex items-center justify-center bg-[#0a0a0a]">
      <div className="flex flex-col items-center gap-5">
        <div className="w-12 h-12 rounded-2xl bg-[#111] border border-[#2a2a2a] flex items-center justify-center shadow-[0_0_30px_rgba(232,25,44,0.15)]">
          <span className="font-display font-black text-[#E8192C] text-xl">D</span>
        </div>
        <Loader2 size={18} className="animate-spin text-[#333]" />
      </div>
    </div>
  )
}

// ── Inner router — has access to AppContext ────────────────────────────────────
function AppRoutes({ onSignOut }) {
  const { settingsLoaded, settings } = useApp()

  // Wait until Firestore settings have been read
  if (!settingsLoaded) return <Splash />

  const needsOnboarding = !settings?.onboardingComplete

  return (
    <Routes>
      {/* Onboarding lives outside the main shell */}
      <Route path="/onboarding" element={<Onboarding />} />

      {/* Main app shell — redirect if first run */}
      <Route
        path="/"
        element={needsOnboarding ? <Navigate to="/onboarding" replace /> : <Layout />}
      >
        <Route index element={<Dashboard />} />
        <Route path="income" element={<Income />} />
        <Route path="expenses" element={<Expenses />} />
        <Route path="my-expenses" element={<MyExpenses />} />
        <Route path="payroll" element={<Payroll />} />
        <Route path="invoices" element={<Invoices />} />
        <Route path="office-setup" element={<OfficeSetup />} />
        <Route path="salary-ledger" element={<SalaryLedger />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="car-loan" element={<CarLoan />} />
        <Route path="reminders" element={<Reminders />} />
        <Route path="settings" element={<Settings onSignOut={onSignOut} />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

// ── Root component — manages Firebase auth state ───────────────────────────────
export default function App() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authError, setAuthError] = useState(null)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        if (ALLOWED_EMAIL && u.email !== ALLOWED_EMAIL) {
          signOut(auth)
          setAuthError(`Access restricted. Only ${ALLOWED_EMAIL} is authorised.`)
          setUser(null)
        } else {
          setUser(u)
          setAuthError(null)
        }
      } else {
        setUser(null)
      }
      setAuthLoading(false)
    })
    return () => unsub()
  }, [])

  const handleSignIn = async () => {
    setAuthError(null)
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') setAuthError(err.message)
    }
  }

  const handleSignOut = () => signOut(auth)

  if (authLoading) return <Splash />
  if (!user) return <AuthScreen onSignIn={handleSignIn} error={authError} />

  return (
    <AppProvider user={user}>
      <BrowserRouter>
        <AppRoutes onSignOut={handleSignOut} />
      </BrowserRouter>
    </AppProvider>
  )
}
