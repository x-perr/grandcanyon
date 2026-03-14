'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserPermissions, hasPermission } from '@/lib/auth'
import { resolveHourlyRate } from '@/lib/billing/rate-resolution'
import type { ResolvedRate } from '@/types/billing'
import type {
  InvoiceStatus,
  InvoiceWithRelations,
  UninvoicedEntry,
  ClientForSelect,
  ProjectForSelect,
  SortColumn,
  SortDirection,
} from './types'

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
  sortColumn?: SortColumn
  sortDirection?: SortDirection
}): Promise<{ invoices: InvoiceWithRelations[]; count: number; error?: string }> {
  const supabase = await createClient()
  const {
    search,
    clientId,
    status,
    year,
    limit = 25,
    offset = 0,
    sortColumn = 'invoice_date',
    sortDirection = 'desc',
  } = options ?? {}

  let query = supabase
    .from('invoices')
    .select(
      `
      *,
      client:clients!invoices_client_id_fkey(
        id, code, name, short_name, billing_email,
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

  // Sorting & pagination
  query = query
    .order(sortColumn, { ascending: sortDirection === 'asc' })
    .range(offset, offset + limit - 1)

  const { data, count, error } = await query

  if (error) {
    console.error('Error fetching invoices:', error)
    return { invoices: [], count: 0, error: 'Failed to load invoices' }
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
  error?: string
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
    return { draft: 0, sent: 0, paid: 0, error: 'Failed to load invoice summary' }
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
        id, code, name, short_name, billing_email,
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

  // Permission check
  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'invoices.create') && !hasPermission(permissions, 'admin.manage')) {
    return []
  }

  // First, get all billable entries for this project
  const { data, error } = await supabase
    .from('timesheet_entries')
    .select(
      `
      id,
      hours,
      is_billable,
      description,
      ot_flags,
      timesheet:timesheets!timesheet_entries_timesheet_id_fkey(
        id,
        week_start,
        status,
        user:profiles!timesheets_user_id_fkey(id, first_name, last_name, person_id)
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

  // Map to clean format and resolve billing rates
  const entries = filtered.map((entry) => {
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
  })

  // Resolve billing rates for each entry using the rate cascade
  const entriesWithRates = await Promise.all(
    entries.map(async (entry) => {
      const personId = entry.timesheet?.user?.person_id as string | undefined
      let resolvedRate: ResolvedRate | null = null

      if (personId) {
        try {
          resolvedRate = await resolveHourlyRate({
            employeePersonId: personId,
            projectId,
          })
        } catch {
          // Rate resolution failed — fall back to legacy billing role rate
        }
      }

      // Use resolved rate if available and non-zero, otherwise keep billing_role rate
      const effectiveRate =
        resolvedRate && resolvedRate.rate > 0
          ? resolvedRate.rate
          : entry.billing_role?.rate ?? 0

      return {
        ...entry,
        // Strip person_id from user before returning (internal use only)
        timesheet: entry.timesheet
          ? {
              id: entry.timesheet.id,
              week_start: entry.timesheet.week_start,
              user: entry.timesheet.user
                ? {
                    id: entry.timesheet.user.id,
                    first_name: entry.timesheet.user.first_name,
                    last_name: entry.timesheet.user.last_name,
                  }
                : null,
            }
          : null,
        resolved_rate: effectiveRate,
        rate_source: resolvedRate?.source ?? 'legacy_role',
        rate_tier_code: resolvedRate?.tierCode ?? null,
        rate_classification_level: resolvedRate?.classificationLevel ?? null,
        ot_flags: (entry.ot_flags ?? null) as UninvoicedEntry['ot_flags'],
      }
    })
  )

  return entriesWithRates as UninvoicedEntry[]
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
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('code')

  if (error) {
    console.error('Error fetching projects:', error)
    return []
  }

  return data ?? []
}

/**
 * Get next invoice number (preview — reads current sequence without incrementing)
 */
export async function getNextInvoiceNumber(): Promise<string> {
  const supabase = await createClient()
  const year = new Date().getFullYear()

  // Peek at the current sequence value (read-only, does not increment)
  const { data: setting } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'next_invoice_number')
    .single()

  // The RPC increments then returns, so the next number to be issued
  // is the current stored value + 1
  const sequence = ((setting?.value as number) ?? 0) + 1

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
