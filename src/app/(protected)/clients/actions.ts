'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { clientSchema, type ClientFormData } from '@/lib/validations/client'
import { getUserPermissions, hasPermission } from '@/lib/auth'

export type ClientWithProjects = {
  id: string
  code: string
  name: string
  short_name: string
  charges_gst: boolean | null
  charges_qst: boolean | null
  general_email: string | null
  phone: string | null
  created_at: string | null
  deleted_at: string | null
  projects: { count: number }[]
}

export async function getClients(options?: {
  search?: string
  showDeleted?: boolean
  limit?: number
  offset?: number
}): Promise<{ clients: ClientWithProjects[]; count: number }> {
  const supabase = await createClient()
  const { search, showDeleted = false, limit = 25, offset = 0 } = options ?? {}

  let query = supabase
    .from('clients')
    .select(
      `
      id,
      code,
      name,
      short_name,
      charges_gst,
      charges_qst,
      general_email,
      phone,
      created_at,
      deleted_at,
      projects:projects(count)
    `,
      { count: 'exact' }
    )

  // Filter deleted unless requested
  if (!showDeleted) {
    query = query.is('deleted_at', null)
  }

  // Search filter
  if (search) {
    query = query.or(`code.ilike.%${search}%,name.ilike.%${search}%,short_name.ilike.%${search}%`)
  }

  // Pagination & order
  query = query.order('name').range(offset, offset + limit - 1)

  const { data, count, error } = await query

  if (error) {
    console.error('Error fetching clients:', error)
    return { clients: [], count: 0 }
  }

  return { clients: data as ClientWithProjects[], count: count ?? 0 }
}

export async function getClient(id: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('clients')
    .select(
      `
      *,
      contacts:client_contacts(*),
      projects:projects(id, code, name, status)
    `
    )
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching client:', error)
    return null
  }

  return data
}

export async function createClientAction(formData: FormData) {
  const supabase = await createClient()

  // Verify permission
  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'clients.edit')) {
    return { error: 'You do not have permission to create clients' }
  }

  // Parse form data
  const rawData = Object.fromEntries(formData.entries())

  // Handle checkboxes (they're not present when unchecked)
  const formValues = {
    ...rawData,
    charges_gst: formData.get('charges_gst') === 'on',
    charges_qst: formData.get('charges_qst') === 'on',
  }

  // Validate
  const result = clientSchema.safeParse(formValues)
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? 'Validation failed' }
  }

  const data = result.data

  // Check code uniqueness
  const { data: existing } = await supabase
    .from('clients')
    .select('id')
    .eq('code', data.code)
    .is('deleted_at', null)
    .single()

  if (existing) {
    return { error: 'Client code already exists' }
  }

  // Get current user for created_by
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Insert
  const { data: client, error } = await supabase
    .from('clients')
    .insert({
      ...data,
      created_by: user?.id,
    })
    .select('id')
    .single()

  if (error) {
    console.error('Error creating client:', error)
    return { error: 'Failed to create client' }
  }

  revalidatePath('/clients')
  redirect(`/clients/${client.id}`)
}

export async function updateClientAction(id: string, formData: FormData) {
  const supabase = await createClient()

  // Verify permission
  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'clients.edit')) {
    return { error: 'You do not have permission to edit clients' }
  }

  // Parse form data
  const rawData = Object.fromEntries(formData.entries())

  const formValues = {
    ...rawData,
    charges_gst: formData.get('charges_gst') === 'on',
    charges_qst: formData.get('charges_qst') === 'on',
  }

  // Validate
  const result = clientSchema.safeParse(formValues)
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? 'Validation failed' }
  }

  const data = result.data

  // Check code uniqueness (exclude current client)
  const { data: existing } = await supabase
    .from('clients')
    .select('id')
    .eq('code', data.code)
    .neq('id', id)
    .is('deleted_at', null)
    .single()

  if (existing) {
    return { error: 'Client code already exists' }
  }

  // Update
  const { error } = await supabase.from('clients').update(data).eq('id', id)

  if (error) {
    console.error('Error updating client:', error)
    return { error: 'Failed to update client' }
  }

  revalidatePath('/clients')
  revalidatePath(`/clients/${id}`)
  redirect(`/clients/${id}`)
}

export async function deleteClientAction(id: string) {
  const supabase = await createClient()

  // Verify permission
  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'clients.edit')) {
    return { error: 'You do not have permission to delete clients' }
  }

  // Soft delete
  const { error } = await supabase
    .from('clients')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    console.error('Error deleting client:', error)
    return { error: 'Failed to delete client' }
  }

  revalidatePath('/clients')
  redirect('/clients')
}
