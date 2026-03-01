'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserPermissions, hasPermission } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { logAudit } from '@/lib/audit'
import type { Json } from '@/types/database'
import {
  userUpdateSchema,
  companyInfoSchema,
  DEFAULT_COMPANY_INFO,
  type CompanyInfo,
} from '@/lib/validations/admin'

// Re-export types that components need (types are fine in use server files)
export type { CompanyInfo } from '@/lib/validations/admin'

// ============================================
// AUDIT LOGS
// ============================================

// Raw type from Supabase query (arrays for joins)
type AuditLogQueryResult = {
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
function normalizeAuditLog(raw: AuditLogQueryResult): AuditLogWithUser {
  return {
    ...raw,
    user: raw.user?.[0] ?? null,
  }
}

/**
 * Get audit logs with optional filters
 */
export async function getAuditLogs(options?: {
  action?: string
  entityType?: string
  userId?: string
  dateFrom?: string
  dateTo?: string
  search?: string
  limit?: number
  offset?: number
}): Promise<{ logs: AuditLogWithUser[]; count: number }> {
  const supabase = await createClient()
  const { action, entityType, userId, dateFrom, dateTo, search, limit = 25, offset = 0 } = options ?? {}

  // Check permission
  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'admin.manage')) {
    return { logs: [], count: 0 }
  }

  let query = supabase
    .from('audit_logs')
    .select(
      `
      id,
      action,
      entity_type,
      entity_id,
      old_values,
      new_values,
      ip_address,
      user_agent,
      created_at,
      user_id,
      user:profiles!audit_logs_user_id_fkey(id, first_name, last_name, email)
    `,
      { count: 'exact' }
    )

  // Filter by action
  if (action) {
    query = query.eq('action', action)
  }

  // Filter by entity type
  if (entityType) {
    query = query.eq('entity_type', entityType)
  }

  // Filter by user who performed the action
  if (userId) {
    query = query.eq('user_id', userId)
  }

  // Date range filters
  if (dateFrom) {
    query = query.gte('created_at', dateFrom)
  }
  if (dateTo) {
    // Add 1 day to include the entire end date
    const endDate = new Date(dateTo)
    endDate.setDate(endDate.getDate() + 1)
    query = query.lt('created_at', endDate.toISOString())
  }

  // Search in entity_id
  if (search) {
    query = query.ilike('entity_id', `%${search}%`)
  }

  // Pagination & order (most recent first)
  query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1)

  const { data, count, error } = await query

  if (error) {
    console.error('Error fetching audit logs:', error)
    return { logs: [], count: 0 }
  }

  const logs = (data as AuditLogQueryResult[]).map(normalizeAuditLog)
  return { logs, count: count ?? 0 }
}

/**
 * Get list of users who have performed audited actions (for filter dropdown)
 */
export async function getAuditLogUsers(): Promise<{ id: string; first_name: string; last_name: string; email: string }[]> {
  const supabase = await createClient()

  // Check permission
  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'admin.manage')) {
    return []
  }

  // Get distinct user IDs from audit logs
  const { data: auditUsers, error: auditError } = await supabase
    .from('audit_logs')
    .select('user_id')
    .not('user_id', 'is', null)

  if (auditError || !auditUsers) {
    console.error('Error fetching audit log users:', auditError)
    return []
  }

  // Get unique user IDs
  const userIds = [...new Set(auditUsers.map(a => a.user_id).filter(Boolean))]

  if (userIds.length === 0) {
    return []
  }

  // Fetch user details
  const { data: users, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email')
    .in('id', userIds)
    .order('last_name')
    .order('first_name')

  if (error) {
    console.error('Error fetching users:', error)
    return []
  }

  return users ?? []
}

// ============================================
// USER MANAGEMENT
// ============================================

// Raw type from Supabase query (arrays for joins)
type UserQueryResult = {
  id: string
  email: string
  first_name: string
  last_name: string
  phone: string | null
  is_active: boolean | null
  role_id: string | null
  manager_id: string | null
  created_at: string | null
  role: { id: string; name: string }[] | null
  manager: { id: string; first_name: string; last_name: string }[] | null
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
  created_at: string | null
  role: { id: string; name: string } | null
  manager: { id: string; first_name: string; last_name: string } | null
}

// Helper to normalize query result to UserWithRole
function normalizeUser(raw: UserQueryResult): UserWithRole {
  return {
    ...raw,
    role: raw.role?.[0] ?? null,
    manager: raw.manager?.[0] ?? null,
  }
}

export type RoleWithPermissions = {
  id: string
  name: string
  description: string | null
  permissions: { id: string; code: string; description: string | null; category: string | null }[]
}

/**
 * Get all users with their roles
 */
export async function getUsers(options?: {
  search?: string
  showInactive?: boolean
  roleId?: string
  limit?: number
  offset?: number
}): Promise<{ users: UserWithRole[]; count: number }> {
  const supabase = await createClient()
  const { search, showInactive = false, roleId, limit = 25, offset = 0 } = options ?? {}

  // Check permission
  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'admin.manage')) {
    return { users: [], count: 0 }
  }

  let query = supabase
    .from('profiles')
    .select(
      `
      id,
      email,
      first_name,
      last_name,
      phone,
      is_active,
      role_id,
      manager_id,
      created_at,
      role:roles(id, name),
      manager:profiles!profiles_manager_id_fkey(id, first_name, last_name)
    `,
      { count: 'exact' }
    )

  // Filter inactive unless requested
  if (!showInactive) {
    query = query.eq('is_active', true)
  }

  // Filter by role
  if (roleId) {
    query = query.eq('role_id', roleId)
  }

  // Search filter
  if (search) {
    query = query.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`
    )
  }

  // Pagination & order
  query = query.order('last_name').order('first_name').range(offset, offset + limit - 1)

  const { data, count, error } = await query

  if (error) {
    console.error('Error fetching users:', error)
    return { users: [], count: 0 }
  }

  const users = (data as UserQueryResult[]).map(normalizeUser)
  return { users, count: count ?? 0 }
}

/**
 * Get a single user by ID
 */
export async function getUser(id: string): Promise<UserWithRole | null> {
  const supabase = await createClient()

  // Check permission
  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'admin.manage')) {
    return null
  }

  const { data, error } = await supabase
    .from('profiles')
    .select(
      `
      id,
      email,
      first_name,
      last_name,
      phone,
      is_active,
      role_id,
      manager_id,
      created_at,
      role:roles(id, name),
      manager:profiles!profiles_manager_id_fkey(id, first_name, last_name)
    `
    )
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching user:', error)
    return null
  }

  return normalizeUser(data as UserQueryResult)
}

/**
 * Update user profile
 */
export async function updateUser(id: string, formData: FormData) {
  const supabase = await createClient()

  // Check permission
  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'admin.manage')) {
    return { error: 'You do not have permission to update users' }
  }

  // Get old values for audit log
  const { data: oldUser } = await supabase
    .from('profiles')
    .select('first_name, last_name, phone, role_id, manager_id, is_active')
    .eq('id', id)
    .single()

  // Parse form data
  const rawData = {
    first_name: formData.get('first_name') as string,
    last_name: formData.get('last_name') as string,
    phone: (formData.get('phone') as string) || null,
    role_id: (formData.get('role_id') as string) || null,
    manager_id: (formData.get('manager_id') as string) || null,
    is_active: formData.get('is_active') === 'on',
  }

  // Validate
  const validation = userUpdateSchema.safeParse(rawData)
  if (!validation.success) {
    return { error: validation.error.issues[0]?.message ?? 'Validation failed' }
  }

  // Update profile
  const { error } = await supabase
    .from('profiles')
    .update(validation.data)
    .eq('id', id)

  if (error) {
    console.error('Error updating user:', error)
    return { error: 'Failed to update user' }
  }

  // Log audit
  await logAudit({
    action: 'update',
    entityType: 'user',
    entityId: id,
    oldValues: oldUser ?? {},
    newValues: validation.data,
  })

  revalidatePath('/admin/users')
  revalidatePath(`/admin/users/${id}`)

  return { success: true }
}

/**
 * Toggle user active status
 */
export async function toggleUserActive(id: string) {
  const supabase = await createClient()

  // Check permission
  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'admin.manage')) {
    return { error: 'You do not have permission to update users' }
  }

  // Get current status
  const { data: user, error: fetchError } = await supabase
    .from('profiles')
    .select('is_active')
    .eq('id', id)
    .single()

  if (fetchError || !user) {
    return { error: 'User not found' }
  }

  const newStatus = !user.is_active

  // Toggle
  const { error } = await supabase
    .from('profiles')
    .update({ is_active: newStatus })
    .eq('id', id)

  if (error) {
    console.error('Error toggling user status:', error)
    return { error: 'Failed to update user status' }
  }

  // Log audit
  await logAudit({
    action: 'update',
    entityType: 'user',
    entityId: id,
    oldValues: { is_active: user.is_active },
    newValues: { is_active: newStatus },
  })

  revalidatePath('/admin/users')
  revalidatePath(`/admin/users/${id}`)

  return { success: true, is_active: newStatus }
}

/**
 * Send password reset email to user
 */
export async function sendPasswordReset(email: string) {
  const supabase = await createClient()

  // Check permission
  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'admin.manage')) {
    return { error: 'You do not have permission to send password resets' }
  }

  // Send password reset email via Supabase Auth
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password`,
  })

  if (error) {
    console.error('Error sending password reset:', error)
    return { error: 'Failed to send password reset email' }
  }

  // Log audit
  await logAudit({
    action: 'send',
    entityType: 'password_reset',
    entityId: null,
    newValues: { email },
  })

  return { success: true }
}

// ============================================
// ROLES & PERMISSIONS
// ============================================

/**
 * Get all roles
 */
export async function getRoles(): Promise<{ id: string; name: string; description: string | null }[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('roles')
    .select('id, name, description')
    .order('name')

  if (error) {
    console.error('Error fetching roles:', error)
    return []
  }

  return data ?? []
}

/**
 * Get all roles with their permissions
 */
export async function getRolesWithPermissions(): Promise<RoleWithPermissions[]> {
  const supabase = await createClient()

  // Check permission
  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'admin.manage')) {
    return []
  }

  // Get roles
  const { data: roles, error: rolesError } = await supabase
    .from('roles')
    .select('id, name, description')
    .order('name')

  if (rolesError || !roles) {
    console.error('Error fetching roles:', rolesError)
    return []
  }

  // Get all permissions
  const { data: allPermissions, error: permError } = await supabase
    .from('permissions')
    .select('id, code, description, category')
    .order('category')
    .order('code')

  if (permError) {
    console.error('Error fetching permissions:', permError)
    return []
  }

  // Get role_permissions mappings
  const { data: rolePermissions, error: rpError } = await supabase
    .from('role_permissions')
    .select('role_id, permission_id')

  if (rpError) {
    console.error('Error fetching role_permissions:', rpError)
    return []
  }

  // Build result
  const result: RoleWithPermissions[] = roles.map((role) => {
    const permissionIds = rolePermissions
      ?.filter((rp) => rp.role_id === role.id)
      .map((rp) => rp.permission_id) ?? []

    const permissions = allPermissions
      ?.filter((p) => permissionIds.includes(p.id)) ?? []

    return {
      ...role,
      permissions,
    }
  })

  return result
}

/**
 * Get all permissions grouped by category
 */
export async function getPermissionsByCategory(): Promise<
  Record<string, { id: string; code: string; description: string | null }[]>
> {
  const supabase = await createClient()

  // Check permission
  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'admin.manage')) {
    return {}
  }

  const { data, error } = await supabase
    .from('permissions')
    .select('id, code, description, category')
    .order('category')
    .order('code')

  if (error) {
    console.error('Error fetching permissions:', error)
    return {}
  }

  // Group by category
  const grouped: Record<string, { id: string; code: string; description: string | null }[]> = {}
  for (const perm of data ?? []) {
    const category = perm.category ?? 'Other'
    if (!grouped[category]) {
      grouped[category] = []
    }
    grouped[category].push({
      id: perm.id,
      code: perm.code,
      description: perm.description,
    })
  }

  return grouped
}

/**
 * Get company settings from database
 */
export async function getCompanySettings(): Promise<CompanyInfo> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'company_info')
    .single()

  if (error || !data) {
    console.log('No company settings found, using defaults')
    return DEFAULT_COMPANY_INFO
  }

  // Merge with defaults to ensure all fields exist
  return { ...DEFAULT_COMPANY_INFO, ...(data.value as Partial<CompanyInfo>) }
}

/**
 * Update company settings
 */
export async function updateCompanySettings(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Check admin permission
  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'admin.manage')) {
    return { error: 'You do not have permission to update settings' }
  }

  // Get old values for audit log
  const oldSettings = await getCompanySettings()

  // Parse form data
  const rawData = {
    name: formData.get('name') as string,
    address: formData.get('address') as string,
    city: formData.get('city') as string,
    province: formData.get('province') as string,
    postalCode: formData.get('postalCode') as string,
    phone: formData.get('phone') as string,
    email: formData.get('email') as string,
    gstNumber: formData.get('gstNumber') as string,
    qstNumber: formData.get('qstNumber') as string,
    logoUrl: (formData.get('logoUrl') as string) || null,
  }

  // Validate
  const validation = companyInfoSchema.safeParse(rawData)
  if (!validation.success) {
    return { error: validation.error.issues[0]?.message ?? 'Validation failed' }
  }

  // Upsert settings
  const { error } = await supabase.from('settings').upsert({
    key: 'company_info',
    value: validation.data,
    description: 'Company information for invoices',
    updated_by: user.id,
  })

  if (error) {
    console.error('Error updating company settings:', error)
    return { error: 'Failed to save settings' }
  }

  // Log audit
  await logAudit({
    action: 'update',
    entityType: 'settings',
    entityId: 'company_info',
    oldValues: oldSettings,
    newValues: validation.data,
  })

  revalidatePath('/admin')
  // Also revalidate PDF routes since they use company info
  revalidatePath('/api/invoices/[id]/pdf', 'page')

  return { success: true }
}

/**
 * Upload company logo to Supabase Storage
 */
export async function uploadLogo(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'admin.manage')) {
    return { error: 'You do not have permission to upload logo' }
  }

  const file = formData.get('logo') as File
  if (!file || file.size === 0) {
    return { error: 'No file provided' }
  }

  // Validate file type
  const allowedTypes = ['image/png', 'image/jpeg', 'image/svg+xml']
  if (!allowedTypes.includes(file.type)) {
    return { error: 'Invalid file type. Please upload PNG, JPG, or SVG.' }
  }

  // Validate file size (2MB max)
  if (file.size > 2 * 1024 * 1024) {
    return { error: 'File too large. Maximum size is 2MB.' }
  }

  // Get file extension
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
  const fileName = `logos/company-logo.${ext}`

  // Convert File to ArrayBuffer for upload
  const arrayBuffer = await file.arrayBuffer()
  const fileBuffer = new Uint8Array(arrayBuffer)

  // Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from('company-assets')
    .upload(fileName, fileBuffer, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: true,
    })

  if (error) {
    console.error('Error uploading logo:', error)
    return { error: 'Failed to upload logo: ' + error.message }
  }

  // Get public URL
  const {
    data: { publicUrl },
  } = supabase.storage.from('company-assets').getPublicUrl(fileName)

  // Update settings with logo URL
  const currentSettings = await getCompanySettings()
  const oldLogoUrl = currentSettings.logoUrl
  await supabase.from('settings').upsert({
    key: 'company_info',
    value: { ...currentSettings, logoUrl: publicUrl },
    description: 'Company information for invoices',
    updated_by: user.id,
  })

  // Log audit
  await logAudit({
    action: 'upload',
    entityType: 'logo',
    entityId: 'company_logo',
    oldValues: oldLogoUrl ? { logoUrl: oldLogoUrl } : {},
    newValues: { logoUrl: publicUrl },
  })

  revalidatePath('/admin')

  return { success: true, logoUrl: publicUrl }
}

/**
 * Delete company logo from Supabase Storage
 */
// ============================================
// EMPLOYEE 360 VIEW
// ============================================

// Types for Employee 360° view
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
}

/**
 * Get Employee 360° view data
 * Fetches profile with skill level, recent timesheets, and recent expenses
 */
export async function getEmployee360(userId: string): Promise<Employee360Data | null> {
  const supabase = await createClient()

  // Check permission
  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'admin.manage')) {
    return null
  }

  // Fetch user profile with person and skill level
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select(`
      id,
      email,
      first_name,
      last_name,
      phone,
      is_active,
      role_id,
      manager_id,
      created_at,
      role:roles(id, name),
      manager:profiles!profiles_manager_id_fkey(id, first_name, last_name),
      person:people(
        id,
        address,
        city,
        postal_code,
        skill_level:skill_levels(id, code, name_en, name_fr, hourly_rate)
      )
    `)
    .eq('id', userId)
    .single()

  if (profileError || !profileData) {
    console.error('Error fetching employee profile:', profileError)
    return null
  }

  // Helper to unwrap Supabase array relations
  const unwrap = <T>(val: T | T[] | null): T | null => {
    if (Array.isArray(val)) return val[0] ?? null
    return val
  }

  // Normalize the profile data (Supabase returns arrays for relations)
  const rawRole = unwrap(profileData.role as { id: string; name: string } | { id: string; name: string }[] | null)
  const rawManager = unwrap(profileData.manager as { id: string; first_name: string; last_name: string } | { id: string; first_name: string; last_name: string }[] | null)

  // Handle nested person -> skill_level
  type RawPerson = {
    id: string
    address: string | null
    city: string | null
    postal_code: string | null
    skill_level: Employee360SkillLevel | Employee360SkillLevel[] | null
  }
  const rawPerson = unwrap(profileData.person as RawPerson | RawPerson[] | null)

  let normalizedPerson: Employee360Profile['person'] = null
  if (rawPerson) {
    normalizedPerson = {
      id: rawPerson.id,
      address: rawPerson.address,
      city: rawPerson.city,
      postal_code: rawPerson.postal_code,
      skill_level: unwrap(rawPerson.skill_level),
    }
  }

  const profile: Employee360Profile = {
    id: profileData.id,
    email: profileData.email,
    first_name: profileData.first_name,
    last_name: profileData.last_name,
    phone: profileData.phone,
    is_active: profileData.is_active,
    role_id: profileData.role_id,
    manager_id: profileData.manager_id,
    created_at: profileData.created_at,
    role: rawRole,
    manager: rawManager,
    person: normalizedPerson,
  }

  // Calculate date range for last 8 weeks
  const eightWeeksAgo = new Date()
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56)
  const eightWeeksAgoStr = eightWeeksAgo.toISOString().split('T')[0]

  // Fetch recent timesheets with total hours
  const { data: timesheetsData, error: timesheetsError } = await supabase
    .from('timesheets')
    .select(`
      id,
      week_start,
      status,
      entries:timesheet_entries(hours)
    `)
    .eq('user_id', userId)
    .gte('week_start', eightWeeksAgoStr)
    .order('week_start', { ascending: false })

  if (timesheetsError) {
    console.error('Error fetching timesheets:', timesheetsError)
  }

  // Calculate total hours for each timesheet
  const timesheets: Employee360Timesheet[] = (timesheetsData ?? []).map((ts) => {
    const entries = ts.entries as { hours: number[] }[] | null
    let totalHours = 0
    if (entries) {
      for (const entry of entries) {
        if (entry.hours) {
          totalHours += entry.hours.reduce((sum, h) => sum + (h || 0), 0)
        }
      }
    }
    return {
      id: ts.id,
      week_start: ts.week_start,
      status: ts.status as Employee360Timesheet['status'],
      total_hours: totalHours,
    }
  })

  // Fetch recent expenses with totals
  const { data: expensesData, error: expensesError } = await supabase
    .from('expenses')
    .select(`
      id,
      week_start,
      status,
      entries:expense_entries(total)
    `)
    .eq('user_id', userId)
    .order('week_start', { ascending: false })
    .limit(10)

  if (expensesError) {
    console.error('Error fetching expenses:', expensesError)
  }

  // Calculate total amount for each expense report
  const expenses: Employee360Expense[] = (expensesData ?? []).map((exp) => {
    const entries = exp.entries as { total: number }[] | null
    let totalAmount = 0
    let entryCount = 0
    if (entries) {
      entryCount = entries.length
      for (const entry of entries) {
        totalAmount += entry.total || 0
      }
    }
    return {
      id: exp.id,
      week_start: exp.week_start,
      status: exp.status as Employee360Expense['status'],
      total_amount: totalAmount,
      entry_count: entryCount,
    }
  })

  // Calculate this month's totals
  const now = new Date()
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const firstDayOfMonthStr = firstDayOfMonth.toISOString().split('T')[0]

  let hoursThisMonth = 0
  for (const ts of timesheets) {
    if (ts.week_start >= firstDayOfMonthStr) {
      hoursThisMonth += ts.total_hours
    }
  }

  let expensesThisMonth = 0
  for (const exp of expenses) {
    if (exp.week_start >= firstDayOfMonthStr) {
      expensesThisMonth += exp.total_amount
    }
  }

  return {
    profile,
    timesheets,
    expenses,
    summary: {
      hoursThisMonth,
      expensesThisMonth,
    },
  }
}

export async function deleteLogo() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'admin.manage')) {
    return { error: 'You do not have permission to delete logo' }
  }

  // Get current settings to find logo path
  const settings = await getCompanySettings()
  if (!settings.logoUrl) {
    return { success: true } // No logo to delete
  }

  // Extract file path from URL
  const urlParts = settings.logoUrl.split('/company-assets/')
  if (urlParts.length > 1) {
    const filePath = urlParts[1]
    await supabase.storage.from('company-assets').remove([filePath])
  }

  // Update settings to remove logo URL
  const oldLogoUrl = settings.logoUrl
  await supabase.from('settings').upsert({
    key: 'company_info',
    value: { ...settings, logoUrl: null },
    description: 'Company information for invoices',
    updated_by: user.id,
  })

  // Log audit
  await logAudit({
    action: 'delete',
    entityType: 'logo',
    entityId: 'company_logo',
    oldValues: { logoUrl: oldLogoUrl },
    newValues: { logoUrl: null },
  })

  revalidatePath('/admin')

  return { success: true }
}
