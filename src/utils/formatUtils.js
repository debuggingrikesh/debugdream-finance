/**
 * Format a number in Nepali comma format (lakh system)
 * e.g. 122500 → 1,22,500
 */
export function formatNPR(amount, showSymbol = true) {
  if (amount === null || amount === undefined || isNaN(amount)) return showSymbol ? 'NPR 0' : '0'
  
  const num = Math.abs(Number(amount))
  const isNegative = Number(amount) < 0
  
  let str = Math.floor(num).toString()
  
  // Nepali lakh formatting: last 3 digits, then groups of 2
  if (str.length > 3) {
    const last3 = str.slice(-3)
    const rest = str.slice(0, -3)
    const restFormatted = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')
    str = restFormatted + ',' + last3
  }
  
  // Handle decimal part
  const decimal = (num % 1).toFixed(2).slice(1) // e.g. ".50"
  
  const formatted = `${str}${decimal !== '.00' ? decimal : ''}`
  const sign = isNegative ? '-' : ''
  
  return showSymbol ? `${sign}NPR ${formatted}` : `${sign}${formatted}`
}

/**
 * Format AUD amount
 */
export function formatAUD(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return 'AUD 0.00'
  return `AUD ${Number(amount).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * Format USD amount
 */
export function formatUSD(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return 'USD 0.00'
  return `USD ${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * Format amount by currency
 */
export function formatByCurrency(amount, currency = 'NPR') {
  switch (currency.toUpperCase()) {
    case 'AUD': return formatAUD(amount)
    case 'USD': return formatUSD(amount)
    default: return formatNPR(amount)
  }
}

/**
 * Parse a formatted NPR string back to number
 */
export function parseNPR(str) {
  if (!str) return 0
  return parseFloat(str.toString().replace(/NPR\s?/g, '').replace(/,/g, '')) || 0
}

/**
 * Format a percentage
 */
export function formatPercent(value, decimals = 1) {
  return `${Number(value).toFixed(decimals)}%`
}

/**
 * Format compact number (e.g. 1.2L, 45K)
 */
export function formatCompact(amount) {
  const num = Math.abs(Number(amount))
  if (num >= 10000000) return `${(num / 10000000).toFixed(1)}Cr`
  if (num >= 100000) return `${(num / 100000).toFixed(1)}L`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toString()
}

/**
 * Calculate percentage change
 */
export function percentChange(current, previous) {
  if (!previous || previous === 0) return null
  return ((current - previous) / previous) * 100
}

/**
 * Generate invoice number
 * Format: DD-BSYYYY-NNN
 */
export function generateInvoiceNumber(bsYear, sequence) {
  const seq = String(sequence).padStart(3, '0')
  return `DD-${bsYear}-${seq}`
}

/**
 * Clamp a number between min and max
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

/**
 * Parse input as number, return 0 if invalid
 */
export function safeNumber(val) {
  const n = parseFloat(String(val).replace(/,/g, ''))
  return isNaN(n) ? 0 : n
}
