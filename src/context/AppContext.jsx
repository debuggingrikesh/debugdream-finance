import { createContext, useContext, useReducer, useEffect, useCallback } from 'react'
import { getSettings, saveSettings, subscribeToCollection } from '../firebase/firestore'
import { getTodayBoth, getCurrentFiscalYear } from '../utils/dateUtils'

const AppContext = createContext(null)

const initialState = {
  user: null,
  isLoading: false,
  settingsLoaded: false,
  isFirstRun: false,

  settings: {
    company: {
      name: 'debugdream',
      pan: '622445250',
      registration: '375208',
      address: 'Old Baneshwor, Kathmandu, Nepal',
      website: 'www.debugdream.com',
    },
    openingBank: 0,
    openingCash: 0,
    openingDate: null,
    logoBase64: null,
    expenseCategories: [
      'Rent', 'Operational', 'Misc', 'Car Loan EMI', 'Salary',
      'Internet', 'Travel', 'Utilities', 'Personal Reimbursement – Rikesh',
    ],
    myExpenseCategories: ['Food', 'Misc', 'Transport', 'Other'],
    inventoryCategories: ['Electronics', 'Furniture', 'Software', 'Stationery', 'Other'],
    rentReminderDay: 16,
    rentAmount: 30000,
    onboardingComplete: false,
  },

  today: getTodayBoth(),
  selectedMonth: null,
  currentFY: getCurrentFiscalYear(),

  // Live-calculated from all income/expense transactions
  bankBalance: 0,
  cashBalance: 0,

  // Loaded globally so TopBar bell count works
  reminders: [],

  sidebarOpen: true,
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.payload }, settingsLoaded: true }
    case 'SET_FIRST_RUN':
      return { ...state, isFirstRun: action.payload, settingsLoaded: true }
    case 'SET_SELECTED_MONTH':
      return { ...state, selectedMonth: action.payload }
    case 'SET_BALANCES':
      return { ...state, bankBalance: action.payload.bank, cashBalance: action.payload.cash }
    case 'SET_REMINDERS':
      return { ...state, reminders: action.payload }
    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarOpen: !state.sidebarOpen }
    default:
      return state
  }
}

export function AppProvider({ children, user }) {
  const [state, dispatch] = useReducer(reducer, { ...initialState, user })

  // ── Load settings ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    getSettings().then(s => {
      if (s) {
        dispatch({ type: 'SET_SETTINGS', payload: s })
        if (!s.onboardingComplete) dispatch({ type: 'SET_FIRST_RUN', payload: true })
      } else {
        dispatch({ type: 'SET_FIRST_RUN', payload: true })
      }
    }).catch(() => dispatch({ type: 'SET_FIRST_RUN', payload: true }))
  }, [user])

  // ── Set initial month context ──────────────────────────────────────────────
  useEffect(() => {
    const { bs } = getTodayBoth()
    dispatch({ type: 'SET_SELECTED_MONTH', payload: { year: bs.year, month: bs.month } })
  }, [])

  // ── Live reminders subscription (for bell count) ───────────────────────────
  useEffect(() => {
    if (!user) return
    const unsub = subscribeToCollection('reminders', docs =>
      dispatch({ type: 'SET_REMINDERS', payload: docs })
    )
    return unsub
  }, [user])

  // ── Live balance calculation from all transactions ─────────────────────────
  useEffect(() => {
    if (!user) return
    let incomeData = []
    let expenseData = []

    function recalc() {
      const ob = parseFloat(state.settings?.openingBank) || 0
      const oc = parseFloat(state.settings?.openingCash) || 0
      let bank = ob
      let cash = oc

      incomeData.forEach(tx => {
        if (tx.paymentSource === 'bank') bank += tx.amount || 0
        else if (tx.paymentSource === 'cash') cash += tx.amount || 0
      })

      expenseData.forEach(tx => {
        if (tx.type === 'cash_withdrawal') {
          bank -= tx.amount || 0
          cash += tx.amount || 0
        } else if (tx.paymentSource === 'bank') {
          bank -= tx.amount || 0
        } else if (tx.paymentSource === 'cash') {
          cash -= tx.amount || 0
        }
      })

      dispatch({ type: 'SET_BALANCES', payload: { bank, cash } })
    }

    const unsubI = subscribeToCollection('income', docs => { incomeData = docs; recalc() })
    const unsubE = subscribeToCollection('expenses', docs => { expenseData = docs; recalc() })

    return () => { unsubI(); unsubE() }
  }, [user, state.settings?.openingBank, state.settings?.openingCash])

  const updateSettings = useCallback(async (updates) => {
    dispatch({ type: 'SET_SETTINGS', payload: updates })
    await saveSettings(updates)
  }, [])

  const setSelectedMonth = useCallback((year, month) => {
    dispatch({ type: 'SET_SELECTED_MONTH', payload: { year, month } })
  }, [])

  const toggleSidebar = useCallback(() => dispatch({ type: 'TOGGLE_SIDEBAR' }), [])

  return (
    <AppContext.Provider value={{ ...state, dispatch, updateSettings, setSelectedMonth, toggleSidebar }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}

export default AppContext
