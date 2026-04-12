/**
 * Nepali (Bikram Sambat) Date Converter
 * Covers years 2000–2090 BS
 */

const BS_MONTH_DATA = [
  // [days in each month for that BS year] — 12 values per year
  // Months: Baisakh, Jestha, Ashadh, Shrawan, Bhadra, Ashwin, Kartik, Mangsir, Poush, Magh, Falgun, Chaitra
  [2000, [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31]],
  [2001, [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30]],
  [2002, [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30]],
  [2003, [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31]],
  [2004, [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31]],
  [2005, [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30]],
  [2006, [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30]],
  [2007, [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31]],
  [2008, [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 29, 31]],
  [2009, [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30]],
  [2010, [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30]],
  [2011, [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31]],
  [2012, [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30]],
  [2013, [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30]],
  [2014, [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30]],
  [2015, [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31]],
  [2016, [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30]],
  [2017, [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30]],
  [2018, [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30]],
  [2019, [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31]],
  [2020, [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30]],
  [2021, [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30]],
  [2022, [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30]],
  [2023, [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31]],
  [2024, [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30]],
  [2025, [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30]],
  [2026, [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31]],
  [2027, [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31]],
  [2028, [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30]],
  [2029, [31, 31, 32, 31, 32, 30, 30, 29, 30, 29, 30, 30]],
  [2030, [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31]],
  [2031, [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 29, 31]],
  [2032, [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30]],
  [2033, [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30]],
  [2034, [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31]],
  [2035, [30, 32, 31, 32, 31, 31, 29, 30, 30, 29, 29, 31]],
  [2036, [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30]],
  [2037, [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30]],
  [2038, [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31]],
  [2039, [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30]],
  [2040, [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30]],
  [2041, [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30]],
  [2042, [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31]],
  [2043, [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30]],
  [2044, [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30]],
  [2045, [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30]],
  [2046, [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31]],
  [2047, [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30]],
  [2048, [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30]],
  [2049, [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30]],
  [2050, [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31]],
  [2051, [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30]],
  [2052, [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30]],
  [2053, [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30]],
  [2054, [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31]],
  [2055, [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30]],
  [2056, [31, 31, 32, 31, 32, 30, 30, 29, 30, 29, 30, 30]],
  [2057, [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31]],
  [2058, [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31]],
  [2059, [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30]],
  [2060, [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30]],
  [2061, [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31]],
  [2062, [30, 32, 31, 32, 31, 31, 29, 30, 29, 30, 29, 31]],
  [2063, [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30]],
  [2064, [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30]],
  [2065, [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31]],
  [2066, [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 29, 31]],
  [2067, [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30]],
  [2068, [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30]],
  [2069, [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31]],
  [2070, [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30]],
  [2071, [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30]],
  [2072, [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30]],
  [2073, [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31]],
  [2074, [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30]],
  [2075, [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30]],
  [2076, [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30]],
  [2077, [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31]],
  [2078, [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30]],
  [2079, [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30]],
  [2080, [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30]],
  [2081, [31, 31, 32, 32, 31, 30, 30, 30, 29, 30, 30, 30]],
  [2082, [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30]],
  [2083, [31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 30, 30]],
  [2084, [31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 30, 30]],
  [2085, [31, 32, 31, 32, 30, 31, 30, 30, 29, 30, 30, 30]],
  [2086, [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30]],
  [2087, [31, 31, 32, 31, 31, 31, 30, 30, 29, 30, 30, 30]],
  [2088, [30, 31, 32, 32, 30, 31, 30, 30, 29, 30, 30, 30]],
  [2089, [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30]],
  [2090, [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30]],
]

const BS_MONTHS = [
  'Baisakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin',
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'
]

const BS_MONTHS_NP = [
  'बैशाख', 'जेठ', 'असार', 'श्रावण', 'भाद्र', 'आश्विन',
  'कार्तिक', 'मंसिर', 'पौष', 'माघ', 'फाल्गुन', 'चैत्र'
]

const AD_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

// BS reference point: 2000/1/1 BS = April 13, 1943 AD
const BS_REF = { year: 2000, month: 1, day: 1 }
const AD_REF = new Date(1943, 3, 14) // April 14, 1943 (months are 0-indexed)

function getBSData(year) {
  const found = BS_MONTH_DATA.find(d => d[0] === year)
  return found ? found[1] : null
}

/**
 * Convert AD (Gregorian) date to BS (Bikram Sambat)
 * @param {Date|string} adDate
 * @returns {{ year: number, month: number, day: number, monthName: string }}
 */
export function adToBS(adDate) {
  const date = adDate instanceof Date ? adDate : new Date(adDate)
  
  // Days from AD reference
  const adRef = new Date(1943, 3, 14)
  const diffMs = date.getTime() - adRef.getTime()
  let totalDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  let bsYear = 2000
  let bsMonth = 1
  let bsDay = 1

  // Traverse through BS years
  while (totalDays > 0) {
    const monthData = getBSData(bsYear)
    if (!monthData) break
    
    const daysInMonth = monthData[bsMonth - 1]
    if (totalDays < daysInMonth) {
      bsDay += totalDays
      totalDays = 0
    } else {
      totalDays -= daysInMonth
      bsMonth++
      if (bsMonth > 12) {
        bsMonth = 1
        bsYear++
      }
    }
  }

  return {
    year: bsYear,
    month: bsMonth,
    day: bsDay,
    monthName: BS_MONTHS[bsMonth - 1],
    monthNameNp: BS_MONTHS_NP[bsMonth - 1],
  }
}

/**
 * Convert BS date to AD
 * @param {number} year BS year
 * @param {number} month BS month (1-12)
 * @param {number} day BS day
 * @returns {Date}
 */
export function bsToAD(year, month, day) {
  const adRef = new Date(1943, 3, 14)
  let totalDays = 0

  // Count days from 2000/1/1 BS to given date
  for (let y = 2000; y < year; y++) {
    const monthData = getBSData(y)
    if (!monthData) break
    totalDays += monthData.reduce((a, b) => a + b, 0)
  }

  const currentYearData = getBSData(year)
  if (currentYearData) {
    for (let m = 1; m < month; m++) {
      totalDays += currentYearData[m - 1]
    }
  }
  totalDays += day - 1

  const result = new Date(adRef)
  result.setDate(result.getDate() + totalDays)
  return result
}

/**
 * Get today's date in both AD and BS
 */
export function getTodayBoth() {
  const ad = new Date()
  const bs = adToBS(ad)
  return { ad, bs }
}

/**
 * Format a date in both AD and BS
 * @param {Date|string} date
 * @returns {string} "12 April 2026 | 30 Chaitra 2082"
 */
export function formatDualDate(date) {
  const ad = date instanceof Date ? date : new Date(date)
  const bs = adToBS(ad)
  
  const adStr = `${ad.getDate()} ${AD_MONTHS[ad.getMonth()]} ${ad.getFullYear()}`
  const bsStr = `${bs.day} ${bs.monthName} ${bs.year}`
  
  return `${adStr} | ${bsStr}`
}

/**
 * Format BS date as string
 */
export function formatBS(year, month, day) {
  return `${day} ${BS_MONTHS[month - 1]} ${year}`
}

/**
 * Format AD date as string
 */
export function formatAD(date) {
  const d = date instanceof Date ? date : new Date(date)
  return `${d.getDate()} ${AD_MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

/**
 * Get current Nepali Fiscal Year label
 * Nepali FY runs Shrawan 1 (mid-July) to Ashadh 31 (mid-July)
 */
export function getCurrentFiscalYear() {
  const { bs } = getTodayBoth()
  // Shrawan is month 4 in BS (Baisakh=1, Jestha=2, Ashadh=3, Shrawan=4)
  if (bs.month >= 4) {
    return { start: bs.year, end: bs.year + 1, label: `FY ${bs.year}/${bs.year + 1}` }
  } else {
    return { start: bs.year - 1, end: bs.year, label: `FY ${bs.year - 1}/${bs.year}` }
  }
}

/**
 * Get fiscal year for a given BS year/month
 */
export function getFiscalYear(bsYear, bsMonth) {
  if (bsMonth >= 4) {
    return { start: bsYear, end: bsYear + 1, label: `${bsYear}/${bsYear + 1}` }
  }
  return { start: bsYear - 1, end: bsYear, label: `${bsYear - 1}/${bsYear}` }
}

/**
 * Get the 12 months of a fiscal year in order (Shrawan to Ashadh)
 */
export function getFiscalYearMonths(fyStartBSYear) {
  const months = []
  // Shrawan (4) to Chaitra (12) of start year
  for (let m = 4; m <= 12; m++) {
    months.push({ year: fyStartBSYear, month: m, name: BS_MONTHS[m - 1] })
  }
  // Baisakh (1) to Ashadh (3) of next year
  for (let m = 1; m <= 3; m++) {
    months.push({ year: fyStartBSYear + 1, month: m, name: BS_MONTHS[m - 1] })
  }
  return months
}

export { BS_MONTHS, BS_MONTHS_NP, AD_MONTHS }

/**
 * Get BS month name from month number (1-12)
 */
export function getBSMonthName(month) {
  return BS_MONTHS[month - 1] || ''
}

/**
 * Get days in a BS month
 */
export function getDaysInBSMonth(year, month) {
  const data = getBSData(year)
  return data ? data[month - 1] : 30
}

/**
 * Convert a date string (YYYY-MM-DD) to BS
 */
export function dateStringToBS(dateStr) {
  return adToBS(new Date(dateStr + 'T00:00:00'))
}

/**
 * Get today as YYYY-MM-DD string
 */
export function todayString() {
  return new Date().toISOString().split('T')[0]
}
