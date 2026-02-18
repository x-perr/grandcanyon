import { z } from 'zod'

// Invoice status configuration for UI
export const invoiceStatuses = [
  { value: 'draft', label: 'Draft', color: 'gray', description: 'Editing in progress' },
  { value: 'sent', label: 'Sent', color: 'blue', description: 'Sent to client' },
  { value: 'paid', label: 'Paid', color: 'green', description: 'Payment received' },
  { value: 'void', label: 'Void', color: 'red', description: 'Cancelled' },
] as const

export type InvoiceStatus = (typeof invoiceStatuses)[number]['value']

// Get status config helper
export function getStatusConfig(status: InvoiceStatus) {
  return invoiceStatuses.find((s) => s.value === status) ?? invoiceStatuses[0]
}

// Invoice line item schema (for form validation)
export const invoiceLineSchema = z.object({
  id: z.string().uuid().optional(), // Optional for new lines
  description: z.string().min(1, 'Description is required').max(500, 'Description too long'),
  quantity: z.coerce.number().min(0, 'Quantity must be positive'),
  unit_price: z.coerce.number().min(0, 'Unit price must be positive'),
  amount: z.coerce.number(), // Calculated: quantity * unit_price
  timesheet_entry_id: z.string().uuid().optional().nullable(),
  expense_entry_id: z.string().uuid().optional().nullable(),
  sort_order: z.number().optional(),
})

export type InvoiceLineFormData = z.infer<typeof invoiceLineSchema>

// Invoice creation schema (wizard step 3)
export const createInvoiceSchema = z.object({
  client_id: z.string().uuid('Please select a client'),
  project_id: z.string().uuid('Please select a project'),
  invoice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  notes: z.string().max(2000, 'Notes too long').optional().nullable(),
  lines: z.array(invoiceLineSchema).min(1, 'At least one line item is required'),
})

export type CreateInvoiceData = z.infer<typeof createInvoiceSchema>

// Invoice update schema (edit draft)
export const updateInvoiceSchema = z.object({
  invoice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format').optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format').optional(),
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format').optional(),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format').optional(),
  notes: z.string().max(2000, 'Notes too long').optional().nullable(),
  lines: z.array(invoiceLineSchema).min(1, 'At least one line item is required').optional(),
})

export type UpdateInvoiceData = z.infer<typeof updateInvoiceSchema>

// Wizard step 1: Select project
export const selectProjectSchema = z.object({
  client_id: z.string().uuid('Please select a client'),
  project_id: z.string().uuid('Please select a project'),
})

export type SelectProjectData = z.infer<typeof selectProjectSchema>

// Wizard step 2: Select entries
export const selectEntriesSchema = z.object({
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  entry_ids: z.array(z.string().uuid()).min(1, 'Please select at least one entry'),
})

export type SelectEntriesData = z.infer<typeof selectEntriesSchema>

// Status action schemas
export const sendInvoiceSchema = z.object({
  invoice_id: z.string().uuid(),
})

export const markPaidSchema = z.object({
  invoice_id: z.string().uuid(),
})

export const cancelInvoiceSchema = z.object({
  invoice_id: z.string().uuid(),
  reason: z.string().max(500).optional().nullable(),
})

// Helper to generate default dates
export function getDefaultInvoiceDates() {
  const today = new Date()
  const dueDate = new Date(today)
  dueDate.setDate(dueDate.getDate() + 30) // Net 30

  return {
    invoice_date: today.toISOString().split('T')[0],
    due_date: dueDate.toISOString().split('T')[0],
  }
}

// Helper to get default period (last month)
export function getDefaultPeriod() {
  const today = new Date()
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const lastOfPrevMonth = new Date(firstOfMonth)
  lastOfPrevMonth.setDate(lastOfPrevMonth.getDate() - 1)
  const firstOfPrevMonth = new Date(lastOfPrevMonth.getFullYear(), lastOfPrevMonth.getMonth(), 1)

  return {
    period_start: firstOfPrevMonth.toISOString().split('T')[0],
    period_end: lastOfPrevMonth.toISOString().split('T')[0],
  }
}

// Helper to create an empty line item
export function createEmptyLine(sortOrder: number = 0): Partial<InvoiceLineFormData> {
  return {
    description: '',
    quantity: 0,
    unit_price: 0,
    amount: 0,
    sort_order: sortOrder,
  }
}
