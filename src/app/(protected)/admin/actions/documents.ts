'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserPermissions, hasPermission } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { logAudit } from '@/lib/audit'
import type { CcqCardStatus, EmployeeDocumentRow, DocumentsSummary } from './types'

/**
 * Get employee documents summary for admin dashboard
 */
export async function getEmployeeDocuments(options?: {
  status?: CcqCardStatus
  search?: string
  limit?: number
  offset?: number
}): Promise<{ employees: EmployeeDocumentRow[]; summary: DocumentsSummary; count: number }> {
  const supabase = await createClient()
  const { status, search, limit = 50, offset = 0 } = options ?? {}

  // Check permission
  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'admin.manage')) {
    return {
      employees: [],
      summary: { total: 0, valid: 0, expiringSoon: 0, expired: 0, missing: 0 },
      count: 0,
    }
  }

  // Get all active employees
  let query = supabase
    .from('profiles')
    .select(
      `
      id,
      first_name,
      last_name,
      email,
      ccq_card_number,
      ccq_card_expiry,
      ccq_card_url
    `,
      { count: 'exact' }
    )
    .eq('is_active', true)
    .or('user_type.eq.employee,user_type.is.null')

  if (search) {
    query = query.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`
    )
  }

  query = query.order('last_name').order('first_name')

  const { data, count, error } = await query

  if (error) {
    console.error('Error fetching employee documents:', error)
    return {
      employees: [],
      summary: { total: 0, valid: 0, expiringSoon: 0, expired: 0, missing: 0 },
      count: 0,
    }
  }

  const today = new Date()

  // Process employees and calculate status
  const employees: EmployeeDocumentRow[] = (data ?? []).map((emp) => {
    let ccqStatus: CcqCardStatus = 'missing'
    let daysUntilExpiry: number | null = null

    if (emp.ccq_card_url) {
      if (emp.ccq_card_expiry) {
        const expiry = new Date(emp.ccq_card_expiry)
        daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

        if (daysUntilExpiry < 0) {
          ccqStatus = 'expired'
        } else if (daysUntilExpiry <= 30) {
          ccqStatus = 'expiring_soon'
        } else {
          ccqStatus = 'valid'
        }
      } else {
        ccqStatus = 'valid' // Has card but no expiry date
      }
    }

    return {
      id: emp.id,
      first_name: emp.first_name ?? '',
      last_name: emp.last_name ?? '',
      email: emp.email ?? '',
      ccq_card_number: emp.ccq_card_number,
      ccq_card_expiry: emp.ccq_card_expiry,
      ccq_card_url: emp.ccq_card_url,
      ccq_card_status: ccqStatus,
      days_until_expiry: daysUntilExpiry,
    }
  })

  // Filter by status if specified
  const filteredEmployees = status
    ? employees.filter((e) => e.ccq_card_status === status)
    : employees

  // Calculate summary
  const summary: DocumentsSummary = {
    total: employees.length,
    valid: employees.filter((e) => e.ccq_card_status === 'valid').length,
    expiringSoon: employees.filter((e) => e.ccq_card_status === 'expiring_soon').length,
    expired: employees.filter((e) => e.ccq_card_status === 'expired').length,
    missing: employees.filter((e) => e.ccq_card_status === 'missing').length,
  }

  // Apply pagination
  const paginatedEmployees = filteredEmployees.slice(offset, offset + limit)

  return {
    employees: paginatedEmployees,
    summary,
    count: filteredEmployees.length,
  }
}

/**
 * Upload a CCQ card image for an employee
 */
export async function uploadCcqCard(
  userId: string,
  formData: FormData
): Promise<{ error?: string; url?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Check permission - either admin or the user themselves
  const permissions = await getUserPermissions()
  const isAdmin = hasPermission(permissions, 'admin.manage')
  const isSelf = user.id === userId

  if (!isAdmin && !isSelf) {
    return { error: 'You do not have permission to upload CCQ cards for other users' }
  }

  const file = formData.get('file') as File
  if (!file || file.size === 0) {
    return { error: 'No file provided' }
  }

  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  if (!allowedTypes.includes(file.type)) {
    return { error: 'Invalid file type. Please upload JPG, PNG, WebP, or PDF.' }
  }

  // Validate file size (10MB max)
  if (file.size > 10 * 1024 * 1024) {
    return { error: 'File too large. Maximum size is 10MB.' }
  }

  // Get file extension
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const fileName = `ccq-cards/${userId}/card.${ext}`

  // Convert File to ArrayBuffer for upload
  const arrayBuffer = await file.arrayBuffer()
  const fileBuffer = new Uint8Array(arrayBuffer)

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from('employee-documents')
    .upload(fileName, fileBuffer, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: true,
    })

  if (uploadError) {
    console.error('Error uploading CCQ card:', uploadError)
    return { error: 'Failed to upload CCQ card: ' + uploadError.message }
  }

  // Get signed URL (private bucket)
  const { data: urlData } = await supabase.storage
    .from('employee-documents')
    .createSignedUrl(fileName, 60 * 60 * 24 * 365) // 1 year

  const cardUrl = urlData?.signedUrl

  // Update profile with CCQ card URL
  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      ccq_card_url: cardUrl,
      ccq_card_uploaded_at: new Date().toISOString(),
    })
    .eq('id', userId)

  if (updateError) {
    console.error('Error updating profile with CCQ card:', updateError)
    return { error: 'Failed to update profile: ' + updateError.message }
  }

  // Log audit
  await logAudit({
    action: 'upload',
    entityType: 'ccq_card',
    entityId: userId,
    newValues: { ccq_card_url: cardUrl },
  })

  revalidatePath('/admin/users')
  revalidatePath('/profile')

  return { url: cardUrl }
}

/**
 * Update CCQ card info (number and expiry date)
 */
export async function updateCcqCardInfo(
  userId: string,
  data: { cardNumber: string | null; expiryDate: string | null }
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Check permission
  const permissions = await getUserPermissions()
  const isAdmin = hasPermission(permissions, 'admin.manage')
  const isSelf = user.id === userId

  if (!isAdmin && !isSelf) {
    return { error: 'You do not have permission to update CCQ card info for other users' }
  }

  // Get old values for audit
  const { data: oldProfile } = await supabase
    .from('profiles')
    .select('ccq_card_number, ccq_card_expiry')
    .eq('id', userId)
    .single()

  // Update profile
  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      ccq_card_number: data.cardNumber,
      ccq_card_expiry: data.expiryDate,
    })
    .eq('id', userId)

  if (updateError) {
    console.error('Error updating CCQ card info:', updateError)
    return { error: 'Failed to update CCQ card info: ' + updateError.message }
  }

  // Log audit
  await logAudit({
    action: 'update',
    entityType: 'ccq_card',
    entityId: userId,
    oldValues: oldProfile ?? undefined,
    newValues: { ccq_card_number: data.cardNumber, ccq_card_expiry: data.expiryDate },
  })

  revalidatePath('/admin/users')
  revalidatePath('/profile')

  return {}
}

/**
 * Delete CCQ card for an employee
 */
export async function deleteCcqCard(userId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Check permission
  const permissions = await getUserPermissions()
  const isAdmin = hasPermission(permissions, 'admin.manage')
  const isSelf = user.id === userId

  if (!isAdmin && !isSelf) {
    return { error: 'You do not have permission to delete CCQ cards for other users' }
  }

  // Get current card URL for audit
  const { data: profile } = await supabase
    .from('profiles')
    .select('ccq_card_url')
    .eq('id', userId)
    .single()

  // Delete from storage
  const filePath = `ccq-cards/${userId}`
  const { data: files } = await supabase.storage
    .from('employee-documents')
    .list(filePath)

  if (files && files.length > 0) {
    const filesToDelete = files.map((f) => `${filePath}/${f.name}`)
    await supabase.storage.from('employee-documents').remove(filesToDelete)
  }

  // Update profile to remove CCQ card info
  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      ccq_card_url: null,
      ccq_card_uploaded_at: null,
    })
    .eq('id', userId)

  if (updateError) {
    console.error('Error removing CCQ card from profile:', updateError)
    return { error: 'Failed to remove CCQ card: ' + updateError.message }
  }

  // Log audit
  await logAudit({
    action: 'delete',
    entityType: 'ccq_card',
    entityId: userId,
    oldValues: { ccq_card_url: profile?.ccq_card_url },
  })

  revalidatePath('/admin/users')
  revalidatePath('/profile')

  return {}
}
