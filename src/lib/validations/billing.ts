import { z } from 'zod'

// ============================================================
// Rate Tier Schemas
// ============================================================

export const rateTierSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  code: z
    .string()
    .min(1, 'Code is required')
    .max(20)
    .regex(/^[A-Z0-9_-]+$/, 'Code must be uppercase letters, numbers, hyphens, or underscores'),
  description: z.string().max(500).optional().nullable(),
  is_default: z.boolean().default(false),
  is_active: z.boolean().default(true),
  auto_rules: z
    .object({
      min_ytd_hours: z.number().min(0).optional(),
      max_avg_payment_days: z.number().min(0).optional(),
      evaluation_period: z.enum(['ytd', 'rolling_12m']).optional(),
      action: z.enum(['suggest', 'auto']).optional(),
    })
    .nullable()
    .optional(),
})

export type RateTierFormData = z.infer<typeof rateTierSchema>

export const rateTierLineSchema = z.object({
  tier_id: z.string().uuid('Invalid tier'),
  classification_id: z.string().uuid('Invalid classification'),
  hourly_rate: z.coerce
    .number()
    .min(0, 'Rate must be positive')
    .max(999.99, 'Rate too high'),
  effective_date: z.string().min(1, 'Effective date is required'),
  notes: z.string().max(500).optional().nullable(),
})

export type RateTierLineFormData = z.infer<typeof rateTierLineSchema>

// ============================================================
// Client Rate Tier Schema
// ============================================================

export const clientRateTierSchema = z.object({
  client_id: z.string().uuid('Invalid client'),
  tier_id: z.string().uuid('Invalid tier'),
  notes: z.string().max(500).optional().nullable(),
})

export type ClientRateTierFormData = z.infer<typeof clientRateTierSchema>

// ============================================================
// Project Rate Override Schema
// ============================================================

export const projectRateOverrideSchema = z.object({
  project_id: z.string().uuid('Invalid project'),
  classification_id: z.string().uuid('Invalid classification').nullable().optional(),
  hourly_rate: z.coerce
    .number()
    .min(0, 'Rate must be positive')
    .max(999.99, 'Rate too high'),
  reason: z.string().max(500).optional().nullable(),
})

export type ProjectRateOverrideFormData = z.infer<typeof projectRateOverrideSchema>

// ============================================================
// Employee Classification Schema
// ============================================================

export const employeeClassificationSchema = z
  .object({
    person_id: z.string().uuid('Invalid employee'),
    classification_id: z.string().uuid('Invalid classification'),
    effective_from: z.string().min(1, 'Effective from date is required'),
    effective_to: z.string().optional().nullable(),
    ccq_hours_accumulated: z.coerce.number().min(0).default(0),
    notes: z.string().max(500).optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.effective_from && data.effective_to) {
        return new Date(data.effective_to) >= new Date(data.effective_from)
      }
      return true
    },
    { message: 'End date must be on or after start date', path: ['effective_to'] }
  )

export type EmployeeClassificationFormData = z.infer<typeof employeeClassificationSchema>

// ============================================================
// Employee Rate Override Schema
// ============================================================

export const employeeRateOverrideSchema = z
  .object({
    person_id: z.string().uuid('Invalid employee'),
    classification_id: z.string().uuid('Invalid classification').nullable().optional(),
    hourly_rate: z.coerce
      .number()
      .min(0, 'Rate must be positive')
      .max(999.99, 'Rate too high'),
    reason: z.string().min(1, 'Reason is required').max(500),
    effective_from: z.string().min(1, 'Effective from date is required'),
    effective_to: z.string().optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.effective_from && data.effective_to) {
        return new Date(data.effective_to) >= new Date(data.effective_from)
      }
      return true
    },
    { message: 'End date must be on or after start date', path: ['effective_to'] }
  )

export type EmployeeRateOverrideFormData = z.infer<typeof employeeRateOverrideSchema>

// ============================================================
// Billing Settings Schema
// ============================================================

export const billingSettingsSchema = z.object({
  default_rate_tier_id: z.string().uuid().nullable().optional(),
  rate_tier_versioning: z.enum(['annual_may', 'annual_jan', 'on_change']).default('annual_may'),
  ot_default_mode: z.enum(['flat', 'standard', 'custom', 'off']).default('standard'),
  ot_standard_multiplier_1_5x: z.coerce.number().min(1).max(5).default(1.5),
  ot_standard_multiplier_2x: z.coerce.number().min(1).max(5).default(2.0),
  ot_custom_multiplier_1_5x: z.coerce.number().min(1).max(5).nullable().optional(),
  ot_custom_multiplier_2x: z.coerce.number().min(1).max(5).nullable().optional(),
  ot_approval_default: z
    .enum(['pre_approved', 'per_instance', 'never'])
    .default('per_instance'),
  retainage_default_percent: z.coerce.number().min(0).max(100).default(10),
  retainage_on_subtotal: z.boolean().default(true),
  retainage_hold_days: z.coerce.number().min(0).max(365).default(45),
  learning_phase_default_weeks: z.coerce.number().min(0).max(52).default(2),
  learning_phase_alert_days: z.coerce.number().min(0).max(30).default(3),
})

export type BillingSettingsFormData = z.infer<typeof billingSettingsSchema>

// ============================================================
// OT Billing Config Schema
// ============================================================

export const otPremiumSchema = z.object({
  label: z.string().min(1, 'Label is required').max(50),
  multiplier: z.coerce.number().min(1, 'Multiplier must be at least 1').max(5),
})

export const otBillingConfigSchema = z.object({
  mode: z.enum(['flat', 'standard', 'custom', 'off']),
  ot_1_5x: z.coerce.number().min(1).max(5).optional(),
  ot_2x: z.coerce.number().min(1).max(5).optional(),
  premiums: z.array(otPremiumSchema).optional(),
})

export type OtBillingConfigFormData = z.infer<typeof otBillingConfigSchema>
