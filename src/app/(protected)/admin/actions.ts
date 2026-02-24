'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserPermissions, hasPermission } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

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
