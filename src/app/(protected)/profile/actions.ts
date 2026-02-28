'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getProfile, getUserPermissions, hasPermission, type ProfileWithRole } from '@/lib/auth'

// Schema for profile contact update
const updateContactSchema = z.object({
  phone: z.string().max(50).optional().nullable(),
  extension: z.string().max(10).optional().nullable(),
})

// Schema for password change
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
  confirmPassword: z.string().min(8),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
})

export type ProfileData = ProfileWithRole & {
  manager: { id: string; first_name: string; last_name: string } | null
}

/**
 * Get current user's profile with manager info
 */
export async function getMyProfile(): Promise<ProfileData | null> {
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
      ),
      manager:profiles!profiles_manager_id_fkey(id, first_name, last_name)
    `)
    .eq('id', user.id)
    .single()

  if (!profile) return null

  // Normalize manager (comes as array from join)
  const managerArray = profile.manager as unknown
  const manager = Array.isArray(managerArray) && managerArray.length > 0
    ? managerArray[0] as { id: string; first_name: string; last_name: string }
    : null

  return {
    ...profile,
    manager,
  } as ProfileData
}

/**
 * Update profile contact info
 */
export async function updateProfileContact(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const rawData = {
    phone: formData.get('phone') as string || null,
    extension: formData.get('extension') as string || null,
  }

  const result = updateContactSchema.safeParse(rawData)
  if (!result.success) {
    return { error: result.error.issues[0]?.message || 'Validation failed' }
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      phone: result.data.phone,
      // Note: extension field may not exist in schema - use custom field if needed
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/profile')
  return { success: true }
}

/**
 * Update user's preferred locale
 */
export async function updatePreferredLocale(locale: 'en' | 'fr') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      preferred_locale: locale,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/profile')
  return { success: true }
}

/**
 * Change password
 */
export async function changePassword(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const rawData = {
    currentPassword: formData.get('currentPassword') as string,
    newPassword: formData.get('newPassword') as string,
    confirmPassword: formData.get('confirmPassword') as string,
  }

  const result = changePasswordSchema.safeParse(rawData)
  if (!result.success) {
    return { error: result.error.issues[0]?.message || 'Validation failed' }
  }

  // Verify current password by re-authenticating
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email!,
    password: result.data.currentPassword,
  })

  if (signInError) {
    return { error: 'Current password is incorrect' }
  }

  // Update password
  const { error: updateError } = await supabase.auth.updateUser({
    password: result.data.newPassword,
  })

  if (updateError) {
    return { error: updateError.message }
  }

  return { success: true }
}

/**
 * Check if user can see billing info (admin permission)
 */
export async function canViewBillingInfo(): Promise<boolean> {
  const permissions = await getUserPermissions()
  return hasPermission(permissions, 'admin.manage') || hasPermission(permissions, 'users.view')
}
