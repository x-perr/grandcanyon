'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getUserPermissions, hasPermission } from '@/lib/auth'
import { calculateTaxes } from '@/lib/tax'
import type { BatchInvoicePreview, BatchInvoiceResult } from './types'
import { getInvoice } from './queries'
import { getClientEmailForInvoice } from './email'
import { sendInvoiceWithEmail } from './email'

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

      // Atomically get next invoice number (prevents race conditions)
      const { data: nextNum, error: rpcError } = await supabase.rpc('get_next_invoice_number')
      if (rpcError || !nextNum) {
        results.push({
          clientId: client.clientId,
          clientName: client.clientName,
          invoiceId: '',
          invoiceNumber: '',
          total: 0,
          success: false,
          error: 'Failed to generate invoice number',
        })
        continue
      }

      const year = new Date().getFullYear()
      const invoiceNumber = `${year}-${String(nextNum).padStart(3, '0')}`

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
