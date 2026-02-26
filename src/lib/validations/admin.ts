import { z } from 'zod'

// Schema for user update validation
export const userUpdateSchema = z.object({
  first_name: z.string().min(1, 'First name is required').max(50),
  last_name: z.string().min(1, 'Last name is required').max(50),
  phone: z.string().max(20).optional().nullable(),
  role_id: z.string().uuid().optional().nullable(),
  manager_id: z.string().uuid().optional().nullable(),
  is_active: z.boolean().optional(),
})

// Schema for company info validation
export const companyInfoSchema = z.object({
  name: z.string().min(1, 'Company name is required').max(100),
  address: z.string().max(200).optional().default(''),
  city: z.string().max(50).optional().default(''),
  province: z.string().max(50).optional().default(''),
  postalCode: z.string().max(20).optional().default(''),
  phone: z.string().max(20).optional().default(''),
  email: z
    .string()
    .email('Invalid email address')
    .optional()
    .or(z.literal(''))
    .transform((val) => val || undefined),
  gstNumber: z.string().max(30).optional().default(''),
  qstNumber: z.string().max(30).optional().default(''),
  logoUrl: z.string().url().nullable().optional(),
})

export type CompanyInfo = z.infer<typeof companyInfoSchema>

// Default values (fallback if no settings exist)
export const DEFAULT_COMPANY_INFO: CompanyInfo = {
  name: 'Systèmes Intérieurs Grand Canyon',
  address: '123 Construction Blvd',
  city: 'Montréal',
  province: 'QC',
  postalCode: 'H2X 1Y1',
  phone: '514-555-1234',
  email: 'info@grandcanyon.ca',
  gstNumber: '123456789 RT0001',
  qstNumber: '1234567890 TQ0001',
  logoUrl: null,
}
