import { initializeApp } from 'firebase/app'
import { getFirestore, collection, getDocs, updateDoc, doc, writeBatch } from 'firebase/firestore'

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
  console.log("Starting Chaitra 2082 reconciliation...")

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

  // Find the closed month document with ID 'CUGLoXWexUsUTvrxdJog'
  const closedMonthDoc = months.find(m => m.id === 'CUGLoXWexUsUTvrxdJog')
  if (!closedMonthDoc) {
    console.error("Could not find closed month document CUGLoXWexUsUTvrxdJog.")
    return
  }

  // The 8 reimbursed entries (Chaitra 2082) pointing to 'CUGLoXWexUsUTvrxdJog':
  const reimbursedEntryIds = [
    '2R5HPshfSQTtEbRmTAmi',
    'vqrkszkKgQnxKVMseyT2',
    '5lCIkyWX6z79AnLk798y',
    'wisTvjAysxfBDCCDKVIc',
    'UoJZLwWbDaO7H3v1DUAE',
    '93i8rbh6iy7gx5jVNk25',
    'LaMZhhfBkxDlJ0G0OIrr',
    'VPzCggAE3GBF1uj8JazC'
  ]

  // Find the reimbursement expense document in 'expenses' pointing to 'CUGLoXWexUsUTvrxdJog'
  const reimbursementDoc = reimbursements.find(r => r.myExpenseMonthId === 'CUGLoXWexUsUTvrxdJog')

  const batch = writeBatch(db)

  // 1. Rename the closed month to 'Chaitra 2082' (key: '2082-12')
  batch.update(doc(db, 'myExpenseMonths', 'CUGLoXWexUsUTvrxdJog'), {
    key: '2082-12',
    bsYear: 2082,
    bsMonth: 12,
    monthLabel: 'Chaitra 2082',
    updatedAt: new Date()
  })
  console.log("Staged month document CUGLoXWexUsUTvrxdJog rename to Chaitra 2082.")

  // 2. Update the 8 reimbursed entries' keys to '2082-12'
  reimbursedEntryIds.forEach(id => {
    batch.update(doc(db, 'myExpenses', id), {
      monthKey: '2082-12',
      updatedAt: new Date()
    })
  })
  console.log(`Staged 8 entries key update to '2082-12'.`)

  // 3. Update the main expense reimbursement record notes and description to refer to Chaitra 2082
  if (reimbursementDoc) {
    batch.update(doc(db, 'expenses', reimbursementDoc.id), {
      description: 'Personal expense reimbursement — Chaitra 2082',
      notes: `Reimburses 8 entries from Chaitra 2082`,
      updatedAt: new Date()
    })
    console.log(`Staged main reimbursement expense update to Chaitra 2082.`)
  } else {
    console.warn("Could not find reimbursement doc to update in expenses.")
  }

  // Commit updates
  await batch.commit()
  console.log("Migration script committed successfully!")
}

migrate().catch(console.error)
