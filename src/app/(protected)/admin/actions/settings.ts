'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserPermissions, hasPermission } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { logAudit } from '@/lib/audit'
import {
  companyInfoSchema,
  DEFAULT_COMPANY_INFO,
  type CompanyInfo,
} from '@/lib/validations/admin'
import { billingSettingsSchema } from '@/lib/validations/billing'
import type { BillingSettings } from '@/types/billing'

// Default billing settings (fallback when no DB row exists)
const DEFAULT_BILLING_SETTINGS: BillingSettings = {
  default_rate_tier_id: null,
  rate_tier_versioning: 'annual_may',
  ot_default_mode: 'standard',
  ot_standard_multiplier_1_5x: 1.5,
  ot_standard_multiplier_2x: 2.0,
  ot_custom_multiplier_1_5x: null,
  ot_custom_multiplier_2x: null,
  ot_approval_default: 'per_instance',
  retainage_default_percent: 10,
  retainage_on_subtotal: true,
  retainage_hold_days: 45,
  learning_phase_default_weeks: 2,
  learning_phase_alert_days: 3,
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

// ============================================================
// Billing Settings
// ============================================================

/**
 * Get billing settings from database
 */
export async function getBillingSettings(): Promise<BillingSettings> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'billing_settings')
    .single()

  if (error || !data) {
    return DEFAULT_BILLING_SETTINGS
  }

  // Merge with defaults to ensure all fields exist
  return { ...DEFAULT_BILLING_SETTINGS, ...(data.value as Partial<BillingSettings>) }
}

/**
 * Update billing settings
 */
export async function updateBillingSettings(formData: FormData) {
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
    return { error: 'You do not have permission to update billing settings' }
  }

  // Get old values for audit log
  const oldSettings = await getBillingSettings()

  // Parse form data
  const rawData = {
    default_rate_tier_id: (formData.get('default_rate_tier_id') as string) || null,
    rate_tier_versioning: formData.get('rate_tier_versioning') as string,
    ot_default_mode: formData.get('ot_default_mode') as string,
    ot_standard_multiplier_1_5x: formData.get('ot_standard_multiplier_1_5x'),
    ot_standard_multiplier_2x: formData.get('ot_standard_multiplier_2x'),
    ot_custom_multiplier_1_5x: formData.get('ot_custom_multiplier_1_5x') || null,
    ot_custom_multiplier_2x: formData.get('ot_custom_multiplier_2x') || null,
    ot_approval_default: formData.get('ot_approval_default') as string,
    retainage_default_percent: formData.get('retainage_default_percent'),
    retainage_on_subtotal: formData.get('retainage_on_subtotal') === 'true',
    retainage_hold_days: formData.get('retainage_hold_days'),
    learning_phase_default_weeks: formData.get('learning_phase_default_weeks'),
    learning_phase_alert_days: formData.get('learning_phase_alert_days'),
  }

  // Validate
  const validation = billingSettingsSchema.safeParse(rawData)
  if (!validation.success) {
    return { error: validation.error.issues[0]?.message ?? 'Validation failed' }
  }

  // Upsert settings
  const { error } = await supabase.from('settings').upsert({
    key: 'billing_settings',
    value: validation.data,
    description: 'Billing configuration',
    updated_by: user.id,
  })

  if (error) {
    console.error('Error updating billing settings:', error)
    return { error: 'Failed to save billing settings' }
  }

  // Log audit
  await logAudit({
    action: 'update',
    entityType: 'settings',
    entityId: 'billing_settings',
    oldValues: oldSettings as unknown as Record<string, unknown>,
    newValues: validation.data as unknown as Record<string, unknown>,
  })

  revalidatePath('/admin')

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
