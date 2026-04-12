/**
 * Nepal Payroll Calculation Engine
 * Implements Nepal Income Tax, SSF rules as per IRD guidelines
 */

// ─── Constants ────────────────────────────────────────────────────────────────
export const SSF_EMPLOYEE_RATE = 0.11    // 11%
export const SSF_EMPLOYER_RATE = 0.20    // 20%
export const SSF_BASIC_CEILING = 50000   // NPR 50,000 max basic for SSF calc

// TDS thresholds (annual)
export const TDS_THRESHOLD_INDIVIDUAL = 500000   // NPR 5,00,000
export const TDS_THRESHOLD_MARRIED = 600000      // NPR 6,00,000
export const FEMALE_REBATE = 0.10                // 10%

// Tax slabs (annual taxable income above threshold)
export const TAX_SLABS = [
  { limit: 200000, rate: 0.10 },  // Next 2L → 10%
  { limit: 300000, rate: 0.20 },  // Next 3L → 20%
  { limit: 1400000, rate: 0.30 }, // Next 14L → 30%
  { limit: Infinity, rate: 0.36 },// Above 20L → 36%
]

/**
 * Calculate annual TDS given annual taxable income
 * @param {number} annualTaxable - Annual taxable income
 * @param {boolean} isMarried
 * @param {boolean} isFemale
 * @param {boolean} isSSFEnrolled - If true, 1% slab is waived
 * @returns {number} Annual TDS amount
 */
export function calculateAnnualTDS(annualTaxable, isMarried = false, isFemale = false, isSSFEnrolled = true) {
  const threshold = isMarried ? TDS_THRESHOLD_MARRIED : TDS_THRESHOLD_INDIVIDUAL
  
  if (annualTaxable <= threshold) {
    // Below threshold: 1% social security tax (waived if SSF enrolled)
    if (isSSFEnrolled) return 0
    return annualTaxable * 0.01
  }

  let tax = 0
  let remaining = annualTaxable - threshold

  // Below threshold portion: 1% (waived if SSF enrolled)
  if (!isSSFEnrolled) {
    tax += threshold * 0.01
  }

  // Apply slabs on the amount above threshold
  for (const slab of TAX_SLABS) {
    if (remaining <= 0) break
    const taxable = Math.min(remaining, slab.limit === Infinity ? remaining : slab.limit)
    tax += taxable * slab.rate
    remaining -= taxable
  }

  // Female rebate
  if (isFemale) {
    tax = tax * (1 - FEMALE_REBATE)
  }

  return Math.round(tax)
}

/**
 * Calculate monthly payroll for a full-time employee
 * @param {Object} employee
 * @returns {Object} Full breakdown
 */
export function calculateFullTimePayroll(employee) {
  const { ctc, isMarried = false, gender = 'male', allowances = [] } = employee
  const isFemale = gender === 'female'

  // Basic salary
  const basic = Math.round(ctc / 1.20)

  // SSF (capped at 50K basic)
  const ssfBasic = Math.min(basic, SSF_BASIC_CEILING)
  const employerSSF = Math.round(ssfBasic * SSF_EMPLOYER_RATE)
  const employeeSSF = Math.round(ssfBasic * SSF_EMPLOYEE_RATE)

  // Verify: basic + employerSSF ≈ CTC
  // basic * 1.20 = CTC → basic + basic*0.20 = CTC ✓

  // Allowances total
  const allowanceTotal = allowances.reduce((sum, a) => sum + (a.amount || 0), 0)

  // Gross pay
  const grossPay = basic + allowanceTotal

  // Annual taxable (excluding employee SSF)
  const annualTaxable = (grossPay - employeeSSF) * 12

  // Annual TDS
  const annualTDS = calculateAnnualTDS(annualTaxable, isMarried, isFemale, true)
  const monthlyTDS = Math.round(annualTDS / 12)

  // Net take-home
  const netPay = grossPay - employeeSSF - monthlyTDS

  return {
    basic,
    allowanceTotal,
    allowances,
    grossPay,
    employeeSSF,
    employerSSF,
    annualTaxable,
    annualTDS,
    monthlyTDS,
    netPay,
    totalCTC: basic + employerSSF, // should equal ctc
    isSSFEnrolled: true,
  }
}

/**
 * Calculate payroll for trainee/intern (flat pay, no SSF, no TDS)
 */
export function calculateInternPayroll(employee) {
  const { flatPay } = employee
  return {
    basic: flatPay,
    grossPay: flatPay,
    employeeSSF: 0,
    employerSSF: 0,
    monthlyTDS: 0,
    netPay: flatPay,
    totalCTC: flatPay,
    isSSFEnrolled: false,
    annualTaxable: 0,
    annualTDS: 0,
  }
}

/**
 * Calculate Rikesh's salary (special rules)
 * - SSF calculated normally
 * - TDS NOT monthly — only on actual withdrawals
 * - Car loan EMI deducted from ledger
 */
export function calculateRikeshPayroll(employee, carLoanEMI = 62372) {
  const base = calculateFullTimePayroll(employee)
  return {
    ...base,
    monthlyTDS: 0, // Not calculated monthly
    netAccrued: base.grossPay - base.employeeSSF, // Without TDS
    carLoanEMI,
    netAfterEMI: base.grossPay - base.employeeSSF - carLoanEMI,
    isSpecial: true,
  }
}

/**
 * Calculate TDS on a specific payment amount (for Rikesh withdrawals)
 */
export function calculateTDSOnPayment(amount, isMarried = false) {
  // Treat this payment as taxable income, calculate applicable TDS
  const annualized = amount * 12
  const annual = calculateAnnualTDS(annualized, isMarried, false, true)
  return Math.round(annual / 12)
}

/**
 * Run full payroll for all employees
 */
export function runPayroll(employees) {
  return employees.map(emp => {
    if (!emp.active) return null
    
    let calc
    if (emp.type === 'fulltime' && emp.id === 'rikesh') {
      calc = calculateRikeshPayroll(emp)
    } else if (emp.type === 'fulltime') {
      calc = calculateFullTimePayroll(emp)
    } else {
      calc = calculateInternPayroll(emp)
    }

    return {
      employeeId: emp.id,
      employeeName: emp.name,
      type: emp.type,
      ...calc,
    }
  }).filter(Boolean)
}

/**
 * Calculate SSF and TDS deposit amounts for a payroll run
 */
export function getPayrollDeposits(payrollResults) {
  let totalEmployeeSSF = 0
  let totalEmployerSSF = 0
  let totalTDS = 0

  payrollResults.forEach(r => {
    totalEmployeeSSF += r.employeeSSF || 0
    totalEmployerSSF += r.employerSSF || 0
    totalTDS += r.monthlyTDS || 0
  })

  return {
    totalSSF: totalEmployeeSSF + totalEmployerSSF,
    totalEmployeeSSF,
    totalEmployerSSF,
    totalTDS,
  }
}

// Default employees (pre-populated)
export const DEFAULT_EMPLOYEES = [
  {
    id: 'pranesh',
    name: 'Pranesh',
    type: 'fulltime',
    ctc: 80000,
    gender: 'male',
    isMarried: false,
    allowances: [],
    active: true,
    startDate: '2024-01-01',
  },
  {
    id: 'samana',
    name: 'Samana',
    type: 'fulltime',
    ctc: 22000,
    gender: 'female',
    isMarried: false,
    allowances: [],
    active: true,
    startDate: '2024-01-01',
  },
  {
    id: 'sapana',
    name: 'Sapana',
    type: 'intern',
    flatPay: 5000,
    gender: 'female',
    isMarried: false,
    allowances: [],
    active: true,
    startDate: '2024-01-01',
  },
  {
    id: 'rikesh',
    name: 'Rikesh',
    type: 'fulltime',
    ctc: 41000,
    gender: 'male',
    isMarried: false,
    allowances: [],
    active: true,
    startDate: '2024-01-01',
    isOwner: true,
  },
]
