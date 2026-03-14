'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserPermissions, hasPermission } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { logAudit } from '@/lib/audit'
import { z } from 'zod'
import type { CcqTrade, CcqClassification, CcqRate } from '@/types/billing'

// ============================================================
// Validation
// ============================================================

const ccqRateSchema = z.object({
  classification_id: z.string().uuid('Invalid classification'),
  effective_from: z.string().min(1, 'Effective date is required'),
  effective_to: z.string().optional().nullable(),
  hourly_rate: z.coerce
    .number()
    .min(0, 'Rate must be positive')
    .max(999.99, 'Rate too high'),
  vacation_percent: z.coerce.number().min(0).max(100).optional().nullable(),
  benefit_rate: z.coerce
    .number()
    .min(0)
    .max(999.99)
    .optional()
    .nullable(),
  total_hourly_cost: z.coerce
    .number()
    .min(0)
    .max(9999.99)
    .optional()
    .nullable(),
  notes: z.string().max(500).optional().nullable(),
})

// ============================================================
// Trades
// ============================================================

/**
 * Fetch all CCQ trades
 */
export async function getCcqTrades(): Promise<CcqTrade[]> {
  const supabase = await createClient()

  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'admin.manage')) {
    return []
  }

  const { data, error } = await supabase
    .from('ccq_trades')
    .select('*')
    .order('sort_order')

  if (error) {
    console.error('Error fetching CCQ trades:', error)
    return []
  }

  return (data ?? []) as CcqTrade[]
}

// ============================================================
// Classifications
// ============================================================

/**
 * Fetch CCQ classifications, optionally filtered by trade
 */
export async function getCcqClassifications(
  tradeId?: string
): Promise<CcqClassification[]> {
  const supabase = await createClient()

  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'admin.manage')) {
    return []
  }

  let query = supabase
    .from('ccq_classifications')
    .select(`
      *,
      trade:ccq_trades(id, code, name_fr, name_en)
    `)
    .order('sort_order')

  if (tradeId) {
    query = query.eq('trade_id', tradeId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching CCQ classifications:', error)
    return []
  }

  return (data ?? []) as CcqClassification[]
}

// ============================================================
// Rates
// ============================================================

/**
 * Fetch CCQ rates, optionally filtered by classification
 */
export async function getCcqRates(
  classificationId?: string
): Promise<CcqRate[]> {
  const supabase = await createClient()

  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'admin.manage')) {
    return []
  }

  let query = supabase
    .from('ccq_rates')
    .select('*')
    .order('effective_from', { ascending: false })

  if (classificationId) {
    query = query.eq('classification_id', classificationId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching CCQ rates:', error)
    return []
  }

  return (data ?? []) as CcqRate[]
}

/**
 * Create or update a CCQ rate entry
 */
export async function upsertCcqRate(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'admin.manage')) {
    return { error: 'You do not have permission to manage CCQ rates' }
  }

  const rateId = formData.get('id') as string | null

  const rawData = {
    classification_id: formData.get('classification_id') as string,
    effective_from: formData.get('effective_from') as string,
    effective_to: (formData.get('effective_to') as string) || null,
    hourly_rate: formData.get('hourly_rate'),
    vacation_percent: formData.get('vacation_percent') || null,
    benefit_rate: formData.get('benefit_rate') || null,
    total_hourly_cost: formData.get('total_hourly_cost') || null,
    notes: (formData.get('notes') as string) || null,
  }

  const validation = ccqRateSchema.safeParse(rawData)
  if (!validation.success) {
    return { error: validation.error.issues[0]?.message ?? 'Validation failed' }
  }

  if (rateId) {
    // Update existing
    const { data: oldRate } = await supabase
      .from('ccq_rates')
      .select('*')
      .eq('id', rateId)
      .single()

    const { error } = await supabase
      .from('ccq_rates')
      .update(validation.data)
      .eq('id', rateId)

    if (error) {
      console.error('Error updating CCQ rate:', error)
      return { error: 'Failed to update CCQ rate' }
    }

    await logAudit({
      action: 'update',
      entityType: 'settings',
      entityId: rateId,
      oldValues: oldRate ?? undefined,
      newValues: validation.data,
    })
  } else {
    // Create new
    const { data, error } = await supabase
      .from('ccq_rates')
      .insert(validation.data)
      .select('id')
      .single()

    if (error) {
      console.error('Error creating CCQ rate:', error)
      return { error: 'Failed to create CCQ rate' }
    }

    await logAudit({
      action: 'create',
      entityType: 'settings',
      entityId: data.id,
      newValues: validation.data,
    })
  }

  revalidatePath('/admin/ccq-rates')
  return { success: true }
}
