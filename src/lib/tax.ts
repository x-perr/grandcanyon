/**
 * Quebec Tax Calculation Utilities
 *
 * CRITICAL: Quebec uses COMPOUND taxation
 * - GST: 5% of subtotal
 * - QST: 9.975% of (subtotal + GST), NOT just subtotal
 */

// Tax rates (Quebec, Canada)
export const TAX_RATES = {
  GST: 0.05, // 5% Federal Goods and Services Tax
  QST: 0.09975, // 9.975% Quebec Sales Tax
} as const

export interface TaxCalculation {
  subtotal: number
  gst: number
  qst: number
  total: number
}

/**
 * Round to specified decimal places using banker's rounding
 */
export function round(value: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals)
  return Math.round(value * factor) / factor
}

/**
 * Calculate Quebec taxes (GST + QST compound)
 *
 * @param subtotal - Amount before taxes
 * @param chargesGst - Whether to charge GST (5%)
 * @param chargesQst - Whether to charge QST (9.975%)
 * @returns Tax calculation with subtotal, gst, qst, and total
 *
 * @example
 * // Client charges both taxes
 * calculateTaxes(2780, true, true)
 * // => { subtotal: 2780, gst: 139, qst: 291.47, total: 3210.47 }
 *
 * // QST is compound: 9.975% of (2780 + 139) = 9.975% of 2919 = 291.17
 */
export function calculateTaxes(
  subtotal: number,
  chargesGst: boolean,
  chargesQst: boolean
): TaxCalculation {
  // GST: 5% of subtotal
  const gst = chargesGst ? round(subtotal * TAX_RATES.GST) : 0

  // QST: 9.975% of (subtotal + GST) - COMPOUND calculation
  const qst = chargesQst ? round((subtotal + gst) * TAX_RATES.QST) : 0

  // Total
  const total = round(subtotal + gst + qst)

  return { subtotal, gst, qst, total }
}

/**
 * Calculate line item amount from quantity and unit price
 */
export function calculateLineAmount(quantity: number, unitPrice: number): number {
  return round(quantity * unitPrice)
}

/**
 * Format currency for display (CAD)
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(amount)
}

/**
 * Format currency without symbol (for inputs)
 */
export function formatAmount(amount: number): string {
  return amount.toFixed(2)
}
