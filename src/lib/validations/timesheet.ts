import { z } from 'zod'

// Timesheet status configuration for UI
export const timesheetStatuses = [
  { value: 'draft', label: 'Draft', color: 'gray', description: 'Editing in progress' },
  { value: 'submitted', label: 'Submitted', color: 'blue', description: 'Awaiting approval' },
  { value: 'approved', label: 'Approved', color: 'green', description: 'Manager approved' },
  { value: 'rejected', label: 'Rejected', color: 'red', description: 'Returned for changes' },
  { value: 'locked', label: 'Locked', color: 'purple', description: 'Period closed' },
] as const

export type TimesheetStatus = (typeof timesheetStatuses)[number]['value']

// Hour validation constants
export const HOUR_RULES = {
  maxPerDay: 24,
  maxPerWeek: 168, // 24 * 7
  warnIfOver: 12, // Show warning if single day > 12
  increment: 0.25, // Quarter-hour increments
  minIncrement: 0,
}

// Helper to validate a single hour value
const hourSchema = z.coerce
  .number()
  .min(0, 'Hours cannot be negative')
  .max(HOUR_RULES.maxPerDay, `Hours cannot exceed ${HOUR_RULES.maxPerDay}`)
  .multipleOf(HOUR_RULES.increment, `Hours must be in ${HOUR_RULES.increment} hour increments`)
  .nullable()
  .transform((val) => val ?? 0)

// Hours array schema (7 days: Mon-Sun)
export const hoursArraySchema = z
  .array(hourSchema)
  .length(7, 'Must have exactly 7 day values')
  .refine(
    (hours) => {
      const total = hours.reduce((sum, h) => sum + h, 0)
      return total <= HOUR_RULES.maxPerWeek
    },
    { message: `Week total cannot exceed ${HOUR_RULES.maxPerWeek} hours` }
  )

// Timesheet entry schema for form validation
export const timesheetEntrySchema = z.object({
  id: z.string().uuid().optional(), // Optional for new entries

  project_id: z.string().uuid('Please select a project'),

  task_id: z.string().uuid().optional().nullable(),

  billing_role_id: z.string().uuid('Please select a billing role').optional().nullable(),

  description: z.string().max(500, 'Description too long').optional().nullable(),

  hours: hoursArraySchema,

  is_billable: z.boolean().default(true),
})

export type TimesheetEntryFormData = z.infer<typeof timesheetEntrySchema>

// Schema for saving multiple entries at once
export const saveEntriesSchema = z.object({
  timesheet_id: z.string().uuid(),
  entries: z.array(timesheetEntrySchema),
})

export type SaveEntriesData = z.infer<typeof saveEntriesSchema>

// Schema for submit action
export const submitTimesheetSchema = z.object({
  timesheet_id: z.string().uuid(),
})

// Schema for approval/rejection
export const approveTimesheetSchema = z.object({
  timesheet_id: z.string().uuid(),
})

export const rejectTimesheetSchema = z.object({
  timesheet_id: z.string().uuid(),
  reason: z.string().max(500).optional().nullable(),
})

// Helper function to validate hours and return warnings
export function validateHoursWithWarnings(hours: number[]): {
  valid: boolean
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []
  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

  hours.forEach((h, index) => {
    if (h < 0) {
      errors.push(`${dayNames[index]}: Hours cannot be negative`)
    }
    if (h > HOUR_RULES.maxPerDay) {
      errors.push(`${dayNames[index]}: Hours cannot exceed ${HOUR_RULES.maxPerDay}`)
    }
    if (h > HOUR_RULES.warnIfOver) {
      warnings.push(`${dayNames[index]}: ${h} hours seems high`)
    }
  })

  const total = hours.reduce((a, b) => a + b, 0)
  if (total > HOUR_RULES.maxPerWeek) {
    errors.push(`Week total (${total}) exceeds maximum of ${HOUR_RULES.maxPerWeek} hours`)
  }

  return { valid: errors.length === 0, errors, warnings }
}

// Helper to create an empty hours array
export function emptyHoursArray(): number[] {
  return [0, 0, 0, 0, 0, 0, 0]
}

// Helper to create a default entry object for new entries
export function createEmptyEntry(_timesheetId?: string): Partial<TimesheetEntryFormData> {
  return {
    project_id: undefined,
    task_id: null,
    billing_role_id: null,
    description: null,
    hours: emptyHoursArray(),
    is_billable: true,
  }
}
