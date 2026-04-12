import { useState, useEffect, useCallback } from 'react'
import {
  addDocument, updateDocument, deleteDocument, subscribeToCollection,
} from '../firebase/firestore'

// ── Generic collection hook ───────────────────────────────────────────────────
export function useCollection(collectionName, enabled = true) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!enabled || !collectionName) {
      setLoading(false)
      return
    }
    setLoading(true)
    const unsub = subscribeToCollection(collectionName, (docs) => {
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

// ── Reminders — split active vs all ──────────────────────────────────────────
export function useReminders() {
  const { data, loading, add, update, remove } = useCollection('reminders')
  const active = data.filter(r => r.status !== 'done')
  return { data: active, allData: data, loading, add, update, remove }
}

// ── My Expenses ───────────────────────────────────────────────────────────────
export function useMyExpenses() {
  const [months, setMonths] = useState([])
  const [currentMonth, setCurrentMonth] = useState(null)
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubMonths = subscribeToCollection('myExpenseMonths', (docs) => {
      const sorted = [...docs].sort((a, b) => (b.key || '').localeCompare(a.key || ''))
      setMonths(sorted)
      setCurrentMonth(sorted.find(d => d.status === 'open') || null)
    })
    const unsubEntries = subscribeToCollection('myExpenses', (docs) => {
      const sorted = [...docs].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      setEntries(sorted)
      setLoading(false)
    })
    return () => { unsubMonths(); unsubEntries() }
  }, [])

  return { months, currentMonth, entries, loading }
}

// ── Car Loan ──────────────────────────────────────────────────────────────────
export function useCarLoan() {
  const [setup, setSetup] = useState(null)
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubSetup = subscribeToCollection('carLoan', (docs) => {
      setSetup(docs[0] || null)
    })
    const unsubPayments = subscribeToCollection('carLoanPayments', (docs) => {
      const sorted = [...docs].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      setPayments(sorted)
      setLoading(false)
    })
    return () => { unsubSetup(); unsubPayments() }
  }, [])

  const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0)
  const outstanding = setup ? Math.max(0, (setup.totalAmount || 0) - totalPaid) : 0

  return { setup, payments, totalPaid, outstanding, loading }
}

// ── Office Setup ──────────────────────────────────────────────────────────────
export function useOfficeSetup() {
  const [projects, setProjects] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubProjects = subscribeToCollection('officeSetup', setProjects)
    const unsubTx = subscribeToCollection('officeSetupTransactions', (docs) => {
      const sorted = [...docs].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      setTransactions(sorted)
      setLoading(false)
    })
    return () => { unsubProjects(); unsubTx() }
  }, [])

  return { projects, transactions, loading }
}
