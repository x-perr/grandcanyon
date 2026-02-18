'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { contactSchema, type ContactFormData } from '@/lib/validations/client'
import { getUserPermissions, hasPermission } from '@/lib/auth'

export async function createContactAction(clientId: string, formData: FormData) {
  const supabase = await createClient()

  // Verify permission
  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'clients.edit')) {
    return { error: 'You do not have permission to manage contacts' }
  }

  // Parse form data
  const rawData = {
    first_name: formData.get('first_name'),
    last_name: formData.get('last_name'),
    title: formData.get('title'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    is_primary: formData.get('is_primary') === 'on',
  }

  // Validate
  const result = contactSchema.safeParse(rawData)
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? 'Validation failed' }
  }

  const data = result.data

  // If setting as primary, unset others first
  if (data.is_primary) {
    await supabase
      .from('client_contacts')
      .update({ is_primary: false })
      .eq('client_id', clientId)
  }

  // Insert
  const { error } = await supabase.from('client_contacts').insert({
    client_id: clientId,
    ...data,
  })

  if (error) {
    console.error('Error creating contact:', error)
    return { error: 'Failed to create contact' }
  }

  revalidatePath(`/clients/${clientId}`)
  return { success: true }
}

export async function updateContactAction(
  clientId: string,
  contactId: string,
  formData: FormData
) {
  const supabase = await createClient()

  // Verify permission
  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'clients.edit')) {
    return { error: 'You do not have permission to manage contacts' }
  }

  // Parse form data
  const rawData = {
    first_name: formData.get('first_name'),
    last_name: formData.get('last_name'),
    title: formData.get('title'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    is_primary: formData.get('is_primary') === 'on',
  }

  // Validate
  const result = contactSchema.safeParse(rawData)
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? 'Validation failed' }
  }

  const data = result.data

  // If setting as primary, unset others first
  if (data.is_primary) {
    await supabase
      .from('client_contacts')
      .update({ is_primary: false })
      .eq('client_id', clientId)
      .neq('id', contactId)
  }

  // Update
  const { error } = await supabase
    .from('client_contacts')
    .update(data)
    .eq('id', contactId)
    .eq('client_id', clientId)

  if (error) {
    console.error('Error updating contact:', error)
    return { error: 'Failed to update contact' }
  }

  revalidatePath(`/clients/${clientId}`)
  return { success: true }
}

export async function deleteContactAction(clientId: string, contactId: string) {
  const supabase = await createClient()

  // Verify permission
  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'clients.edit')) {
    return { error: 'You do not have permission to manage contacts' }
  }

  const { error } = await supabase
    .from('client_contacts')
    .delete()
    .eq('id', contactId)
    .eq('client_id', clientId)

  if (error) {
    console.error('Error deleting contact:', error)
    return { error: 'Failed to delete contact' }
  }

  revalidatePath(`/clients/${clientId}`)
  return { success: true }
}
