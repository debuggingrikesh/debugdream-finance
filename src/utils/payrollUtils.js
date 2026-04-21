/**
 * Nepal Payroll Calculation Engine
 * Implements Nepal Income Tax, SSF rules as per IRD guidelines
 */

// ─── Constants (FY 2080/81) ──────────────────────────────────────────────────
export const SSF_EMPLOYEE_RATE = 0.11    // 11%
export const SSF_EMPLOYER_RATE = 0.20    // 20% (includes Gratuity, Accident, Medical)

// TDS thresholds (Annual)
export const TDS_THRESHOLD_SINGLE  = 500000   // NPR 5,00,000
export const TDS_THRESHOLD_MARRIED = 600000   // NPR 6,00,000

// Deduction Caps (Annual)
export const MAX_RETIREMENT_DEDUCTION = 500000 // SSF + CIT combined cap
export const MAX_LIFE_INS_DEDUCTION   = 40000  // NPR 40,000
export const MAX_HEALTH_INS_DEDUCTION = 20000  // NPR 20,000



// Remote Area Deductions (Annual)
export const REMOTE_AREA_ALLOWANCE = {
  'A': 50000,
  'B': 40000,
  'C': 30000,
  'D': 20000,
  'E': 10000,
  'none': 0
}

/**
 * Calculate annual TDS based on precise Nepal Tax Slabs (2080/81)
 */
export function calculateAnnualTax(taxableIncome, isMarried = false, isSSFEnrolled = false) {
  if (taxableIncome <= 0) return 0

  const threshold = isMarried ? TDS_THRESHOLD_MARRIED : TDS_THRESHOLD_SINGLE
  
  let tax = 0

  // 1% Social Security Tax (Slab 1)
  // Only applies to first slab for non-SSF contributors
  const slab1Amount = Math.min(taxableIncome, threshold)
  if (!isSSFEnrolled) {
    tax += slab1Amount * 0.01
  }

  // 10% Slab (Up to 700k/800k)
  const slab2End = threshold + 200000
  if (taxableIncome > threshold) {
    const slab2Amount = Math.min(taxableIncome, slab2End) - threshold
    tax += slab2Amount * 0.10
  }

  // 20% Slab (Up to 1.0M/1.1M)
  const slab3End = slab2End + 300000
  if (taxableIncome > slab2End) {
    const slab3Amount = Math.min(taxableIncome, slab3End) - slab2End
    tax += slab3Amount * 0.20
  }

  // 30% Slab (Fixed checkpoint at 2,000,000 total income)
  const slab4End = 2000000
  if (taxableIncome > slab3End) {
    const slab4Amount = Math.min(taxableIncome, slab4End) - slab3End
    tax += slab4Amount * 0.30
  }

  // 36% Slab (Fixed checkpoint at 5,000,000 total income)
  const slab5End = 5000000
  if (taxableIncome > slab4End) {
    const slab5Amount = Math.min(taxableIncome, slab5End) - slab4End
    tax += slab5Amount * 0.36
  }

  // 39% Slab (Above 5,000,000)
  if (taxableIncome > slab5End) {
    const slab6Amount = taxableIncome - slab5End
    tax += slab6Amount * 0.39
  }



  return Math.round(tax)
}

/**
 * Calculate full breakdown for an employee using Cumulative Step-up Method
 */
export function calculateFullTimePayroll(employee, ytdData = {}) {
  const { 
    ctc, 
    isMarried = false, 
    gender = 'male', 
    allowances = [],
    citMonthly = 0,
    lifeInsAnnual = 0,
    healthInsAnnual = 0,
    isSSFEnrolled = false,
    remoteCategory = 'none',
  } = employee

  const {
    ytdTaxableIncome = 0,
    ytdTaxPaid = 0
  } = ytdData


  const monthlyAllowance = (allowances || []).reduce((s, a) => s + (parseFloat(a.amount) || 0), 0)

  // 1. Derive Monthly Earnings
  const divisor = isSSFEnrolled ? 1.2 : 1.0
  const basic = Math.round((ctc - monthlyAllowance) / divisor)
  const grossPayMonthly = basic + monthlyAllowance
  
  // 2. SSF Contributions
  const employeeSSFMonthly = isSSFEnrolled ? Math.round(basic * SSF_EMPLOYEE_RATE) : 0
  const employerSSFMonthly = isSSFEnrolled ? Math.round(basic * SSF_EMPLOYER_RATE) : 0

  // 3. Monthly Deductions
  const citContribution = parseFloat(citMonthly) || 0
  const deductibleRetirementMonthly = Math.min(employeeSSFMonthly + citContribution, (grossPayMonthly / 3))

  // 4. Remote Area & Insurance (Pro-rated monthly if needed, or fully deducted)
  // IRD allows these annual deductions. In cumulative method, we apply them against the annual taxable base.
  const remoteAllowanceAnnual = REMOTE_AREA_ALLOWANCE[remoteCategory] || 0
  const deductibleLifeAnnual   = Math.min(parseFloat(lifeInsAnnual) || 0, MAX_LIFE_INS_DEDUCTION)
  const deductibleHealthAnnual = Math.min(parseFloat(healthInsAnnual) || 0, MAX_HEALTH_INS_DEDUCTION)

  // 5. Calculate This Month's Taxable Income
  const currentTaxableIncome = Math.max(0, grossPayMonthly - deductibleRetirementMonthly)

  // 6. Cumulative Step-up Calculation
  const totalTaxableIncomeYTD = ytdTaxableIncome + currentTaxableIncome
  
  // Target total tax liability for income earned so far
  // We apply annual slabs directly to the YTD income. 
  // (e.g. if YTD is 400k, tax is 1% of 400k. If YTD is 600k, tax is (5k + 10k)).
  let targetAnnualTax = calculateAnnualTax(totalTaxableIncomeYTD, isMarried, isSSFEnrolled)
  
  // Medical Tax Credit (Applied against the target tax)
  const medicalTaxCredit = Math.min(0.15 * (parseFloat(healthInsAnnual) || 0), 750)
  const targetNetTax = Math.max(0, targetAnnualTax - medicalTaxCredit)

  // TDS this month = What we should have paid so far - What we actually paid
  const cumulativeTDSMatched = targetNetTax
  const monthlyTDS = Math.max(0, Math.round(cumulativeTDSMatched - ytdTaxPaid))

  // 7. Net Take-Home
  const netPayMonthly = grossPayMonthly - employeeSSFMonthly - citContribution - monthlyTDS

  return {
    basic,
    monthlyAllowance,
    grossPayMonthly,
    employeeSSFMonthly,
    employerSSFMonthly,
    citMonthly: citContribution,
    lifeInsAnnual: parseFloat(lifeInsAnnual) || 0,
    healthInsAnnual: parseFloat(healthInsAnnual) || 0,
    remoteCategory,
    remoteAllowanceAnnual,
    medicalTaxCredit,
    currentTaxableIncome,
    totalTaxableIncomeYTD,
    ytdTaxPaid,
    targetNetTax,
    annualTDS: targetNetTax, // For UI label consistency
    monthlyTDS,
    netPayMonthly,
    totalCTC: grossPayMonthly + employerSSFMonthly,
    isSSFEnrolled,
    // Compatibility fields
    grossPay: grossPayMonthly,
    netPay: netPayMonthly,
    employeeSSF: employeeSSFMonthly,
    employerSSF: employerSSFMonthly,
  }
}

/**
 * Utility to identify Fiscal Year months for Nepal (Starts Shrawan/04)
 * Returns array of monthKeys that precede currentMonthKey in the same FY
 */
export function getFiscalYearPreviousMonths(currentMonthKey) {
  const [year, month] = currentMonthKey.split('-').map(Number)
  const previousMonths = []
  
  // FY starts in month 04. 
  // If current month is 04, prev is empty.
  // If current month is 08, prev are 04, 05, 06, 07.
  // If current month is 02 (next AD year), prev are 04..12 of prev year + 01.
  
  let checkYear = month >= 4 ? year : year - 1
  let checkMonth = 4
  
  while (true) {
    const key = `${checkYear}-${checkMonth.toString().padStart(2, '0')}`
    if (key === currentMonthKey) break
    
    previousMonths.push(key)
    
    checkMonth++
    if (checkMonth > 12) {
      checkMonth = 1
      checkYear++
    }
  }
  
  return previousMonths
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
    monthlyTDS: base.monthlyTDS, // Calculate monthly TDS normally
    netAccrued: base.grossPayMonthly - base.employeeSSFMonthly - base.monthlyTDS,
    carLoanEMI,
    netAfterEMI: base.grossPayMonthly - base.employeeSSFMonthly - base.monthlyTDS - carLoanEMI,
    isSpecial: true,
  }
}

/**
 * Calculate TDS on a specific payment amount (for Rikesh withdrawals)
 */
export function calculateTDSOnPayment(amount, isMarried = false) {
  // Treat this payment as taxable income, calculate applicable TDS
  const annualized = amount * 12
  const annual = calculateAnnualTax(annualized, isMarried, false, true)
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
