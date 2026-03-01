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
  is_active: boolean | null
  created_at: string | null
  deleted_at: string | null
  projects: { count: number }[]
}

export type SortColumn = 'code' | 'name' | 'general_email' | 'created_at'
export type SortDirection = 'asc' | 'desc'

export async function getClients(options?: {
  search?: string
  showDeleted?: boolean
  showInactive?: boolean
  limit?: number
  offset?: number
  sortColumn?: SortColumn
  sortDirection?: SortDirection
}): Promise<{ clients: ClientWithProjects[]; count: number }> {
  const supabase = await createClient()
  const {
    search,
    showDeleted = false,
    showInactive = false,
    limit = 25,
    offset = 0,
    sortColumn = 'name',
    sortDirection = 'asc',
  } = options ?? {}

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
      is_active,
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

  // Filter inactive unless requested
  if (!showInactive) {
    query = query.eq('is_active', true)
  }

  // Search filter
  if (search) {
    query = query.or(`code.ilike.%${search}%,name.ilike.%${search}%,short_name.ilike.%${search}%`)
  }

  // Sorting & pagination
  query = query
    .order(sortColumn, { ascending: sortDirection === 'asc' })
    .range(offset, offset + limit - 1)

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

// Types for 360° client view
export type ClientInvoice = {
  id: string
  invoice_number: string
  invoice_date: string
  due_date: string | null
  total: number
  status: 'draft' | 'sent' | 'paid' | 'void'
  project: { code: string; name: string } | null
}

export type ClientExpense = {
  id: string
  expense_date: string
  description: string | null
  total: number
  is_billable: boolean | null
  expense_type: { name: string } | null
  project: { code: string; name: string } | null
  invoice_line: { invoice_id: string } | null
}

export type ClientFinancials = {
  totalBilled: number
  totalPaid: number
  totalOutstanding: number
  invoiceCount: number
}

export type Client360Data = {
  client: Awaited<ReturnType<typeof getClient>>
  invoices: ClientInvoice[]
  expenses: ClientExpense[]
  financials: ClientFinancials
}

export async function getClient360(id: string): Promise<Client360Data | null> {
  const supabase = await createClient()

  // Fetch client with contacts and projects
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select(
      `
      *,
      contacts:client_contacts(*),
      projects:projects(id, code, name, status, is_active)
    `
    )
    .eq('id', id)
    .single()

  if (clientError || !client) {
    console.error('Error fetching client:', clientError)
    return null
  }

  // Fetch invoices for this client
  const { data: invoices, error: invoicesError } = await supabase
    .from('invoices')
    .select(
      `
      id,
      invoice_number,
      invoice_date,
      due_date,
      total,
      status,
      project:projects(code, name)
    `
    )
    .eq('client_id', id)
    .order('invoice_date', { ascending: false })
    .limit(10)

  if (invoicesError) {
    console.error('Error fetching invoices:', invoicesError)
  }

  // Calculate financials from all invoices (not just recent 10)
  const { data: allInvoices } = await supabase
    .from('invoices')
    .select('total, status')
    .eq('client_id', id)

  const financials: ClientFinancials = {
    totalBilled: 0,
    totalPaid: 0,
    totalOutstanding: 0,
    invoiceCount: allInvoices?.length ?? 0,
  }

  allInvoices?.forEach((inv) => {
    if (inv.status !== 'void') {
      financials.totalBilled += inv.total
      if (inv.status === 'paid') {
        financials.totalPaid += inv.total
      } else if (inv.status === 'sent') {
        financials.totalOutstanding += inv.total
      }
    }
  })

  // Get project IDs for this client to fetch expenses
  const projectIds = client.projects?.map((p: { id: string }) => p.id) ?? []

  // Fetch billable expenses for this client's projects
  let expenses: ClientExpense[] = []
  if (projectIds.length > 0) {
    const { data: expenseData, error: expensesError } = await supabase
      .from('expense_entries')
      .select(
        `
        id,
        expense_date,
        description,
        total,
        is_billable,
        expense_type:expense_types(name),
        project:projects(code, name),
        invoice_line:invoice_lines(invoice_id)
      `
      )
      .in('project_id', projectIds)
      .eq('is_billable', true)
      .order('expense_date', { ascending: false })
      .limit(10)

    if (expensesError) {
      console.error('Error fetching expenses:', expensesError)
    } else {
      expenses = (expenseData ?? []) as unknown as ClientExpense[]
    }
  }

  return {
    client,
    invoices: (invoices ?? []) as unknown as ClientInvoice[],
    expenses,
    financials,
  }
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
