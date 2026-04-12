import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, getDoc, query, where, orderBy, limit,
  onSnapshot, serverTimestamp, writeBatch, setDoc
} from 'firebase/firestore'
import { db } from './config'

// ─── Collection Names ────────────────────────────────────────────────────────
export const COLLECTIONS = {
  SETTINGS: 'settings',
  INCOME: 'income',
  EXPENSES: 'expenses',
  MY_EXPENSES: 'myExpenses',
  MY_EXPENSE_MONTHS: 'myExpenseMonths',
  EMPLOYEES: 'employees',
  PAYROLL_RUNS: 'payrollRuns',
  INVOICES: 'invoices',
  CLIENTS: 'clients',
  OFFICE_SETUP: 'officeSetup',
  OFFICE_SETUP_TRANSACTIONS: 'officeSetupTransactions',
  SALARY_LEDGER: 'salaryLedger',
  INVENTORY: 'inventory',
  CAR_LOAN: 'carLoan',
  CAR_LOAN_PAYMENTS: 'carLoanPayments',
  REMINDERS: 'reminders',
  LOCKED_MONTHS: 'lockedMonths',
  AUDIT_LOG: 'auditLog',
}

// ─── Generic CRUD ─────────────────────────────────────────────────────────────
export const addDocument = async (collectionName, data) => {
  const ref = await addDoc(collection(db, collectionName), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export const updateDocument = async (collectionName, id, data) => {
  const ref = doc(db, collectionName, id)
  await updateDoc(ref, {
    ...data,
    updatedAt: serverTimestamp(),
  })
}

export const deleteDocument = async (collectionName, id) => {
  await deleteDoc(doc(db, collectionName, id))
}

export const getDocuments = async (collectionName, constraints = []) => {
  const q = constraints.length
    ? query(collection(db, collectionName), ...constraints)
    : collection(db, collectionName)
  const snapshot = await getDocs(q)
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
}

export const getDocument = async (collectionName, id) => {
  const snap = await getDoc(doc(db, collectionName, id))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

// ─── Settings ─────────────────────────────────────────────────────────────────
export const getSettings = async () => {
  const snap = await getDoc(doc(db, COLLECTIONS.SETTINGS, 'main'))
  return snap.exists() ? snap.data() : null
}

export const saveSettings = async (data) => {
  await setDoc(doc(db, COLLECTIONS.SETTINGS, 'main'), {
    ...data,
    updatedAt: serverTimestamp(),
  }, { merge: true })
}

// ─── Real-time subscriptions ──────────────────────────────────────────────────
export const subscribeToCollection = (collectionName, callback, constraints = []) => {
  const q = constraints.length
    ? query(collection(db, collectionName), ...constraints)
    : collection(db, collectionName)
  return onSnapshot(q, (snap) => {
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    callback(docs)
  })
}

export const subscribeToDocument = (collectionName, id, callback) => {
  return onSnapshot(doc(db, collectionName, id), (snap) => {
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null)
  })
}

// ─── Batch operations ─────────────────────────────────────────────────────────
export const batchWrite = async (operations) => {
  const batch = writeBatch(db)
  operations.forEach(({ type, collectionName, id, data }) => {
    const ref = id
      ? doc(db, collectionName, id)
      : doc(collection(db, collectionName))
    if (type === 'set') batch.set(ref, { ...data, updatedAt: serverTimestamp() })
    if (type === 'update') batch.update(ref, { ...data, updatedAt: serverTimestamp() })
    if (type === 'delete') batch.delete(ref)
  })
  await batch.commit()
}

// Firestore query helpers re-exported for convenience
export { where, orderBy, limit }
