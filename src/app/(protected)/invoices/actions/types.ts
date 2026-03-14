import type { Enums, Tables } from '@/types/database'
import type { RateSource, OtFlags } from '@/types/billing'

export type InvoiceStatus = Enums<'invoice_status'>

export type SortColumn = 'invoice_number' | 'invoice_date' | 'due_date' | 'total' | 'status' | 'created_at'
export type SortDirection = 'asc' | 'desc'

// === TYPE DEFINITIONS ===

export type InvoiceWithRelations = Tables<'invoices'> & {
  client: {
    id: string
    code: string
    name: string
    short_name: string | null
    billing_email: string | null
    billing_address_line1: string | null
    billing_city: string | null
    billing_province: string | null
    billing_postal_code: string | null
    charges_gst: boolean | null
    charges_qst: boolean | null
  } | null
  project: {
    id: string
    code: string
    name: string
  } | null
  lines?: InvoiceLineWithRelations[]
}

export type InvoiceLineWithRelations = Tables<'invoice_lines'> & {
  timesheet_entry?: {
    id: string
    hours: number[]
    timesheet: {
      user: { first_name: string; last_name: string } | null
    } | null
  } | null
  /** Rate source from billing cascade (stored during invoice creation) */
  rate_source?: RateSource | null
  /** Additional rate context (tier_code, classification_level, is_ot, ot_multiplier) */
  rate_metadata?: {
    tier_code?: string
    classification_level?: string
    is_ot?: boolean
    ot_multiplier?: number
  } | null
}

export type UninvoicedEntry = {
  id: string
  hours: number[]
  is_billable: boolean
  description: string | null
  timesheet: {
    id: string
    week_start: string
    user: {
      id: string
      first_name: string
      last_name: string
    } | null
  } | null
  project: {
    id: string
    code: string
    name: string
  } | null
  task: {
    id: string
    code: string
    name: string
  } | null
  billing_role: {
    id: string
    name: string
    rate: number
  } | null
  /** Effective hourly rate after billing cascade resolution */
  resolved_rate?: number
  /** Which tier/override was used to resolve the rate */
  rate_source?: RateSource
  /** Rate tier code (if resolved via client or default tier) */
  rate_tier_code?: string | null
  /** Employee classification level used for rate lookup */
  rate_classification_level?: string | null
  /** OT flags per day (from timesheet entry) */
  ot_flags?: OtFlags | null
}

export type ClientForSelect = {
  id: string
  code: string
  name: string
  charges_gst: boolean | null
  charges_qst: boolean | null
}

export type ProjectForSelect = {
  id: string
  code: string
  name: string
  client_id: string
}

export type InvoiceEmail = {
  id: string
  sent_to: string
  sent_at: string
  status: string
  error_message: string | null
  sent_by_name: string
}

export type BatchInvoicePreview = {
  clientId: string
  clientName: string
  clientCode: string
  billingEmail: string | null
  projects: {
    projectId: string
    projectCode: string
    projectName: string
    entries: {
      id: string
      userId: string
      userName: string
      hours: number
      rate: number
      amount: number
    }[]
    totalHours: number
    totalAmount: number
  }[]
  totalHours: number
  totalAmount: number
}

export type BatchInvoiceResult = {
  clientId: string
  clientName: string
  invoiceId: string
  invoiceNumber: string
  total: number
  success: boolean
  error?: string
}
