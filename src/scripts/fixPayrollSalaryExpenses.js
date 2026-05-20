import { initializeApp } from 'firebase/app'
import { getFirestore, collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore'
import { BS_MONTHS } from '../utils/dateUtils.js'

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

const formatDate = (date = new Date()) => date.toISOString().split('T')[0]

async function main() {
  console.log('Starting payroll salary expense backfill...')

  const payrollRunsSnap = await getDocs(collection(db, 'payrollRuns'))
  const payrollRuns = payrollRunsSnap.docs.map(d => ({ id: d.id, ...d.data() }))

  let updated = 0
  let created = 0

  for (const run of payrollRuns) {
    const results = Array.isArray(run.results) ? run.results : []
    const totalPayrollNetPay = results.reduce((sum, r) => sum + (r?.netPay || 0), 0)
    if (!run.monthKey || totalPayrollNetPay <= 0) {
      continue
    }

    const [yearStr, monthStr] = run.monthKey.split('-')
    const bsYear = run.bsYear || Number(yearStr)
    const bsMonth = run.bsMonth || Number(monthStr)
    const bsMonthName = BS_MONTHS[(bsMonth || 1) - 1] || 'Unknown'
    const description = `Payroll Salaries - ${run.monthLabel || run.monthKey}`

    const expensesSnap = await getDocs(query(
      collection(db, 'expenses'),
      where('linkedRun', '==', run.monthKey)
    ))

    if (expensesSnap.empty) {
      await addDoc(collection(db, 'expenses'), {
        date:          formatDate(),
        category:      'Salary',
        description,
        amount:        totalPayrollNetPay,
        paymentSource: 'bank',
        type:          'expense',
        bsYear,
        bsMonth,
        bsDay: 1,
        bsMonthName,
        linkedRun:     run.monthKey,
        createdAt:     serverTimestamp(),
        updatedAt:     serverTimestamp(),
      })
      created += 1
      console.log(`Created missing expense for payroll run ${run.monthKey} (${totalPayrollNetPay})`)
    } else {
      for (const expenseDoc of expensesSnap.docs) {
        await updateDoc(doc(db, 'expenses', expenseDoc.id), {
          amount:        totalPayrollNetPay,
          description,
          bsYear,
          bsMonth,
          bsDay: 1,
          bsMonthName,
          linkedRun:     run.monthKey,
          updatedAt:     serverTimestamp(),
        })
      }
      updated += expensesSnap.docs.length
      console.log(`Updated ${expensesSnap.docs.length} expense(s) for payroll run ${run.monthKey}`)
    }
  }

  console.log(`Backfill complete. Updated: ${updated}, Created: ${created}`)
}

main().catch(err => {
  console.error('Payroll salary expense backfill failed:', err)
  process.exit(1)
})
