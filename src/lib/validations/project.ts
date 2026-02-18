import { z } from 'zod'

export const projectStatuses = [
  { value: 'draft', label: 'Draft', color: 'gray' },
  { value: 'active', label: 'Active', color: 'green' },
  { value: 'on_hold', label: 'On Hold', color: 'yellow' },
  { value: 'completed', label: 'Completed', color: 'blue' },
  { value: 'cancelled', label: 'Cancelled', color: 'red' },
] as const

export const billingTypes = [
  { value: 'hourly', label: 'Hourly', description: 'Bill by the hour' },
  { value: 'fixed', label: 'Fixed Price', description: 'Fixed project cost' },
  { value: 'per_unit', label: 'Per Unit', description: 'Bill per unit of work' },
] as const

export const projectSchema = z
  .object({
    client_id: z.string().uuid('Invalid client'),

    name: z
      .string()
      .min(2, 'Name must be at least 2 characters')
      .max(100, 'Name must be at most 100 characters'),

    description: z.string().max(2000).optional().nullable(),

    status: z.enum(['draft', 'active', 'on_hold', 'completed', 'cancelled']).default('draft'),

    billing_type: z.enum(['hourly', 'fixed', 'per_unit']).default('hourly'),

    hourly_rate: z.coerce.number().min(0).optional().nullable(),
    fixed_price: z.coerce.number().min(0).optional().nullable(),
    per_unit_rate: z.coerce.number().min(0).optional().nullable(),

    project_manager_id: z.string().uuid().optional().nullable(),

    start_date: z.string().optional().nullable(),
    end_date: z.string().optional().nullable(),

    is_global: z.boolean().default(false),

    // Additional fields from schema
    address: z.string().max(200).optional().nullable(),
    po_number: z.string().max(50).optional().nullable(),
    work_type: z.string().max(100).optional().nullable(),
  })
  .refine(
    (data) => {
      // Validate billing fields based on type
      if (data.billing_type === 'hourly' && (data.hourly_rate === null || data.hourly_rate === undefined)) {
        return false
      }
      if (data.billing_type === 'fixed' && (data.fixed_price === null || data.fixed_price === undefined)) {
        return false
      }
      if (data.billing_type === 'per_unit' && (data.per_unit_rate === null || data.per_unit_rate === undefined)) {
        return false
      }
      return true
    },
    { message: 'Billing rate is required for the selected billing type', path: ['billing_type'] }
  )
  .refine(
    (data) => {
      // End date must be after start date
      if (data.start_date && data.end_date) {
        return new Date(data.end_date) >= new Date(data.start_date)
      }
      return true
    },
    { message: 'End date must be after start date', path: ['end_date'] }
  )

export type ProjectFormData = z.infer<typeof projectSchema>

// Billing role schema
export const billingRoleSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  rate: z.coerce.number().min(0, 'Rate must be positive'),
})

export type BillingRoleFormData = z.infer<typeof billingRoleSchema>

// Task schema
export const taskSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional().nullable(),
})

export type TaskFormData = z.infer<typeof taskSchema>
