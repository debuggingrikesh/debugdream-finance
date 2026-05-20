import { initializeApp } from 'firebase/app'
import { getFirestore, collection, getDocs, addDoc, updateDoc, doc, writeBatch } from 'firebase/firestore'

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

async function migrate() {
  console.log("Starting reconciliation migration...")

  // 1. Fetch current months and expenses
  const monthsSnap = await getDocs(collection(db, 'myExpenseMonths'))
  const months = monthsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
  console.log(`Fetched ${months.length} months.`)

  const expensesSnap = await getDocs(collection(db, 'myExpenses'))
  const expenses = expensesSnap.docs.map(d => ({ id: d.id, ...d.data() }))
  console.log(`Fetched ${expenses.length} expenses.`)

  const mainExpensesSnap = await getDocs(collection(db, 'expenses'))
  const mainExpenses = mainExpensesSnap.docs.map(d => ({ id: d.id, ...d.data() }))
  const reimbursements = mainExpenses.filter(e => e.category && e.category.includes("Reimbursement"))
  console.log(`Fetched ${reimbursements.length} reimbursement records.`)

  // Find closed Baisakh month
  const closedBaisakh = months.find(m => m.key === '2083-01' && m.status === 'closed')
  if (!closedBaisakh) {
    console.error("Could not find closed Baisakh month.")
    return
  }
  console.log("Found closed Baisakh month ID:", closedBaisakh.id)

  // Chronologically, the 8 reimbursed entries are:
  const reimbursedEntryIds = new Set([
    '2R5HPshfSQTtEbRmTAmi', // 2026-03-27 (1100)
    'vqrkszkKgQnxKVMseyT2', // 2026-03-30 (1430)
    '5lCIkyWX6z79AnLk798y', // 2026-04-03 (895)
    'wisTvjAysxfBDCCDKVIc', // 2026-04-04 (8250)
    'UoJZLwWbDaO7H3v1DUAE', // 2026-04-05 (1115)
    '93i8rbh6iy7gx5jVNk25', // 2026-04-08 (1540)
    'LaMZhhfBkxDlJ0G0OIrr', // 2026-04-10 (2120)
    'VPzCggAE3GBF1uj8JazC'  // 2026-04-12 (2900)
  ])

  // The 4 unreimbursed entries are:
  const unreimbursedEntryIds = [
    '1JDtO4ZnkfogdW9YfJ78', // 2026-04-22 (940)
    'KKjA9vSb1rH6ySohDoHC', // 2026-05-05 (1465)
    'R7ho3W7hJccpktUlGAOB', // 2026-05-13 (1745)
    'jHIq9D6RDRIdJFsCZsnT'  // 2026-05-14 (1850)
  ]

  // Create a NEW open Baisakh month document
  const openBaisakhRef = await addDoc(collection(db, 'myExpenseMonths'), {
    key: '2083-01',
    bsYear: 2083,
    bsMonth: 1,
    monthLabel: 'Baisakh 2083',
    status: 'open',
    total: 0,
    createdAt: new Date(),
    updatedAt: new Date()
  })
  const openBaisakhId = openBaisakhRef.id
  console.log("Created new open Baisakh month document with ID:", openBaisakhId)

  // Use a batch write to update all entries and the closed month total
  const batch = writeBatch(db)

  // Update reimbursed entries to be strictly bound to closed Baisakh ID
  reimbursedEntryIds.forEach(id => {
    batch.update(doc(db, 'myExpenses', id), {
      monthId: closedBaisakh.id,
      monthKey: '2083-01'
    })
  })

  // Update unreimbursed entries to point to the new open Baisakh ID!
  unreimbursedEntryIds.forEach(id => {
    batch.update(doc(db, 'myExpenses', id), {
      monthId: openBaisakhId,
      monthKey: '2083-01'
    })
  })

  // Commit the batch
  await batch.commit()
  console.log("Batch update completed successfully! Unreimbursed entries have been moved to the active month.")
}

migrate().catch(console.error)
