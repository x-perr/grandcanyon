import { z } from 'zod'

// Canadian postal code regex
const postalCodeRegex = /^[A-Z]\d[A-Z] ?\d[A-Z]\d$/i

// Canadian provinces
export const provinces = [
  { value: 'AB', label: 'Alberta' },
  { value: 'BC', label: 'British Columbia' },
  { value: 'MB', label: 'Manitoba' },
  { value: 'NB', label: 'New Brunswick' },
  { value: 'NL', label: 'Newfoundland and Labrador' },
  { value: 'NS', label: 'Nova Scotia' },
  { value: 'NT', label: 'Northwest Territories' },
  { value: 'NU', label: 'Nunavut' },
  { value: 'ON', label: 'Ontario' },
  { value: 'PE', label: 'Prince Edward Island' },
  { value: 'QC', label: 'Quebec' },
  { value: 'SK', label: 'Saskatchewan' },
  { value: 'YT', label: 'Yukon' },
] as const

export const clientSchema = z.object({
  code: z
    .string()
    .min(2, 'Code must be at least 2 characters')
    .max(10, 'Code must be at most 10 characters')
    .regex(/^[A-Z0-9]+$/, 'Code must be uppercase alphanumeric')
    .transform((val) => val.toUpperCase()),

  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be at most 100 characters'),

  short_name: z
    .string()
    .min(1, 'Short name is required')
    .max(50, 'Short name must be at most 50 characters'),

  charges_gst: z.boolean().default(true),
  charges_qst: z.boolean().default(true),

  next_project_number: z.coerce.number().int().min(1).default(1),

  // Contact info
  general_email: z.string().email('Invalid email').optional().nullable().or(z.literal('')),
  phone: z.string().max(20).optional().nullable(),
  website: z.string().url('Invalid URL').optional().nullable().or(z.literal('')),
  notes: z.string().max(2000).optional().nullable(),

  // Postal address
  postal_address_line1: z.string().max(100).optional().nullable(),
  postal_address_line2: z.string().max(100).optional().nullable(),
  postal_city: z.string().max(50).optional().nullable(),
  postal_province: z.string().max(2).optional().nullable(),
  postal_code: z
    .string()
    .regex(postalCodeRegex, 'Invalid postal code (format: A1A 1A1)')
    .transform((val) => val.toUpperCase().replace(/(.{3})(.{3})/, '$1 $2'))
    .optional()
    .nullable()
    .or(z.literal('')),
  postal_country: z.string().max(50).default('Canada').optional().nullable(),

  // Billing address
  billing_address_line1: z.string().max(100).optional().nullable(),
  billing_address_line2: z.string().max(100).optional().nullable(),
  billing_city: z.string().max(50).optional().nullable(),
  billing_province: z.string().max(2).optional().nullable(),
  billing_postal_code: z
    .string()
    .regex(postalCodeRegex, 'Invalid postal code (format: A1A 1A1)')
    .transform((val) => val.toUpperCase().replace(/(.{3})(.{3})/, '$1 $2'))
    .optional()
    .nullable()
    .or(z.literal('')),
  billing_country: z.string().max(50).default('Canada').optional().nullable(),
  billing_email: z.string().email('Invalid email').optional().nullable().or(z.literal('')),
})

export type ClientFormData = z.infer<typeof clientSchema>

// Contact schema
export const contactSchema = z.object({
  first_name: z.string().min(1, 'First name is required').max(50),
  last_name: z.string().min(1, 'Last name is required').max(50),
  title: z.string().max(100).optional().nullable(),
  email: z.string().email('Invalid email').optional().nullable().or(z.literal('')),
  phone: z.string().max(20).optional().nullable(),
  is_primary: z.boolean().default(false),
})

export type ContactFormData = z.infer<typeof contactSchema>
