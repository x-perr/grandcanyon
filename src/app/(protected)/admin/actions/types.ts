import type { Json } from '@/types/database'
import type {
  EmployeeClassification,
  EmployeeRateOverride,
  CcqClassification,
  CcqTrade,
} from '@/types/billing'

// Re-export types that components need
export type { CompanyInfo } from '@/lib/validations/admin'

// ============================================
// AUDIT LOG TYPES
// ============================================

// Raw type from Supabase query (arrays for joins)
export type AuditLogQueryResult = {
  id: string
  action: string
  entity_type: string
  entity_id: string | null
  old_values: Json | null
  new_values: Json | null
  ip_address: string | null
  user_agent: string | null
  created_at: string | null
  user_id: string | null
  user: { id: string; first_name: string; last_name: string; email: string }[] | null
}

// Normalized type for use in components
export type AuditLogWithUser = {
  id: string
  action: string
  entity_type: string
  entity_id: string | null
  old_values: Json | null
  new_values: Json | null
  ip_address: string | null
  user_agent: string | null
  created_at: string | null
  user: { id: string; first_name: string; last_name: string; email: string } | null
}

// Helper to normalize query result
export function normalizeAuditLog(raw: AuditLogQueryResult): AuditLogWithUser {
  return {
    ...raw,
    user: raw.user?.[0] ?? null,
  }
}

// ============================================
// USER TYPES
// ============================================

// Raw type from Supabase query (arrays for joins)
export type UserQueryResult = {
  id: string
  email: string
  first_name: string
  last_name: string
  phone: string | null
  is_active: boolean | null
  role_id: string | null
  manager_id: string | null
  person_id: string | null
  created_at: string | null
  ccq_card_number: string | null
  ccq_card_expiry: string | null
  ccq_card_url: string | null
  ccq_card_uploaded_at: string | null
  role: { id: string; name: string }[] | null
  manager: { id: string; first_name: string; last_name: string }[] | null
  person: { id: string; address: string | null; city: string | null; lat: number | null; lng: number | null }[] | null
}

// Person address data
export type PersonAddress = {
  id: string
  address: string | null
  city: string | null
  lat: number | null
  lng: number | null
}

// Normalized type for use in components
export type UserWithRole = {
  id: string
  email: string
  first_name: string
  last_name: string
  phone: string | null
  is_active: boolean | null
  role_id: string | null
  manager_id: string | null
  person_id: string | null
  created_at: string | null
  ccq_card_number: string | null
  ccq_card_expiry: string | null
  ccq_card_url: string | null
  ccq_card_uploaded_at: string | null
  role: { id: string; name: string } | null
  manager: { id: string; first_name: string; last_name: string } | null
  person: PersonAddress | null
}

/** Employee with CCQ classification info (extends UserWithRole) */
export type UserWithClassification = UserWithRole & {
  current_classification: {
    classification: { level: string; name_fr: string; name_en: string } | null
    trade: { code: string; name_fr: string; name_en: string } | null
  } | null
}

// Helper to normalize query result to UserWithRole
export function normalizeUser(raw: UserQueryResult): UserWithRole {
  return {
    ...raw,
    role: raw.role?.[0] ?? null,
    manager: raw.manager?.[0] ?? null,
    person: raw.person?.[0] ?? null,
  }
}

export type RoleWithPermissions = {
  id: string
  name: string
  description: string | null
  permissions: { id: string; code: string; description: string | null; category: string | null }[]
}

// ============================================
// CONTACT TYPES
// ============================================

// Contact type from people table
export type ContactType = 'employee' | 'client_contact' | 'subcontractor' | 'external'

// Contact data returned from getContacts
export type Contact = {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  title: string | null
  contact_type: ContactType | null
  is_primary: boolean | null
  is_active: boolean | null
  created_at: string | null
  // For client contacts - the linked client
  client: { id: string; code: string; name: string } | null
}

// Raw type from Supabase query
export type ContactQueryResult = {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  title: string | null
  contact_type: ContactType | null
  is_primary: boolean | null
  is_active: boolean | null
  created_at: string | null
  client: { id: string; code: string; name: string }[] | null
}

// Helper to normalize contact query result
export function normalizeContact(raw: ContactQueryResult): Contact {
  return {
    ...raw,
    client: raw.client?.[0] ?? null,
  }
}

// ============================================
// EMPLOYEE 360 TYPES
// ============================================

export type Employee360Timesheet = {
  id: string
  week_start: string
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'locked'
  total_hours: number
}

export type Employee360Expense = {
  id: string
  week_start: string
  status: 'draft' | 'submitted' | 'approved' | 'rejected'
  total_amount: number
  entry_count: number
}

export type Employee360SkillLevel = {
  id: string
  code: string
  name_en: string
  name_fr: string
  hourly_rate: number
}

export type Employee360Profile = {
  id: string
  email: string
  first_name: string
  last_name: string
  phone: string | null
  is_active: boolean | null
  role_id: string | null
  manager_id: string | null
  created_at: string | null
  role: { id: string; name: string } | null
  manager: { id: string; first_name: string; last_name: string } | null
  person: {
    id: string
    address: string | null
    city: string | null
    postal_code: string | null
    skill_level: Employee360SkillLevel | null
  } | null
}

export type Employee360Data = {
  profile: Employee360Profile
  timesheets: Employee360Timesheet[]
  expenses: Employee360Expense[]
  summary: {
    hoursThisMonth: number
    expensesThisMonth: number
  }
  /** Billing classification and rate override data */
  billing?: {
    currentClassification: (EmployeeClassification & { classification?: CcqClassification }) | null
    tradeInfo: CcqTrade | null
    activeRateOverrides: EmployeeRateOverride[]
    classificationHistory: (EmployeeClassification & { classification?: CcqClassification })[]
  }
}

// ============================================
// INVITATION TYPES
// ============================================

export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked'

export type InvitationWithRelations = {
  id: string
  email: string
  token: string
  status: InvitationStatus
  expires_at: string
  accepted_at: string | null
  created_at: string | null
  role: { id: string; name: string } | null
  invited_by_user: { id: string; first_name: string; last_name: string } | null
  accepted_by_user: { id: string; first_name: string; last_name: string } | null
}

// Raw type from Supabase query
export type InvitationQueryResult = {
  id: string
  email: string
  token: string
  status: InvitationStatus
  expires_at: string
  accepted_at: string | null
  created_at: string | null
  role: { id: string; name: string }[] | null
  invited_by_user: { id: string; first_name: string; last_name: string }[] | null
  accepted_by_user: { id: string; first_name: string; last_name: string }[] | null
}

export function normalizeInvitation(raw: InvitationQueryResult): InvitationWithRelations {
  return {
    ...raw,
    role: raw.role?.[0] ?? null,
    invited_by_user: raw.invited_by_user?.[0] ?? null,
    accepted_by_user: raw.accepted_by_user?.[0] ?? null,
  }
}

// ============================================
// DOCUMENT TYPES
// ============================================

export type CcqCardStatus = 'valid' | 'expiring_soon' | 'expired' | 'missing'

export type EmployeeDocumentRow = {
  id: string
  first_name: string
  last_name: string
  email: string
  ccq_card_number: string | null
  ccq_card_expiry: string | null
  ccq_card_url: string | null
  ccq_card_status: CcqCardStatus
  days_until_expiry: number | null
}

export type DocumentsSummary = {
  total: number
  valid: number
  expiringSoon: number
  expired: number
  missing: number
}
