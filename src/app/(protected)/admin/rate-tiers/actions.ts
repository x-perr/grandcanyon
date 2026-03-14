'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserPermissions, hasPermission } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { logAudit } from '@/lib/audit'
import {
  rateTierSchema,
  rateTierLineSchema,
  clientRateTierSchema,
} from '@/lib/validations/billing'
import type { RateTier, RateTierLine, ClientRateTier } from '@/types/billing'

// ============================================================
// Rate Tiers
// ============================================================

/**
 * Fetch all rate tiers with their lines and classification names
 */
export async function getRateTiers(): Promise<RateTier[]> {
  const supabase = await createClient()

  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'admin.manage')) {
    return []
  }

  const { data, error } = await supabase
    .from('rate_tiers')
    .select(`
      *,
      lines:rate_tier_lines(
        *,
        classification:ccq_classifications(
          id, level, name_fr, name_en, sort_order,
          trade:ccq_trades(id, code, name_fr, name_en)
        )
      )
    `)
    .order('is_default', { ascending: false })
    .order('name')

  if (error) {
    console.error('Error fetching rate tiers:', error)
    return []
  }

  return (data ?? []) as RateTier[]
}

/**
 * Fetch a single rate tier with full details
 */
export async function getRateTier(id: string): Promise<RateTier | null> {
  const supabase = await createClient()

  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'admin.manage')) {
    return null
  }

  const { data, error } = await supabase
    .from('rate_tiers')
    .select(`
      *,
      lines:rate_tier_lines(
        *,
        classification:ccq_classifications(
          id, level, name_fr, name_en, sort_order,
          trade:ccq_trades(id, code, name_fr, name_en)
        )
      )
    `)
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching rate tier:', error)
    return null
  }

  return data as RateTier
}

/**
 * Create a new rate tier
 */
export async function createRateTier(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'admin.manage')) {
    return { error: 'You do not have permission to manage rate tiers' }
  }

  const rawData = {
    name: formData.get('name') as string,
    code: formData.get('code') as string,
    description: (formData.get('description') as string) || null,
    is_default: formData.get('is_default') === 'true',
    is_active: formData.get('is_active') !== 'false',
  }

  const validation = rateTierSchema.safeParse(rawData)
  if (!validation.success) {
    return { error: validation.error.issues[0]?.message ?? 'Validation failed' }
  }

  // If setting as default, clear other defaults first
  if (validation.data.is_default) {
    await supabase
      .from('rate_tiers')
      .update({ is_default: false })
      .eq('is_default', true)
  }

  const { data, error } = await supabase
    .from('rate_tiers')
    .insert(validation.data)
    .select('id')
    .single()

  if (error) {
    console.error('Error creating rate tier:', error)
    return { error: 'Failed to create rate tier' }
  }

  await logAudit({
    action: 'create',
    entityType: 'settings',
    entityId: data.id,
    newValues: validation.data,
  })

  revalidatePath('/admin/rate-tiers')
  return { success: true, id: data.id }
}

/**
 * Update an existing rate tier
 */
export async function updateRateTier(id: string, formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'admin.manage')) {
    return { error: 'You do not have permission to manage rate tiers' }
  }

  // Get old values for audit
  const { data: oldTier } = await supabase
    .from('rate_tiers')
    .select('*')
    .eq('id', id)
    .single()

  const rawData = {
    name: formData.get('name') as string,
    code: formData.get('code') as string,
    description: (formData.get('description') as string) || null,
    is_default: formData.get('is_default') === 'true',
    is_active: formData.get('is_active') !== 'false',
  }

  const validation = rateTierSchema.safeParse(rawData)
  if (!validation.success) {
    return { error: validation.error.issues[0]?.message ?? 'Validation failed' }
  }

  // If setting as default, clear other defaults first
  if (validation.data.is_default && !oldTier?.is_default) {
    await supabase
      .from('rate_tiers')
      .update({ is_default: false })
      .eq('is_default', true)
  }

  const { error } = await supabase
    .from('rate_tiers')
    .update(validation.data)
    .eq('id', id)

  if (error) {
    console.error('Error updating rate tier:', error)
    return { error: 'Failed to update rate tier' }
  }

  await logAudit({
    action: 'update',
    entityType: 'settings',
    entityId: id,
    oldValues: oldTier ?? undefined,
    newValues: validation.data,
  })

  revalidatePath('/admin/rate-tiers')
  return { success: true }
}

/**
 * Delete a rate tier (only if no clients are assigned)
 */
export async function deleteRateTier(id: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'admin.manage')) {
    return { error: 'You do not have permission to manage rate tiers' }
  }

  // Check if any clients are assigned to this tier
  const { count } = await supabase
    .from('client_rate_tiers')
    .select('id', { count: 'exact', head: true })
    .eq('tier_id', id)

  if (count && count > 0) {
    return { error: 'Cannot delete tier with assigned clients. Remove client assignments first.' }
  }

  // Get old values for audit
  const { data: oldTier } = await supabase
    .from('rate_tiers')
    .select('*')
    .eq('id', id)
    .single()

  // Delete lines first, then the tier
  await supabase
    .from('rate_tier_lines')
    .delete()
    .eq('tier_id', id)

  const { error } = await supabase
    .from('rate_tiers')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting rate tier:', error)
    return { error: 'Failed to delete rate tier' }
  }

  await logAudit({
    action: 'delete',
    entityType: 'settings',
    entityId: id,
    oldValues: oldTier ?? undefined,
  })

  revalidatePath('/admin/rate-tiers')
  return { success: true }
}

// ============================================================
// Rate Tier Lines
// ============================================================

/**
 * Get all lines for a rate tier
 */
export async function getRateTierLines(tierId: string): Promise<RateTierLine[]> {
  const supabase = await createClient()

  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'admin.manage')) {
    return []
  }

  const { data, error } = await supabase
    .from('rate_tier_lines')
    .select(`
      *,
      classification:ccq_classifications(
        id, level, name_fr, name_en, sort_order,
        trade:ccq_trades(id, code, name_fr, name_en)
      )
    `)
    .eq('tier_id', tierId)
    .order('effective_date', { ascending: false })

  if (error) {
    console.error('Error fetching rate tier lines:', error)
    return []
  }

  return (data ?? []) as RateTierLine[]
}

/**
 * Create or update a rate tier line
 */
export async function upsertRateTierLine(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'admin.manage')) {
    return { error: 'You do not have permission to manage rate tier lines' }
  }

  const lineId = formData.get('id') as string | null

  const rawData = {
    tier_id: formData.get('tier_id') as string,
    classification_id: formData.get('classification_id') as string,
    hourly_rate: formData.get('hourly_rate'),
    effective_date: formData.get('effective_date') as string,
    notes: (formData.get('notes') as string) || null,
  }

  const validation = rateTierLineSchema.safeParse(rawData)
  if (!validation.success) {
    return { error: validation.error.issues[0]?.message ?? 'Validation failed' }
  }

  if (lineId) {
    // Update existing
    const { data: oldLine } = await supabase
      .from('rate_tier_lines')
      .select('*')
      .eq('id', lineId)
      .single()

    const { error } = await supabase
      .from('rate_tier_lines')
      .update(validation.data)
      .eq('id', lineId)

    if (error) {
      console.error('Error updating rate tier line:', error)
      return { error: 'Failed to update rate tier line' }
    }

    await logAudit({
      action: 'update',
      entityType: 'settings',
      entityId: lineId,
      oldValues: oldLine ?? undefined,
      newValues: validation.data,
    })
  } else {
    // Create new
    const { data, error } = await supabase
      .from('rate_tier_lines')
      .insert(validation.data)
      .select('id')
      .single()

    if (error) {
      console.error('Error creating rate tier line:', error)
      return { error: 'Failed to create rate tier line' }
    }

    await logAudit({
      action: 'create',
      entityType: 'settings',
      entityId: data.id,
      newValues: validation.data,
    })
  }

  revalidatePath('/admin/rate-tiers')
  return { success: true }
}

/**
 * Delete a rate tier line
 */
export async function deleteRateTierLine(id: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'admin.manage')) {
    return { error: 'You do not have permission to manage rate tier lines' }
  }

  const { data: oldLine } = await supabase
    .from('rate_tier_lines')
    .select('*')
    .eq('id', id)
    .single()

  const { error } = await supabase
    .from('rate_tier_lines')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting rate tier line:', error)
    return { error: 'Failed to delete rate tier line' }
  }

  await logAudit({
    action: 'delete',
    entityType: 'settings',
    entityId: id,
    oldValues: oldLine ?? undefined,
  })

  revalidatePath('/admin/rate-tiers')
  return { success: true }
}

// ============================================================
// Client Rate Tier Assignments
// ============================================================

/**
 * Get all client-tier assignments
 */
export async function getClientRateTiers(): Promise<ClientRateTier[]> {
  const supabase = await createClient()

  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'admin.manage')) {
    return []
  }

  const { data, error } = await supabase
    .from('client_rate_tiers')
    .select(`
      *,
      tier:rate_tiers(id, name, code)
    `)
    .order('assigned_at', { ascending: false })

  if (error) {
    console.error('Error fetching client rate tiers:', error)
    return []
  }

  return (data ?? []) as ClientRateTier[]
}

/**
 * Assign a rate tier to a client
 */
export async function assignClientTier(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'admin.manage')) {
    return { error: 'You do not have permission to manage client tier assignments' }
  }

  const rawData = {
    client_id: formData.get('client_id') as string,
    tier_id: formData.get('tier_id') as string,
    notes: (formData.get('notes') as string) || null,
  }

  const validation = clientRateTierSchema.safeParse(rawData)
  if (!validation.success) {
    return { error: validation.error.issues[0]?.message ?? 'Validation failed' }
  }

  // Remove existing assignment if any
  await supabase
    .from('client_rate_tiers')
    .delete()
    .eq('client_id', validation.data.client_id)

  const { data, error } = await supabase
    .from('client_rate_tiers')
    .insert({
      ...validation.data,
      assigned_by: user.id,
    })
    .select('id')
    .single()

  if (error) {
    console.error('Error assigning client tier:', error)
    return { error: 'Failed to assign rate tier to client' }
  }

  await logAudit({
    action: 'create',
    entityType: 'settings',
    entityId: data.id,
    newValues: { ...validation.data, assigned_by: user.id },
  })

  revalidatePath('/admin/rate-tiers')
  return { success: true }
}

/**
 * Remove a client's rate tier assignment
 */
export async function removeClientTier(clientId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'admin.manage')) {
    return { error: 'You do not have permission to manage client tier assignments' }
  }

  const { data: oldAssignment } = await supabase
    .from('client_rate_tiers')
    .select('*')
    .eq('client_id', clientId)
    .single()

  const { error } = await supabase
    .from('client_rate_tiers')
    .delete()
    .eq('client_id', clientId)

  if (error) {
    console.error('Error removing client tier:', error)
    return { error: 'Failed to remove client tier assignment' }
  }

  await logAudit({
    action: 'delete',
    entityType: 'settings',
    entityId: clientId,
    oldValues: oldAssignment ?? undefined,
  })

  revalidatePath('/admin/rate-tiers')
  return { success: true }
}
