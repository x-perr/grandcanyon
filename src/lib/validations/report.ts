import { z } from 'zod'

/**
 * Report filter validation schemas
 */

// Date range presets
export const dateRangePresets = [
  'this_week',
  'last_week',
  'this_month',
  'last_month',
  'this_quarter',
  'this_year',
  'custom',
] as const

export type DateRangePreset = typeof dateRangePresets[number]

// Base report filters schema
export const reportFiltersSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  projectId: z.string().uuid().optional(),
  projectIds: z.array(z.string().uuid()).optional(),
  userId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  status: z.string().optional(),
  preset: z.enum(dateRangePresets).optional(),
})

export type ReportFilters = z.infer<typeof reportFiltersSchema>

// Timesheet report specific
export const timesheetReportFiltersSchema = reportFiltersSchema.extend({
  groupBy: z.enum(['user', 'project', 'week']).optional(),
  billableOnly: z.boolean().optional(),
})

export type TimesheetReportFilters = z.infer<typeof timesheetReportFiltersSchema>

// Invoice report specific
export const invoiceReportFiltersSchema = reportFiltersSchema.extend({
  status: z.enum(['draft', 'sent', 'paid', 'void', 'all']).optional(),
})

export type InvoiceReportFilters = z.infer<typeof invoiceReportFiltersSchema>

// Profitability report specific
export const profitabilityReportFiltersSchema = reportFiltersSchema.extend({
  billingType: z.enum(['hourly', 'fixed', 'per_unit', 'all']).optional(),
  includeCompleted: z.boolean().optional(),
})

export type ProfitabilityReportFilters = z.infer<typeof profitabilityReportFiltersSchema>

/**
 * Calculate date range from preset
 */
export function getDateRangeFromPreset(preset: DateRangePreset): {
  startDate: string
  endDate: string
} {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  const day = today.getDay()

  switch (preset) {
    case 'this_week': {
      // Monday of current week
      const monday = new Date(today)
      monday.setDate(today.getDate() - ((day + 6) % 7))
      monday.setHours(0, 0, 0, 0)

      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)

      return {
        startDate: formatDate(monday),
        endDate: formatDate(sunday),
      }
    }

    case 'last_week': {
      const lastMonday = new Date(today)
      lastMonday.setDate(today.getDate() - ((day + 6) % 7) - 7)
      lastMonday.setHours(0, 0, 0, 0)

      const lastSunday = new Date(lastMonday)
      lastSunday.setDate(lastMonday.getDate() + 6)

      return {
        startDate: formatDate(lastMonday),
        endDate: formatDate(lastSunday),
      }
    }

    case 'this_month': {
      const firstDay = new Date(year, month, 1)
      const lastDay = new Date(year, month + 1, 0)

      return {
        startDate: formatDate(firstDay),
        endDate: formatDate(lastDay),
      }
    }

    case 'last_month': {
      const firstDay = new Date(year, month - 1, 1)
      const lastDay = new Date(year, month, 0)

      return {
        startDate: formatDate(firstDay),
        endDate: formatDate(lastDay),
      }
    }

    case 'this_quarter': {
      const quarterMonth = Math.floor(month / 3) * 3
      const firstDay = new Date(year, quarterMonth, 1)
      const lastDay = new Date(year, quarterMonth + 3, 0)

      return {
        startDate: formatDate(firstDay),
        endDate: formatDate(lastDay),
      }
    }

    case 'this_year': {
      return {
        startDate: `${year}-01-01`,
        endDate: `${year}-12-31`,
      }
    }

    case 'custom':
    default:
      // Return current month as default for custom
      return {
        startDate: formatDate(new Date(year, month, 1)),
        endDate: formatDate(new Date(year, month + 1, 0)),
      }
  }
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

/**
 * Parse filters from URL search params
 */
export function parseReportFilters(searchParams: Record<string, string | string[] | undefined>): ReportFilters {
  const filters: ReportFilters = {}

  if (searchParams.startDate && typeof searchParams.startDate === 'string') {
    filters.startDate = searchParams.startDate
  }
  if (searchParams.endDate && typeof searchParams.endDate === 'string') {
    filters.endDate = searchParams.endDate
  }
  if (searchParams.projectId && typeof searchParams.projectId === 'string') {
    filters.projectId = searchParams.projectId
  }
  if (searchParams.userId && typeof searchParams.userId === 'string') {
    filters.userId = searchParams.userId
  }
  if (searchParams.clientId && typeof searchParams.clientId === 'string') {
    filters.clientId = searchParams.clientId
  }
  if (searchParams.status && typeof searchParams.status === 'string') {
    filters.status = searchParams.status
  }
  if (searchParams.preset && typeof searchParams.preset === 'string') {
    filters.preset = searchParams.preset as DateRangePreset
  }

  // Apply preset if no explicit dates
  if (filters.preset && !filters.startDate && !filters.endDate) {
    const range = getDateRangeFromPreset(filters.preset)
    filters.startDate = range.startDate
    filters.endDate = range.endDate
  }

  return filters
}
