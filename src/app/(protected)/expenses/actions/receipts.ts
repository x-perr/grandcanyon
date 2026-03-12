'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getUserPermissions, hasPermission } from '@/lib/auth'

/**
 * Upload a receipt for an expense entry
 */
export async function uploadExpenseReceipt(
  entryId: string,
  formData: FormData
): Promise<{ error?: string; url?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Get entry with expense info
  const { data: entry, error: entryError } = await supabase
    .from('expense_entries')
    .select('id, expense:expenses!expense_entries_expense_id_fkey(id, status, user_id)')
    .eq('id', entryId)
    .single()

  if (entryError || !entry) {
    return { error: 'Entry not found' }
  }

  const expense = Array.isArray(entry.expense) ? entry.expense[0] : entry.expense

  if (!expense) {
    return { error: 'Expense report not found' }
  }

  // Verify ownership or admin permission
  const permissions = await getUserPermissions()
  const isAdmin = hasPermission(permissions, 'admin.manage')
  const isOwner = expense.user_id === user.id

  if (!isOwner && !isAdmin) {
    return { error: 'Not authorized to upload receipts for this expense' }
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
  const fileName = `receipts/${entryId}.${ext}`

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
    console.error('Error uploading receipt:', uploadError)
    return { error: 'Failed to upload receipt: ' + uploadError.message }
  }

  // Get signed URL (private bucket)
  const { data: urlData } = await supabase.storage
    .from('employee-documents')
    .createSignedUrl(fileName, 60 * 60 * 24 * 365) // 1 year

  const receiptUrl = urlData?.signedUrl

  // Update entry with receipt URL
  const { error: updateError } = await supabase
    .from('expense_entries')
    .update({
      receipt_url: receiptUrl,
      receipt_uploaded_at: new Date().toISOString(),
    })
    .eq('id', entryId)

  if (updateError) {
    console.error('Error updating entry with receipt:', updateError)
    return { error: 'Failed to update entry: ' + updateError.message }
  }

  revalidatePath('/expenses')
  return { url: receiptUrl }
}

/**
 * Delete a receipt from an expense entry
 */
export async function deleteExpenseReceipt(entryId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Get entry with expense info
  const { data: entry, error: entryError } = await supabase
    .from('expense_entries')
    .select('id, receipt_url, expense:expenses!expense_entries_expense_id_fkey(id, status, user_id)')
    .eq('id', entryId)
    .single()

  if (entryError || !entry) {
    return { error: 'Entry not found' }
  }

  const expense = Array.isArray(entry.expense) ? entry.expense[0] : entry.expense

  if (!expense) {
    return { error: 'Expense report not found' }
  }

  // Verify ownership or admin permission
  const permissions = await getUserPermissions()
  const isAdmin = hasPermission(permissions, 'admin.manage')
  const isOwner = expense.user_id === user.id

  if (!isOwner && !isAdmin) {
    return { error: 'Not authorized to delete receipts for this expense' }
  }

  // Delete from storage
  const filePath = `receipts/${entryId}`
  const { data: files } = await supabase.storage
    .from('employee-documents')
    .list('receipts')

  if (files) {
    const toDelete = files
      .filter((f) => f.name.startsWith(entryId.split('/').pop() ?? ''))
      .map((f) => `receipts/${f.name}`)

    if (toDelete.length > 0) {
      await supabase.storage.from('employee-documents').remove(toDelete)
    }
  }

  // Update entry to remove receipt
  const { error: updateError } = await supabase
    .from('expense_entries')
    .update({
      receipt_url: null,
      receipt_uploaded_at: null,
    })
    .eq('id', entryId)

  if (updateError) {
    console.error('Error removing receipt from entry:', updateError)
    return { error: 'Failed to remove receipt: ' + updateError.message }
  }

  revalidatePath('/expenses')
  return {}
}
