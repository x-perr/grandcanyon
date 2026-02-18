import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Tables } from '@/types/database'

// Extended profile type with nested relations
export type ProfileWithRole = Tables<'profiles'> & {
  role: (Tables<'roles'> & {
    role_permissions: Array<{
      permission: { code: string } | null
    }>
  }) | null
}

/**
 * Get the currently authenticated user from Supabase Auth
 */
export async function getCurrentUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  return user
}

/**
 * Require authentication - redirects to /login if not authenticated
 */
export async function requireAuth() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  return user
}

/**
 * Get the user's profile with role and permissions
 */
export async function getProfile(): Promise<ProfileWithRole | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select(`
      *,
      role:roles(
        *,
        role_permissions(
          permission:permissions(code)
        )
      )
    `)
    .eq('id', user.id)
    .single()

  return profile as ProfileWithRole | null
}

/**
 * Get array of permission codes for the current user
 */
export async function getUserPermissions(): Promise<string[]> {
  const profile = await getProfile()

  if (!profile?.role?.role_permissions) return []

  return profile.role.role_permissions
    .map(rp => rp.permission?.code)
    .filter((code): code is string => Boolean(code))
}

/**
 * Check if user has a specific permission
 */
export function hasPermission(permissions: string[], required: string): boolean {
  return permissions.includes(required)
}

/**
 * Check if user has any of the specified permissions
 */
export function hasAnyPermission(permissions: string[], required: string[]): boolean {
  return required.some(p => permissions.includes(p))
}
