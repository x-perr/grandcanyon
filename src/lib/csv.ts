/**
 * CSV Export Utilities
 *
 * Client-side CSV generation and download for reports
 */

export type ColumnDefinition<T> = {
  key: keyof T
  header: string
  format?: (value: T[keyof T]) => string
}

/**
 * Generate CSV string from data array
 */
export function generateCSV<T extends Record<string, unknown>>(
  data: T[],
  columns: ColumnDefinition<T>[]
): string {
  if (data.length === 0) {
    return columns.map(col => escapeCSV(col.header)).join(',')
  }

  // Header row
  const headerRow = columns.map(col => escapeCSV(col.header)).join(',')

  // Data rows
  const dataRows = data.map(row => {
    return columns
      .map(col => {
        const value = row[col.key]
        const formatted = col.format ? col.format(value) : String(value ?? '')
        return escapeCSV(formatted)
      })
      .join(',')
  })

  return [headerRow, ...dataRows].join('\n')
}

/**
 * Escape CSV field value
 * - Wrap in quotes if contains comma, newline, or quote
 * - Double any existing quotes
 */
function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('\n') || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/**
 * Trigger CSV download in browser
 */
export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'

  document.body.appendChild(link)
  link.click()

  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Format date for CSV (ISO date string)
 */
export function formatDateForCSV(date: string | Date | null): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toISOString().split('T')[0]
}

/**
 * Format currency for CSV (no symbol, 2 decimals)
 */
export function formatCurrencyForCSV(amount: number | null): string {
  if (amount === null || amount === undefined) return ''
  return amount.toFixed(2)
}

/**
 * Format hours for CSV (1 decimal)
 */
export function formatHoursForCSV(hours: number | null): string {
  if (hours === null || hours === undefined) return ''
  return hours.toFixed(1)
}

/**
 * Format percentage for CSV (1 decimal)
 */
export function formatPercentForCSV(percent: number | null): string {
  if (percent === null || percent === undefined) return ''
  return `${percent.toFixed(1)}%`
}
