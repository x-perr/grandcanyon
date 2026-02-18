import { z } from 'zod'

// Expense status configuration for UI
export const expenseStatuses = [
  { value: 'draft', label: 'Draft', color: 'gray', description: 'Editing in progress' },
  { value: 'submitted', label: 'Submitted', color: 'blue', description: 'Awaiting approval' },
  { value: 'approved', label: 'Approved', color: 'green', description: 'Manager approved' },
  { value: 'rejected', label: 'Rejected', color: 'red', description: 'Returned for changes' },
] as const

export type ExpenseStatus = (typeof expenseStatuses)[number]['value']

// Tax rates (Quebec)
export const TAX_RATES = {
  GST: 0.05,      // 5%
  QST: 0.09975,   // 9.975%
}

// Validation constants
export const EXPENSE_RULES = {
  maxQuantity: 9999,
  maxUnitPrice: 99999,
  maxDescriptionLength: 500,
  maxReceiptLength: 50,
}

// Calculate taxes and totals
export function calculateExpenseTotals(quantity: number, unitPrice: number): {
  subtotal: number
  gst_amount: number
  qst_amount: number
  total: number
} {
  const subtotal = quantity * unitPrice
  const gst_amount = Math.round(subtotal * TAX_RATES.GST * 100) / 100
  const qst_amount = Math.round(subtotal * TAX_RATES.QST * 100) / 100
  const total = Math.round((subtotal + gst_amount + qst_amount) * 100) / 100

  return { subtotal, gst_amount, qst_amount, total }
}

// Expense entry schema for form validation
export const expenseEntrySchema = z.object({
  id: z.string().uuid().optional(), // Optional for new entries

  expense_type_id: z.string().uuid('Please select an expense type'),

  project_id: z.string().uuid('Please select a project'),

  task_id: z.string().uuid().optional().nullable(),

  expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),

  description: z
    .string()
    .min(1, 'Description is required')
    .max(EXPENSE_RULES.maxDescriptionLength, 'Description too long'),

  receipt_number: z
    .string()
    .max(EXPENSE_RULES.maxReceiptLength, 'Receipt number too long')
    .optional()
    .nullable(),

  quantity: z.coerce
    .number()
    .positive('Quantity must be positive')
    .max(EXPENSE_RULES.maxQuantity, `Quantity cannot exceed ${EXPENSE_RULES.maxQuantity}`),

  unit_price: z.coerce
    .number()
    .min(0, 'Unit price cannot be negative')
    .max(EXPENSE_RULES.maxUnitPrice, `Unit price cannot exceed ${EXPENSE_RULES.maxUnitPrice}`),

  is_billable: z.boolean().default(false),
})

export type ExpenseEntryFormData = z.infer<typeof expenseEntrySchema>

// Schema for submit action
export const submitExpenseSchema = z.object({
  expense_id: z.string().uuid(),
})

// Schema for approval/rejection
export const approveExpenseSchema = z.object({
  expense_id: z.string().uuid(),
})

export const rejectExpenseSchema = z.object({
  expense_id: z.string().uuid(),
  reason: z.string().max(500).optional().nullable(),
})

// Helper function to create a default entry object
export function createEmptyExpenseEntry(weekStart: string): Partial<ExpenseEntryFormData> {
  return {
    expense_type_id: undefined,
    project_id: undefined,
    task_id: null,
    expense_date: weekStart, // Default to first day of week
    description: '',
    receipt_number: null,
    quantity: 1,
    unit_price: 0,
    is_billable: false,
  }
}

// Format currency for display
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(amount)
}
