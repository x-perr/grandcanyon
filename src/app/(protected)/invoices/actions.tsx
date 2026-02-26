'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { renderToBuffer } from '@react-pdf/renderer'
import { getUserPermissions, hasPermission } from '@/lib/auth'
import { calculateTaxes, formatCurrency } from '@/lib/tax'
import { createInvoiceSchema, type CreateInvoiceData, type InvoiceLineFormData } from '@/lib/validations/invoice'
import { sendInvoiceEmail } from '@/lib/email'
import { InvoicePDF, DEFAULT_COMPANY_INFO } from '@/components/invoices/invoice-pdf'
import type { Enums, Tables } from '@/types/database'

type InvoiceStatus = Enums<'invoice_status'>

// === TYPE DEFINITIONS ===

export type InvoiceWithRelations = Tables<'invoices'> & {
  client: {
    id: string
    code: string
    name: string
    short_name: string | null
    billing_address_line1: string | null
    billing_city: string | null
    billing_province: string | null
    billing_postal_code: string | null
    charges_gst: boolean | null
    charges_qst: boolean | null
  } | null
  project: {
    id: string
    code: string
    name: string
  } | null
  lines?: InvoiceLineWithRelations[]
}

export type InvoiceLineWithRelations = Tables<'invoice_lines'> & {
  timesheet_entry?: {
    id: string
    hours: number[]
    timesheet: {
      user: { first_name: string; last_name: string } | null
    } | null
  } | null
}

export type UninvoicedEntry = {
  id: string
  hours: number[]
  is_billable: boolean
  description: string | null
  timesheet: {
    id: string
    week_start: string
    user: {
      id: string
      first_name: string
      last_name: string
    } | null
  } | null
  project: {
    id: string
    code: string
    name: string
  } | null
  task: {
    id: string
    code: string
    name: string
  } | null
  billing_role: {
    id: string
    name: string
    rate: number
  } | null
}

export type ClientForSelect = {
  id: string
  code: string
  name: string
  charges_gst: boolean | null
  charges_qst: boolean | null
}

export type ProjectForSelect = {
  id: string
  code: string
  name: string
  client_id: string
}

// === QUERY FUNCTIONS ===

/**
 * Get list of invoices with filters (paginated)
 */
export async function getInvoices(options?: {
  search?: string
  clientId?: string
  status?: InvoiceStatus
  year?: number
  limit?: number
  offset?: number
}): Promise<{ invoices: InvoiceWithRelations[]; count: number }> {
  const supabase = await createClient()
  const { search, clientId, status, year, limit = 25, offset = 0 } = options ?? {}

  let query = supabase
    .from('invoices')
    .select(
      `
      *,
      client:clients!invoices_client_id_fkey(
        id, code, name, short_name,
        billing_address_line1, billing_city, billing_province, billing_postal_code,
        charges_gst, charges_qst
      ),
      project:projects!invoices_project_id_fkey(id, code, name)
    `,
      { count: 'exact' }
    )
    .neq('status', 'void') // Hide voided by default

  // Search filter (invoice number or client name)
  if (search) {
    query = query.or(`invoice_number.ilike.%${search}%,client.name.ilike.%${search}%`)
  }

  // Client filter
  if (clientId) {
    query = query.eq('client_id', clientId)
  }

  // Status filter
  if (status) {
    query = query.eq('status', status)
  }

  // Year filter
  if (year) {
    query = query
      .gte('invoice_date', `${year}-01-01`)
      .lte('invoice_date', `${year}-12-31`)
  }

  // Pagination & order
  query = query.order('invoice_date', { ascending: false }).range(offset, offset + limit - 1)

  const { data, count, error } = await query

  if (error) {
    console.error('Error fetching invoices:', error)
    return { invoices: [], count: 0 }
  }

  // Handle array joins
  const invoices = (data ?? []).map((inv) => ({
    ...inv,
    client: Array.isArray(inv.client) ? inv.client[0] ?? null : inv.client,
    project: Array.isArray(inv.project) ? inv.project[0] ?? null : inv.project,
  })) as InvoiceWithRelations[]

  return { invoices, count: count ?? 0 }
}

/**
 * Get invoice summary totals by status
 */
export async function getInvoiceSummary(year?: number): Promise<{
  draft: number
  sent: number
  paid: number
}> {
  const supabase = await createClient()

  let query = supabase
    .from('invoices')
    .select('status, total')
    .neq('status', 'void')

  if (year) {
    query = query
      .gte('invoice_date', `${year}-01-01`)
      .lte('invoice_date', `${year}-12-31`)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching invoice summary:', error)
    return { draft: 0, sent: 0, paid: 0 }
  }

  const summary = { draft: 0, sent: 0, paid: 0 }

  data?.forEach((inv) => {
    const status = inv.status as InvoiceStatus
    if (status === 'draft') summary.draft += inv.total ?? 0
    else if (status === 'sent') summary.sent += inv.total ?? 0
    else if (status === 'paid') summary.paid += inv.total ?? 0
  })

  return summary
}

/**
 * Get single invoice with all details
 */
export async function getInvoice(id: string): Promise<InvoiceWithRelations | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('invoices')
    .select(
      `
      *,
      client:clients!invoices_client_id_fkey(
        id, code, name, short_name,
        billing_address_line1, billing_city, billing_province, billing_postal_code,
        charges_gst, charges_qst
      ),
      project:projects!invoices_project_id_fkey(id, code, name),
      lines:invoice_lines(
        *,
        timesheet_entry:timesheet_entries(
          id,
          hours,
          timesheet:timesheets(
            user:profiles!timesheets_user_id_fkey(first_name, last_name)
          )
        )
      )
    `
    )
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching invoice:', error)
    return null
  }

  return {
    ...data,
    client: Array.isArray(data.client) ? data.client[0] ?? null : data.client,
    project: Array.isArray(data.project) ? data.project[0] ?? null : data.project,
    lines: data.lines ?? [],
  } as InvoiceWithRelations
}

/**
 * Get uninvoiced timesheet entries for a project
 */
export async function getUninvoicedEntries(
  projectId: string,
  periodStart?: string,
  periodEnd?: string
): Promise<UninvoicedEntry[]> {
  const supabase = await createClient()

  // First, get all billable entries for this project
  const { data, error } = await supabase
    .from('timesheet_entries')
    .select(
      `
      id,
      hours,
      is_billable,
      description,
      timesheet:timesheets!timesheet_entries_timesheet_id_fkey(
        id,
        week_start,
        status,
        user:profiles!timesheets_user_id_fkey(id, first_name, last_name)
      ),
      project:projects!timesheet_entries_project_id_fkey(id, code, name),
      task:project_tasks!timesheet_entries_task_id_fkey(id, code, name),
      billing_role:project_billing_roles!timesheet_entries_billing_role_id_fkey(id, name, rate)
    `
    )
    .eq('project_id', projectId)
    .eq('is_billable', true)

  if (error) {
    console.error('Error fetching timesheet entries:', error)
    return []
  }

  if (!data || data.length === 0) {
    return []
  }

  // Get entry IDs that already have invoice lines
  const entryIds = data.map((e) => e.id)
  const { data: invoicedLines } = await supabase
    .from('invoice_lines')
    .select('timesheet_entry_id')
    .in('timesheet_entry_id', entryIds)

  const invoicedEntryIds = new Set((invoicedLines ?? []).map((l) => l.timesheet_entry_id))

  // Filter out already-invoiced entries
  const uninvoiced = data.filter((entry) => !invoicedEntryIds.has(entry.id))

  // Filter to only approved timesheets and within date range
  const filtered = uninvoiced.filter((entry) => {
    const timesheet = Array.isArray(entry.timesheet) ? entry.timesheet[0] : entry.timesheet
    if (!timesheet || timesheet.status !== 'approved') return false

    if (periodStart && timesheet.week_start < periodStart) return false
    if (periodEnd && timesheet.week_start > periodEnd) return false

    return true
  })

  // Map to clean format
  return filtered.map((entry) => {
    const ts = Array.isArray(entry.timesheet) ? entry.timesheet[0] : entry.timesheet
    const tsUser = ts?.user ? (Array.isArray(ts.user) ? ts.user[0] : ts.user) : null

    return {
      ...entry,
      timesheet: ts
        ? {
            id: ts.id,
            week_start: ts.week_start,
            user: tsUser,
          }
        : null,
      project: Array.isArray(entry.project) ? entry.project[0] ?? null : entry.project,
      task: Array.isArray(entry.task) ? entry.task[0] ?? null : entry.task,
      billing_role: Array.isArray(entry.billing_role) ? entry.billing_role[0] ?? null : entry.billing_role,
    }
  }) as UninvoicedEntry[]
}

/**
 * Get clients for dropdown (with tax settings)
 */
export async function getClientsForInvoice(): Promise<ClientForSelect[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('clients')
    .select('id, code, name, charges_gst, charges_qst')
    .is('deleted_at', null)
    .order('name')

  if (error) {
    console.error('Error fetching clients:', error)
    return []
  }

  return data ?? []
}

/**
 * Get projects for a client (active only)
 */
export async function getProjectsForClient(clientId: string): Promise<ProjectForSelect[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('projects')
    .select('id, code, name, client_id')
    .eq('client_id', clientId)
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('code')

  if (error) {
    console.error('Error fetching projects:', error)
    return []
  }

  return data ?? []
}

/**
 * Get next invoice number
 */
export async function getNextInvoiceNumber(): Promise<string> {
  const supabase = await createClient()
  const year = new Date().getFullYear()

  // Get from settings
  const { data: setting } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'invoice_number_sequence')
    .single()

  const sequence = (setting?.value as number) ?? 1

  return `${year}-${String(sequence).padStart(3, '0')}`
}

/**
 * Get available years for filter
 */
export async function getInvoiceYears(): Promise<number[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('invoices')
    .select('invoice_date')
    .neq('status', 'void')
    .order('invoice_date', { ascending: false })

  if (error || !data) return [new Date().getFullYear()]

  const years = new Set<number>()
  data.forEach((inv) => {
    if (inv.invoice_date) {
      years.add(new Date(inv.invoice_date).getFullYear())
    }
  })

  // Ensure current year is included
  years.add(new Date().getFullYear())

  return Array.from(years).sort((a, b) => b - a)
}

// === MUTATION FUNCTIONS ===

/**
 * Create a new invoice with line items
 */
export async function createInvoice(data: CreateInvoiceData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Verify permission
  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'invoices.create')) {
    return { error: 'You do not have permission to create invoices' }
  }

  // Validate
  const validation = createInvoiceSchema.safeParse(data)
  if (!validation.success) {
    return { error: validation.error.issues[0]?.message ?? 'Validation failed' }
  }

  // Get client tax settings
  const { data: client } = await supabase
    .from('clients')
    .select('charges_gst, charges_qst')
    .eq('id', data.client_id)
    .single()

  if (!client) {
    return { error: 'Client not found' }
  }

  // Calculate totals
  const subtotal = data.lines.reduce((sum, line) => sum + line.amount, 0)
  const taxes = calculateTaxes(subtotal, client.charges_gst ?? true, client.charges_qst ?? true)

  // Get next invoice number and increment sequence
  const { data: setting } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'invoice_number_sequence')
    .single()

  const sequence = (setting?.value as number) ?? 1
  const year = new Date().getFullYear()
  const invoiceNumber = `${year}-${String(sequence).padStart(3, '0')}`

  // Increment sequence
  await supabase
    .from('settings')
    .upsert({
      key: 'invoice_number_sequence',
      value: sequence + 1,
      description: 'Next invoice number sequence',
    })

  // Create invoice
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .insert({
      invoice_number: invoiceNumber,
      client_id: data.client_id,
      project_id: data.project_id,
      status: 'draft',
      invoice_date: data.invoice_date,
      due_date: data.due_date,
      period_start: data.period_start,
      period_end: data.period_end,
      subtotal: taxes.subtotal,
      gst_amount: taxes.gst,
      qst_amount: taxes.qst,
      total: taxes.total,
      notes: data.notes,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (invoiceError) {
    console.error('Error creating invoice:', invoiceError)
    return { error: 'Failed to create invoice' }
  }

  // Create line items
  const lineItems = data.lines.map((line, index) => ({
    invoice_id: invoice.id,
    description: line.description,
    quantity: line.quantity,
    unit_price: line.unit_price,
    amount: line.amount,
    timesheet_entry_id: line.timesheet_entry_id || null,
    expense_entry_id: line.expense_entry_id || null,
    sort_order: index + 1,
  }))

  const { error: linesError } = await supabase.from('invoice_lines').insert(lineItems)

  if (linesError) {
    console.error('Error creating invoice lines:', linesError)
    // Rollback invoice
    await supabase.from('invoices').delete().eq('id', invoice.id)
    return { error: 'Failed to create invoice lines' }
  }

  // Note: Timesheet entries are linked via invoice_lines.timesheet_entry_id
  // No need to update timesheet_entries - the relationship is already established

  revalidatePath('/invoices')

  // Return invoice ID for client-side navigation
  return { invoiceId: invoice.id }
}

/**
 * Update a draft invoice
 */
export async function updateInvoice(
  invoiceId: string,
  data: {
    invoice_date?: string
    due_date?: string
    period_start?: string
    period_end?: string
    notes?: string | null
    lines?: InvoiceLineFormData[]
  }
) {
  const supabase = await createClient()

  // Verify permission
  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'invoices.create')) {
    return { error: 'You do not have permission to edit invoices' }
  }

  // Get invoice
  const { data: invoice } = await supabase
    .from('invoices')
    .select('status, client_id')
    .eq('id', invoiceId)
    .single()

  if (!invoice) {
    return { error: 'Invoice not found' }
  }

  if (invoice.status !== 'draft') {
    return { error: 'Can only edit draft invoices' }
  }

  // Get client tax settings for recalculation
  const { data: client } = await supabase
    .from('clients')
    .select('charges_gst, charges_qst')
    .eq('id', invoice.client_id)
    .single()

  // Update lines if provided
  if (data.lines && data.lines.length > 0) {
    // Delete existing lines
    await supabase.from('invoice_lines').delete().eq('invoice_id', invoiceId)

    // Insert new lines
    const lineItems = data.lines.map((line, index) => ({
      invoice_id: invoiceId,
      description: line.description,
      quantity: line.quantity,
      unit_price: line.unit_price,
      amount: line.amount,
      timesheet_entry_id: line.timesheet_entry_id || null,
      expense_entry_id: line.expense_entry_id || null,
      sort_order: index + 1,
    }))

    await supabase.from('invoice_lines').insert(lineItems)

    // Recalculate totals
    const subtotal = data.lines.reduce((sum, line) => sum + line.amount, 0)
    const taxes = calculateTaxes(subtotal, client?.charges_gst ?? true, client?.charges_qst ?? true)

    const { error } = await supabase
      .from('invoices')
      .update({
        invoice_date: data.invoice_date,
        due_date: data.due_date,
        period_start: data.period_start,
        period_end: data.period_end,
        notes: data.notes,
        subtotal: taxes.subtotal,
        gst_amount: taxes.gst,
        qst_amount: taxes.qst,
        total: taxes.total,
      })
      .eq('id', invoiceId)

    if (error) {
      console.error('Error updating invoice:', error)
      return { error: 'Failed to update invoice' }
    }
  } else {
    // Just update dates/notes
    const { error } = await supabase
      .from('invoices')
      .update({
        invoice_date: data.invoice_date,
        due_date: data.due_date,
        period_start: data.period_start,
        period_end: data.period_end,
        notes: data.notes,
      })
      .eq('id', invoiceId)

    if (error) {
      console.error('Error updating invoice:', error)
      return { error: 'Failed to update invoice' }
    }
  }

  revalidatePath(`/invoices/${invoiceId}`)
  revalidatePath('/invoices')
  return { success: true }
}

/**
 * Send an invoice (mark as sent, lock timesheets)
 */
export async function sendInvoice(invoiceId: string) {
  const supabase = await createClient()

  // Verify permission
  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'invoices.create')) {
    return { error: 'You do not have permission to send invoices' }
  }

  // Get invoice with lines
  const { data: invoice } = await supabase
    .from('invoices')
    .select('status, lines:invoice_lines(timesheet_entry_id)')
    .eq('id', invoiceId)
    .single()

  if (!invoice) {
    return { error: 'Invoice not found' }
  }

  if (invoice.status !== 'draft') {
    return { error: 'Can only send draft invoices' }
  }

  // Update status
  const { error } = await supabase
    .from('invoices')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
    })
    .eq('id', invoiceId)

  if (error) {
    console.error('Error sending invoice:', error)
    return { error: 'Failed to send invoice' }
  }

  // Lock associated timesheets
  const entryIds = (invoice.lines ?? [])
    .filter((l) => l.timesheet_entry_id)
    .map((l) => l.timesheet_entry_id as string)

  if (entryIds.length > 0) {
    // Get unique timesheet IDs
    const { data: entries } = await supabase
      .from('timesheet_entries')
      .select('timesheet_id')
      .in('id', entryIds)

    const timesheetIds = [...new Set((entries ?? []).map((e) => e.timesheet_id))]

    if (timesheetIds.length > 0) {
      await supabase
        .from('timesheets')
        .update({
          status: 'locked',
          locked_at: new Date().toISOString(),
        })
        .in('id', timesheetIds)
    }
  }

  revalidatePath(`/invoices/${invoiceId}`)
  revalidatePath('/invoices')
  revalidatePath('/timesheets')
  return { success: true }
}

/**
 * Mark invoice as paid
 */
export async function markInvoicePaid(invoiceId: string) {
  const supabase = await createClient()

  // Verify permission
  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'invoices.create')) {
    return { error: 'You do not have permission to update invoices' }
  }

  // Get invoice
  const { data: invoice } = await supabase
    .from('invoices')
    .select('status')
    .eq('id', invoiceId)
    .single()

  if (!invoice) {
    return { error: 'Invoice not found' }
  }

  if (invoice.status !== 'sent') {
    return { error: 'Can only mark sent invoices as paid' }
  }

  // Update status
  const { error } = await supabase
    .from('invoices')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
    })
    .eq('id', invoiceId)

  if (error) {
    console.error('Error marking invoice as paid:', error)
    return { error: 'Failed to mark invoice as paid' }
  }

  revalidatePath(`/invoices/${invoiceId}`)
  revalidatePath('/invoices')
  return { success: true }
}

/**
 * Cancel an invoice (void it, unlock timesheets)
 */
export async function cancelInvoice(invoiceId: string) {
  const supabase = await createClient()

  // Verify permission
  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'invoices.create')) {
    return { error: 'You do not have permission to cancel invoices' }
  }

  // Get invoice with lines
  const { data: invoice } = await supabase
    .from('invoices')
    .select('status, lines:invoice_lines(id, timesheet_entry_id)')
    .eq('id', invoiceId)
    .single()

  if (!invoice) {
    return { error: 'Invoice not found' }
  }

  if (invoice.status === 'paid') {
    return { error: 'Cannot cancel paid invoices' }
  }

  // Unlink timesheet entries by deleting invoice lines
  const entryIds = (invoice.lines ?? [])
    .filter((l) => l.timesheet_entry_id)
    .map((l) => l.timesheet_entry_id as string)

  // Delete invoice lines to free up entries for re-invoicing
  const lineIds = (invoice.lines ?? []).map((l) => l.id)
  if (lineIds.length > 0) {
    await supabase.from('invoice_lines').delete().in('id', lineIds)
  }

  if (entryIds.length > 0) {
    // Unlock timesheets (set back to approved)
    const { data: entries } = await supabase
      .from('timesheet_entries')
      .select('timesheet_id')
      .in('id', entryIds)

    const timesheetIds = [...new Set((entries ?? []).map((e) => e.timesheet_id))]

    if (timesheetIds.length > 0) {
      await supabase
        .from('timesheets')
        .update({
          status: 'approved',
          locked_at: null,
        })
        .in('id', timesheetIds)
    }
  }

  // Void the invoice (soft delete)
  const { error } = await supabase
    .from('invoices')
    .update({
      status: 'void',
    })
    .eq('id', invoiceId)

  if (error) {
    console.error('Error cancelling invoice:', error)
    return { error: 'Failed to cancel invoice' }
  }

  revalidatePath('/invoices')
  revalidatePath('/timesheets')
  redirect('/invoices')
}

/**
 * Delete a draft invoice
 */
export async function deleteInvoice(invoiceId: string) {
  const supabase = await createClient()

  // Verify permission
  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'invoices.create')) {
    return { error: 'You do not have permission to delete invoices' }
  }

  // Get invoice
  const { data: invoice } = await supabase
    .from('invoices')
    .select('status')
    .eq('id', invoiceId)
    .single()

  if (!invoice) {
    return { error: 'Invoice not found' }
  }

  if (invoice.status !== 'draft') {
    return { error: 'Can only delete draft invoices' }
  }

  // Delete lines first
  await supabase.from('invoice_lines').delete().eq('invoice_id', invoiceId)

  // Delete invoice
  const { error } = await supabase.from('invoices').delete().eq('id', invoiceId)

  if (error) {
    console.error('Error deleting invoice:', error)
    return { error: 'Failed to delete invoice' }
  }

  revalidatePath('/invoices')
  redirect('/invoices')
}

// === EMAIL FUNCTIONS ===

export type InvoiceEmail = {
  id: string
  sent_to: string
  sent_at: string
  status: string
  error_message: string | null
  sent_by_name: string
}

/**
 * Get email history for an invoice
 */
export async function getInvoiceEmails(invoiceId: string): Promise<InvoiceEmail[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('invoice_emails')
    .select(
      `
      id,
      sent_to,
      sent_at,
      status,
      error_message,
      sent_by:profiles!invoice_emails_sent_by_fkey(first_name, last_name)
    `
    )
    .eq('invoice_id', invoiceId)
    .order('sent_at', { ascending: false })

  if (error) {
    console.error('Error fetching invoice emails:', error)
    return []
  }

  return (data ?? []).map((email) => {
    const sentBy = Array.isArray(email.sent_by) ? email.sent_by[0] : email.sent_by
    return {
      id: email.id,
      sent_to: email.sent_to,
      sent_at: email.sent_at,
      status: email.status,
      error_message: email.error_message,
      sent_by_name: sentBy ? `${sentBy.first_name} ${sentBy.last_name}` : 'Unknown',
    }
  })
}

/**
 * Get client billing email for an invoice
 */
export async function getClientEmailForInvoice(invoiceId: string): Promise<string | null> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('invoices')
    .select(
      `
      client:clients!invoices_client_id_fkey(
        billing_email,
        general_email
      )
    `
    )
    .eq('id', invoiceId)
    .single()

  if (!data?.client) return null

  const client = Array.isArray(data.client) ? data.client[0] : data.client
  // Prefer billing_email, fall back to general_email
  return client?.billing_email || client?.general_email || null
}

/**
 * Send invoice via email with PDF attachment
 */
export async function sendInvoiceWithEmail(
  invoiceId: string,
  toEmail: string,
  customMessage?: string
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Verify permission
  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'invoices.create')) {
    return { error: 'You do not have permission to send invoices' }
  }

  // Get invoice with all relations
  const invoice = await getInvoice(invoiceId)
  if (!invoice) {
    return { error: 'Invoice not found' }
  }

  if (invoice.status !== 'draft') {
    return { error: 'Can only send draft invoices' }
  }

  // Generate PDF buffer
  let pdfBuffer: Buffer
  try {
    pdfBuffer = await renderToBuffer(
      <InvoicePDF invoice={invoice} companyInfo={DEFAULT_COMPANY_INFO} />
    )
  } catch (error) {
    console.error('Error generating PDF:', error)
    return { error: 'Failed to generate PDF' }
  }

  // Format for email
  const dueDate = invoice.due_date
    ? new Date(invoice.due_date).toLocaleDateString('en-CA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Upon Receipt'

  // Send email
  const emailResult = await sendInvoiceEmail({
    to: toEmail,
    invoiceNumber: invoice.invoice_number,
    clientName: invoice.client?.name ?? 'Client',
    total: formatCurrency(invoice.total),
    dueDate,
    pdfBuffer,
    customMessage,
    companyName: DEFAULT_COMPANY_INFO.name,
    companyEmail: DEFAULT_COMPANY_INFO.email,
  })

  // Log email attempt
  await supabase.from('invoice_emails').insert({
    invoice_id: invoiceId,
    sent_to: toEmail,
    sent_by: user.id,
    subject: emailResult.subject,
    body: emailResult.body,
    resend_message_id: emailResult.messageId ?? null,
    status: emailResult.success ? 'sent' : 'failed',
    error_message: emailResult.error ?? null,
  })

  if (!emailResult.success) {
    return { error: emailResult.error ?? 'Failed to send email' }
  }

  // Update invoice status
  const { error: updateError } = await supabase
    .from('invoices')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
    })
    .eq('id', invoiceId)

  if (updateError) {
    console.error('Error updating invoice status:', updateError)
    // Email sent but status not updated - log and continue
  }

  // Lock associated timesheets
  const { data: invoiceLines } = await supabase
    .from('invoice_lines')
    .select('timesheet_entry_id')
    .eq('invoice_id', invoiceId)
    .not('timesheet_entry_id', 'is', null)

  const entryIds = (invoiceLines ?? [])
    .filter((l) => l.timesheet_entry_id)
    .map((l) => l.timesheet_entry_id as string)

  if (entryIds.length > 0) {
    const { data: entries } = await supabase
      .from('timesheet_entries')
      .select('timesheet_id')
      .in('id', entryIds)

    const timesheetIds = [...new Set((entries ?? []).map((e) => e.timesheet_id))]

    if (timesheetIds.length > 0) {
      await supabase
        .from('timesheets')
        .update({
          status: 'locked',
          locked_at: new Date().toISOString(),
        })
        .in('id', timesheetIds)
    }
  }

  revalidatePath(`/invoices/${invoiceId}`)
  revalidatePath('/invoices')
  revalidatePath('/timesheets')

  return { success: true }
}

// === BATCH INVOICING FUNCTIONS ===

export type BatchInvoicePreview = {
  clientId: string
  clientName: string
  clientCode: string
  billingEmail: string | null
  projects: {
    projectId: string
    projectCode: string
    projectName: string
    entries: {
      id: string
      userId: string
      userName: string
      hours: number
      rate: number
      amount: number
    }[]
    totalHours: number
    totalAmount: number
  }[]
  totalHours: number
  totalAmount: number
}

export type BatchInvoiceResult = {
  clientId: string
  clientName: string
  invoiceId: string
  invoiceNumber: string
  total: number
  success: boolean
  error?: string
}

/**
 * Get clients with approved timesheets for a given week (for batch invoicing preview)
 */
export async function getClientsWithApprovedTimesheets(
  weekStart: string
): Promise<BatchInvoicePreview[]> {
  const supabase = await createClient()

  // Verify permission
  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'invoices.create')) {
    return []
  }

  // Get all billable, uninvoiced entries for the given week from approved timesheets
  const { data: entries, error } = await supabase
    .from('timesheet_entries')
    .select(
      `
      id,
      hours,
      is_billable,
      timesheet:timesheets!timesheet_entries_timesheet_id_fkey(
        id,
        week_start,
        status,
        user:profiles!timesheets_user_id_fkey(id, first_name, last_name)
      ),
      project:projects!timesheet_entries_project_id_fkey(
        id,
        code,
        name,
        client:clients!projects_client_id_fkey(
          id,
          code,
          name,
          billing_email,
          general_email,
          charges_gst,
          charges_qst
        )
      ),
      billing_role:project_billing_roles!timesheet_entries_billing_role_id_fkey(id, name, rate)
    `
    )
    .eq('is_billable', true)

  if (error) {
    console.error('Error fetching timesheet entries:', error)
    return []
  }

  if (!entries || entries.length === 0) {
    return []
  }

  // Get entry IDs that already have invoice lines
  const entryIds = entries.map((e) => e.id)
  const { data: invoicedLines } = await supabase
    .from('invoice_lines')
    .select('timesheet_entry_id')
    .in('timesheet_entry_id', entryIds)

  const invoicedEntryIds = new Set((invoicedLines ?? []).map((l) => l.timesheet_entry_id))

  // Filter to entries for this week, approved timesheets, and uninvoiced
  const filtered = entries.filter((entry) => {
    const timesheet = Array.isArray(entry.timesheet) ? entry.timesheet[0] : entry.timesheet
    if (!timesheet) return false
    if (timesheet.week_start !== weekStart) return false
    if (timesheet.status !== 'approved') return false
    if (invoicedEntryIds.has(entry.id)) return false
    return true
  })

  // Group by client, then by project
  const clientMap = new Map<string, BatchInvoicePreview>()

  for (const entry of filtered) {
    const timesheet = Array.isArray(entry.timesheet) ? entry.timesheet[0] : entry.timesheet
    const project = Array.isArray(entry.project) ? entry.project[0] : entry.project
    const client = project?.client
      ? Array.isArray(project.client)
        ? project.client[0]
        : project.client
      : null
    const billingRole = Array.isArray(entry.billing_role)
      ? entry.billing_role[0]
      : entry.billing_role
    const user = timesheet?.user
      ? Array.isArray(timesheet.user)
        ? timesheet.user[0]
        : timesheet.user
      : null

    if (!client || !project) continue

    // Calculate total hours for this entry
    const totalHours = (entry.hours ?? []).reduce((sum: number, h: number) => sum + (h || 0), 0)
    const rate = billingRole?.rate ?? 0
    const amount = totalHours * rate

    // Get or create client entry
    let clientPreview = clientMap.get(client.id)
    if (!clientPreview) {
      clientPreview = {
        clientId: client.id,
        clientName: client.name,
        clientCode: client.code,
        billingEmail: client.billing_email || client.general_email,
        projects: [],
        totalHours: 0,
        totalAmount: 0,
      }
      clientMap.set(client.id, clientPreview)
    }

    // Find or create project in client
    let projectEntry = clientPreview.projects.find((p) => p.projectId === project.id)
    if (!projectEntry) {
      projectEntry = {
        projectId: project.id,
        projectCode: project.code,
        projectName: project.name,
        entries: [],
        totalHours: 0,
        totalAmount: 0,
      }
      clientPreview.projects.push(projectEntry)
    }

    // Add entry
    projectEntry.entries.push({
      id: entry.id,
      userId: user?.id ?? '',
      userName: user ? `${user.first_name} ${user.last_name}` : 'Unknown',
      hours: totalHours,
      rate,
      amount,
    })

    projectEntry.totalHours += totalHours
    projectEntry.totalAmount += amount
    clientPreview.totalHours += totalHours
    clientPreview.totalAmount += amount
  }

  return Array.from(clientMap.values()).sort((a, b) => a.clientName.localeCompare(b.clientName))
}

/**
 * Generate batch invoices for all clients with approved timesheets for a given week
 */
export async function generateBatchInvoices(
  weekStart: string,
  options?: {
    invoiceDate?: string
    dueDate?: string
  }
): Promise<{ results: BatchInvoiceResult[]; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { results: [], error: 'Not authenticated' }
  }

  // Verify permission
  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'invoices.create')) {
    return { results: [], error: 'You do not have permission to create invoices' }
  }

  // Get clients with approved timesheets
  const clients = await getClientsWithApprovedTimesheets(weekStart)

  if (clients.length === 0) {
    return { results: [], error: 'No clients with approved timesheets for this week' }
  }

  const results: BatchInvoiceResult[] = []
  const invoiceDate = options?.invoiceDate ?? new Date().toISOString().split('T')[0]

  // Calculate due date (30 days from invoice date if not provided)
  const dueDateObj = options?.dueDate
    ? new Date(options.dueDate)
    : new Date(new Date(invoiceDate).getTime() + 30 * 24 * 60 * 60 * 1000)
  const dueDate = dueDateObj.toISOString().split('T')[0]

  // Calculate period end (6 days after week start)
  const periodEnd = new Date(new Date(weekStart).getTime() + 6 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0]

  for (const client of clients) {
    try {
      // Get client tax settings
      const { data: clientData } = await supabase
        .from('clients')
        .select('charges_gst, charges_qst')
        .eq('id', client.clientId)
        .single()

      // Calculate totals with taxes
      const subtotal = client.totalAmount
      const taxes = calculateTaxes(
        subtotal,
        clientData?.charges_gst ?? true,
        clientData?.charges_qst ?? true
      )

      // Get next invoice number
      const { data: setting } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'invoice_number_sequence')
        .single()

      const sequence = (setting?.value as number) ?? 1
      const year = new Date().getFullYear()
      const invoiceNumber = `${year}-${String(sequence).padStart(3, '0')}`

      // Increment sequence
      await supabase.from('settings').upsert({
        key: 'invoice_number_sequence',
        value: sequence + 1,
        description: 'Next invoice number sequence',
      })

      // For batch invoices, we create one invoice per client (first project is primary)
      const primaryProject = client.projects[0]

      // Create invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          invoice_number: invoiceNumber,
          client_id: client.clientId,
          project_id: primaryProject?.projectId ?? null,
          status: 'draft',
          invoice_date: invoiceDate,
          due_date: dueDate,
          period_start: weekStart,
          period_end: periodEnd,
          subtotal: taxes.subtotal,
          gst_amount: taxes.gst,
          qst_amount: taxes.qst,
          total: taxes.total,
          notes: `Weekly invoice for ${weekStart}`,
          created_by: user.id,
        })
        .select('id')
        .single()

      if (invoiceError || !invoice) {
        results.push({
          clientId: client.clientId,
          clientName: client.clientName,
          invoiceId: '',
          invoiceNumber: '',
          total: 0,
          success: false,
          error: invoiceError?.message ?? 'Failed to create invoice',
        })
        continue
      }

      // Create line items for all entries across all projects
      const lineItems: {
        invoice_id: string
        description: string
        quantity: number
        unit_price: number
        amount: number
        timesheet_entry_id: string
        sort_order: number
      }[] = []

      let sortOrder = 1
      for (const project of client.projects) {
        for (const entry of project.entries) {
          lineItems.push({
            invoice_id: invoice.id,
            description: `${project.projectCode} - ${entry.userName} (${entry.hours}h)`,
            quantity: entry.hours,
            unit_price: entry.rate,
            amount: entry.amount,
            timesheet_entry_id: entry.id,
            sort_order: sortOrder++,
          })
        }
      }

      const { error: linesError } = await supabase.from('invoice_lines').insert(lineItems)

      if (linesError) {
        // Rollback invoice
        await supabase.from('invoices').delete().eq('id', invoice.id)
        results.push({
          clientId: client.clientId,
          clientName: client.clientName,
          invoiceId: '',
          invoiceNumber: '',
          total: 0,
          success: false,
          error: 'Failed to create invoice lines',
        })
        continue
      }

      results.push({
        clientId: client.clientId,
        clientName: client.clientName,
        invoiceId: invoice.id,
        invoiceNumber,
        total: taxes.total,
        success: true,
      })
    } catch (err) {
      results.push({
        clientId: client.clientId,
        clientName: client.clientName,
        invoiceId: '',
        invoiceNumber: '',
        total: 0,
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }

  revalidatePath('/invoices')
  revalidatePath('/invoices/batch')

  return { results }
}

/**
 * Send multiple invoices in batch via email
 */
export async function sendBatchInvoices(
  invoiceIds: string[]
): Promise<{ results: { invoiceId: string; success: boolean; error?: string }[] }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { results: invoiceIds.map((id) => ({ invoiceId: id, success: false, error: 'Not authenticated' })) }
  }

  // Verify permission
  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'invoices.create')) {
    return { results: invoiceIds.map((id) => ({ invoiceId: id, success: false, error: 'Permission denied' })) }
  }

  const results: { invoiceId: string; success: boolean; error?: string }[] = []

  for (const invoiceId of invoiceIds) {
    // Get invoice with client email
    const invoice = await getInvoice(invoiceId)
    if (!invoice) {
      results.push({ invoiceId, success: false, error: 'Invoice not found' })
      continue
    }

    if (invoice.status !== 'draft') {
      results.push({ invoiceId, success: false, error: 'Can only send draft invoices' })
      continue
    }

    // Get client email
    const clientEmail = await getClientEmailForInvoice(invoiceId)
    if (!clientEmail) {
      results.push({ invoiceId, success: false, error: 'No billing email for client' })
      continue
    }

    // Send via existing function
    const result = await sendInvoiceWithEmail(invoiceId, clientEmail)
    results.push({
      invoiceId,
      success: !result.error,
      error: result.error,
    })
  }

  revalidatePath('/invoices')
  revalidatePath('/invoices/batch')

  return { results }
}
