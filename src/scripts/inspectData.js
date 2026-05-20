import { initializeApp } from 'firebase/app'
import { getFirestore, collection, getDocs } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyCybo0nN8e1YC2HTK0Ok07JjQzBR3bdq80",
  authDomain: "debugdream-finance.firebaseapp.com",
  projectId: "debugdream-finance",
  storageBucket: "debugdream-finance.firebasestorage.com",
  messagingSenderId: "909029009486",
  appId: "1:909029009486:web:82a4d58443ec83deb1bb1f",
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

async function inspect() {
  console.log("=== MONTHS ===")
  const monthsSnap = await getDocs(collection(db, 'myExpenseMonths'))
  const months = monthsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
  console.log("Total months:", months.length)
  console.table(months.map(m => ({
    id: m.id,
    key: m.key,
    monthLabel: m.monthLabel,
    status: m.status,
    total: m.total
  })))

  console.log("=== EXPENSES ===")
  const expensesSnap = await getDocs(collection(db, 'myExpenses'))
  const expenses = expensesSnap.docs.map(d => ({ id: d.id, ...d.data() }))
  console.log("Total expenses:", expenses.length)
  console.table(expenses.map(e => ({
    id: e.id,
    date: e.date,
    category: e.category,
    amount: e.amount,
    monthKey: e.monthKey,
    monthId: e.monthId,
  })))

  console.log("=== MAIN EXPENSES (REIMBURSEMENTS) ===")
  const mainExpensesSnap = await getDocs(collection(db, 'expenses'))
  const mainExpenses = mainExpensesSnap.docs.map(d => ({ id: d.id, ...d.data() }))
  const reimbursements = mainExpenses.filter(e => e.category && e.category.includes("Reimbursement"))
  console.log("Total reimbursements in main expenses:", reimbursements.length)
  console.table(reimbursements.map(e => ({
    id: e.id,
    date: e.date,
    category: e.category,
    amount: e.amount,
    myExpenseMonthId: e.myExpenseMonthId,
    notes: e.notes
  })))
}

inspect().catch(console.error)

