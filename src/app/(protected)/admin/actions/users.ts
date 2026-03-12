'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserPermissions, hasPermission } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { logAudit } from '@/lib/audit'
import {
  userUpdateSchema,
} from '@/lib/validations/admin'
import type { UserQueryResult, UserWithRole } from './types'
import { normalizeUser } from './types'

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
      person_id,
      created_at,
      ccq_card_number,
      ccq_card_expiry,
      ccq_card_url,
      ccq_card_uploaded_at,
      role:roles(id, name),
      manager:profiles!profiles_manager_id_fkey(id, first_name, last_name),
      person:people!profiles_person_id_fkey(id, address, city, lat, lng)
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
 * Get employees (field workers)
 * Filters by user_type = 'employee' (not admin, client, or subcontractor)
 */
export async function getEmployees(options?: {
  search?: string
  showInactive?: boolean
  limit?: number
  offset?: number
}): Promise<{ employees: UserWithRole[]; count: number }> {
  const supabase = await createClient()
  const { search, showInactive = false, limit = 25, offset = 0 } = options ?? {}

  // Check permission
  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'admin.manage')) {
    return { employees: [], count: 0 }
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
      person_id,
      created_at,
      role:roles(id, name),
      manager:profiles!profiles_manager_id_fkey(id, first_name, last_name),
      person:people!profiles_person_id_fkey(id, address, city, lat, lng)
    `,
      { count: 'exact' }
    )

  // Filter by user_type = 'employee' (or null, treated as employee for legacy data)
  query = query.or('user_type.eq.employee,user_type.is.null')

  // Filter inactive unless requested
  if (!showInactive) {
    query = query.eq('is_active', true)
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
    console.error('Error fetching employees:', error)
    return { employees: [], count: 0 }
  }

  const employees = (data as UserQueryResult[]).map(normalizeUser)
  return { employees, count: count ?? 0 }
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
      person_id,
      created_at,
      ccq_card_number,
      ccq_card_expiry,
      ccq_card_url,
      ccq_card_uploaded_at,
      role:roles(id, name),
      manager:profiles!profiles_manager_id_fkey(id, first_name, last_name),
      person:people!profiles_person_id_fkey(id, address, city, lat, lng)
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

  // Get old values for audit log (including person data)
  const { data: oldUser } = await supabase
    .from('profiles')
    .select(`
      first_name, last_name, phone, role_id, manager_id, is_active, person_id,
      person:people!profiles_person_id_fkey(address, city)
    `)
    .eq('id', id)
    .single()

  // Parse form data
  const rawData = {
    first_name: formData.get('first_name') as string,
    last_name: formData.get('last_name') as string,
    phone: (formData.get('phone') as string) || null,
    role_id: ((formData.get('role_id') as string) || null) === 'none' ? null : (formData.get('role_id') as string) || null,
    manager_id: ((formData.get('manager_id') as string) || null) === 'none' ? null : (formData.get('manager_id') as string) || null,
    is_active: formData.get('is_active') === 'on',
  }

  // Address data (separate from profile)
  const addressData = {
    address: (formData.get('address') as string) || null,
    city: (formData.get('city') as string) || null,
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

  // Update or create person record for address
  const personId = oldUser?.person_id
  if (personId) {
    // Update existing person record
    const { error: personError } = await supabase
      .from('people')
      .update(addressData)
      .eq('id', personId)

    if (personError) {
      console.error('Error updating person address:', personError)
      // Don't fail the whole operation, just log
    }
  } else if (addressData.address || addressData.city) {
    // Create a new person record and link it
    const { data: newPerson, error: createError } = await supabase
      .from('people')
      .insert({
        first_name: rawData.first_name,
        last_name: rawData.last_name,
        contact_type: 'employee',
        is_active: true,
        ...addressData,
      })
      .select('id')
      .single()

    if (createError) {
      console.error('Error creating person record:', createError)
    } else if (newPerson) {
      // Link the new person to the profile
      await supabase
        .from('profiles')
        .update({ person_id: newPerson.id })
        .eq('id', id)
    }
  }

  // Log audit
  const oldPerson = Array.isArray(oldUser?.person) ? oldUser.person[0] : oldUser?.person
  await logAudit({
    action: 'update',
    entityType: 'user',
    entityId: id,
    oldValues: oldUser ? { ...oldUser, person: oldPerson } : {},
    newValues: { ...validation.data, ...addressData },
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
