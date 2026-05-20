import { useState, useEffect, useCallback } from 'react'
import {
  addDocument, updateDocument, deleteDocument, subscribeToCollection,
} from '../firebase/firestore'
import { adToBS } from '../utils/dateUtils'

const collectionCache = {}

// ── Generic collection hook ───────────────────────────────────────────────────
export function useCollection(collectionName, enabled = true) {
  const [data, setData] = useState(() => {
    return collectionCache[collectionName] || []
  })
  const [loading, setLoading] = useState(() => {
    if (!enabled || !collectionName) return false
    return collectionCache[collectionName] ? false : true
  })
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!enabled || !collectionName) {
      setLoading(false)
      return
    }
    if (!collectionCache[collectionName]) {
      setLoading(true)
    }
    const unsub = subscribeToCollection(collectionName, (docs) => {
      collectionCache[collectionName] = docs
      setData(docs)
      setLoading(false)
    })
    return () => unsub()
  }, [collectionName, enabled])

  const add = useCallback(async (docData) => {
    try {
      return await addDocument(collectionName, docData)
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [collectionName])

  const update = useCallback(async (id, docData) => {
    try {
      await updateDocument(collectionName, id, docData)
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [collectionName])

  const remove = useCallback(async (id) => {
    try {
      await deleteDocument(collectionName, id)
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [collectionName])

  return { data, loading, error, add, update, remove }
}

// ── Specific collection hooks ─────────────────────────────────────────────────

export function useAllIncome() {
  return useCollection('income')
}

export function useAllExpenses() {
  return useCollection('expenses')
}

export function useEmployees() {
  return useCollection('employees')
}

export function useInvoices() {
  return useCollection('invoices')
}

export function usePayrollRuns() {
  return useCollection('payrollRuns')
}

export function useSalaryLedger() {
  return useCollection('salaryLedger')
}

export function useInventory() {
  return useCollection('inventory')
}

export function useClients() {
  return useCollection('clients')
}

export function useTDS() {
  return useCollection('tdsLedger')
}

// ── Reminders — split active vs all ──────────────────────────────────────────
export function useReminders() {
  const { data, loading, add, update, remove } = useCollection('reminders')
  const active = data.filter(r => r.status !== 'done')
  return { data: active, allData: data, loading, add, update, remove }
}

// ── My Expenses ───────────────────────────────────────────────────────────────
export function useMyExpenses() {
  const [months, setMonths] = useState(() => {
    return collectionCache['myExpenseMonths'] || []
  })
  const [currentMonth, setCurrentMonth] = useState(() => {
    const sorted = collectionCache['myExpenseMonths'] || []
    const today = new Date()
    const bs = adToBS(today)
    if (!bs) return null

    const nowKey = `${bs.year}-${String(bs.month).padStart(2, '0')}`
    return sorted.find(d => d.key === nowKey && d.status === 'open') || null
  })
  const [entries, setEntries] = useState(() => {
    return collectionCache['myExpenses'] || []
  })
  const [loading, setLoading] = useState(() => {
    return collectionCache['myExpenses'] && collectionCache['myExpenseMonths'] ? false : true
  })

  useEffect(() => {
    const unsubMonths = subscribeToCollection('myExpenseMonths', (docs) => {
      const sorted = [...docs].sort((a, b) => {
        const keyCmp = (b.key || '').localeCompare(a.key || '')
        if (keyCmp !== 0) return keyCmp
        return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
      })

      const today = new Date()
      const bs = adToBS(today)
      if (!bs) return // Defensive

      const nowKey = `${bs.year}-${String(bs.month).padStart(2, '0')}`
      
      collectionCache['myExpenseMonths'] = sorted
      setMonths(sorted)
      // The currentMonth MUST be the one matching TODAY'S calendar month
      // This is the primary bucket we are currently spending in.
      const calMonth = sorted.find(d => d.key === nowKey && d.status === 'open')
      setCurrentMonth(calMonth || null)
    })
    
    const unsubEntries = subscribeToCollection('myExpenses', (docs) => {
      const sorted = [...docs].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      collectionCache['myExpenses'] = sorted
      setEntries(sorted)
      setLoading(false)
    })
    return () => { unsubMonths(); unsubEntries() }
  }, [])

  return { months, currentMonth, entries, loading }
}

// ── Car Loan ──────────────────────────────────────────────────────────────────
export function useCarLoan() {
  const [setup, setSetup] = useState(() => {
    return collectionCache['carLoan']?.[0] || null
  })
  const [payments, setPayments] = useState(() => {
    return collectionCache['carLoanPayments'] || []
  })
  const [loading, setLoading] = useState(() => {
    return collectionCache['carLoanPayments'] && collectionCache['carLoan'] ? false : true
  })

  useEffect(() => {
    const unsubSetup = subscribeToCollection('carLoan', (docs) => {
      collectionCache['carLoan'] = docs
      setSetup(docs[0] || null)
    })
    const unsubPayments = subscribeToCollection('carLoanPayments', (docs) => {
      const sorted = [...docs].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      collectionCache['carLoanPayments'] = sorted
      setPayments(sorted)
      setLoading(false)
    })
    return () => { unsubSetup(); unsubPayments() }
  }, [])

  const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0)
  const outstanding = setup ? Math.max(0, (setup.totalAmount || 0) - totalPaid) : 0

  return { setup, payments, totalPaid, outstanding, loading }
}
