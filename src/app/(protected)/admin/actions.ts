'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserPermissions, hasPermission } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

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

// Schema for user update validation
export const userUpdateSchema = z.object({
  first_name: z.string().min(1, 'First name is required').max(50),
  last_name: z.string().min(1, 'Last name is required').max(50),
  phone: z.string().max(20).optional().nullable(),
  role_id: z.string().uuid().optional().nullable(),
  manager_id: z.string().uuid().optional().nullable(),
  is_active: z.boolean().optional(),
})

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

  // Toggle
  const { error } = await supabase
    .from('profiles')
    .update({ is_active: !user.is_active })
    .eq('id', id)

  if (error) {
    console.error('Error toggling user status:', error)
    return { error: 'Failed to update user status' }
  }

  revalidatePath('/admin/users')
  revalidatePath(`/admin/users/${id}`)

  return { success: true, is_active: !user.is_active }
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
  await supabase.from('settings').upsert({
    key: 'company_info',
    value: { ...currentSettings, logoUrl: publicUrl },
    description: 'Company information for invoices',
    updated_by: user.id,
  })

  revalidatePath('/admin')

  return { success: true, logoUrl: publicUrl }
}

/**
 * Delete company logo from Supabase Storage
 */
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
  await supabase.from('settings').upsert({
    key: 'company_info',
    value: { ...settings, logoUrl: null },
    description: 'Company information for invoices',
    updated_by: user.id,
  })

  revalidatePath('/admin')

  return { success: true }
}
