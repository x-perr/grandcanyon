'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserPermissions, hasPermission } from '@/lib/auth'
import type { Contact, ContactType, ContactQueryResult } from './types'
import { normalizeContact } from './types'

/**
 * Get all contacts from people table
 * Filters by contact_type (employee, client_contact, subcontractor, external)
 */
export async function getContacts(options?: {
  search?: string
  contactType?: ContactType
  showInactive?: boolean
  clientId?: string
  limit?: number
  offset?: number
}): Promise<{ contacts: Contact[]; count: number }> {
  const supabase = await createClient()
  const {
    search,
    contactType,
    showInactive = false,
    clientId,
    limit = 25,
    offset = 0,
  } = options ?? {}

  // Check permission
  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'admin.manage')) {
    return { contacts: [], count: 0 }
  }

  let query = supabase
    .from('people')
    .select(
      `
      id,
      first_name,
      last_name,
      email,
      phone,
      title,
      contact_type,
      is_primary,
      is_active,
      created_at,
      client:clients!people_client_id_fkey(id, code, name)
    `,
      { count: 'exact' }
    )

  // Filter by contact_type
  if (contactType) {
    query = query.eq('contact_type', contactType)
  }

  // Filter by client (for client contacts)
  if (clientId) {
    query = query.eq('client_id', clientId)
  }

  // Filter inactive unless requested
  if (!showInactive) {
    query = query.eq('is_active', true)
  }

  // Search filter
  if (search) {
    query = query.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`
    )
  }

  // Pagination & order
  query = query.order('last_name').order('first_name').range(offset, offset + limit - 1)

  const { data, count, error } = await query

  if (error) {
    console.error('Error fetching contacts:', error)
    return { contacts: [], count: 0 }
  }

  const contacts = (data as ContactQueryResult[]).map(normalizeContact)
  return { contacts, count: count ?? 0 }
}
