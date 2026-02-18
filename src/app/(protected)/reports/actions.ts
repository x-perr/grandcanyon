'use server'

import { createClient } from '@/lib/supabase/server'
import type { ReportFilters } from '@/lib/validations/report'

// === TYPE DEFINITIONS ===

export type ProjectForFilter = {
  id: string
  code: string
  name: string
}

export type UserForFilter = {
  id: string
  firstName: string
  lastName: string
}

export type ClientForFilter = {
  id: string
  code: string
  name: string
}

export type TimesheetReportRow = {
  userId: string
  userName: string
  projectId: string
  projectCode: string
  projectName: string
  taskCode: string | null
  taskName: string | null
  billingRoleName: string | null
  weekStart: string
  hours: number
  rate: number
  value: number
  isBillable: boolean
}

export type InvoiceReportRow = {
  invoiceId: string
  invoiceNumber: string
  clientId: string
  clientName: string
  projectCode: string
  projectName: string
  invoiceDate: string
  dueDate: string | null
  status: string
  daysPastDue: number | null
  subtotal: number
  gst: number
  qst: number
  total: number
}

export type InvoiceAgingSummary = {
  current: number // 0-30 days
  days30to60: number
  days60to90: number
  over90: number
  total: number
}

export type ProfitabilityReportRow = {
  projectId: string
  projectCode: string
  projectName: string
  clientName: string
  billingType: string
  fixedPrice: number | null
  totalHours: number
  laborCost: number
  expenseCost: number
  totalCost: number
  invoicedAmount: number
  profitLoss: number
  marginPercent: number | null
  status: string
}

// === FILTER DATA FETCHERS ===

/**
 * Get active projects for filter dropdown
 */
export async function getProjectsForFilter(): Promise<ProjectForFilter[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('projects')
    .select('id, code, name')
    .is('deleted_at', null)
    .in('status', ['active', 'on_hold', 'completed'])
    .order('code')

  if (error) {
    console.error('Error fetching projects for filter:', error)
    return []
  }

  return data ?? []
}

/**
 * Get active users for filter dropdown
 */
export async function getUsersForFilter(): Promise<UserForFilter[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name')
    .eq('is_active', true)
    .order('last_name')

  if (error) {
    console.error('Error fetching users for filter:', error)
    return []
  }

  return (data ?? []).map(user => ({
    id: user.id,
    firstName: user.first_name,
    lastName: user.last_name,
  }))
}

/**
 * Get clients for filter dropdown
 */
export async function getClientsForFilter(): Promise<ClientForFilter[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('clients')
    .select('id, code, name')
    .is('deleted_at', null)
    .order('code')

  if (error) {
    console.error('Error fetching clients for filter:', error)
    return []
  }

  return data ?? []
}

// === TIMESHEET REPORT ===

/**
 * Get timesheet report data
 */
export async function getTimesheetReportData(
  filters: ReportFilters
): Promise<TimesheetReportRow[]> {
  const supabase = await createClient()

  // Build query for timesheet entries with related data
  let query = supabase
    .from('timesheet_entries')
    .select(`
      id,
      hours,
      is_billable,
      timesheet:timesheets!inner(
        id,
        week_start,
        status,
        user:profiles!timesheets_user_id_fkey(
          id,
          first_name,
          last_name
        )
      ),
      project:projects!timesheet_entries_project_id_fkey(
        id,
        code,
        name
      ),
      task:project_tasks(
        id,
        code,
        name
      ),
      billing_role:project_billing_roles(
        id,
        name,
        rate
      )
    `)
    .in('timesheet.status', ['approved', 'locked']) // Only approved/locked timesheets

  // Date range filter (on week_start)
  if (filters.startDate) {
    query = query.gte('timesheet.week_start', filters.startDate)
  }
  if (filters.endDate) {
    query = query.lte('timesheet.week_start', filters.endDate)
  }

  // Project filter
  if (filters.projectId) {
    query = query.eq('project_id', filters.projectId)
  }

  // User filter
  if (filters.userId) {
    query = query.eq('timesheet.user_id', filters.userId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching timesheet report:', error)
    return []
  }

  // Transform and aggregate data
  const rows: TimesheetReportRow[] = []

  for (const entry of data ?? []) {
    // Handle array joins
    const timesheet = Array.isArray(entry.timesheet) ? entry.timesheet[0] : entry.timesheet
    const project = Array.isArray(entry.project) ? entry.project[0] : entry.project
    const task = Array.isArray(entry.task) ? entry.task[0] : entry.task
    const billingRole = Array.isArray(entry.billing_role) ? entry.billing_role[0] : entry.billing_role
    const user = timesheet?.user
      ? (Array.isArray(timesheet.user) ? timesheet.user[0] : timesheet.user)
      : null

    if (!timesheet || !project) continue

    // Sum hours array (7 days)
    const hoursArray = entry.hours as number[]
    const totalHours = hoursArray?.reduce((sum, h) => sum + (h || 0), 0) ?? 0

    if (totalHours === 0) continue // Skip zero-hour entries

    const rate = billingRole?.rate ?? 0
    const value = totalHours * rate

    rows.push({
      userId: user?.id ?? '',
      userName: user ? `${user.first_name} ${user.last_name}` : 'Unknown',
      projectId: project.id,
      projectCode: project.code,
      projectName: project.name,
      taskCode: task?.code ?? null,
      taskName: task?.name ?? null,
      billingRoleName: billingRole?.name ?? null,
      weekStart: timesheet.week_start,
      hours: totalHours,
      rate,
      value,
      isBillable: entry.is_billable ?? true,
    })
  }

  // Sort by week, then user, then project
  rows.sort((a, b) => {
    const weekCmp = a.weekStart.localeCompare(b.weekStart)
    if (weekCmp !== 0) return weekCmp
    const userCmp = a.userName.localeCompare(b.userName)
    if (userCmp !== 0) return userCmp
    return a.projectCode.localeCompare(b.projectCode)
  })

  return rows
}

/**
 * Get timesheet summary totals
 */
export async function getTimesheetSummary(
  filters: ReportFilters
): Promise<{ totalHours: number; billableHours: number; totalValue: number }> {
  const data = await getTimesheetReportData(filters)

  const totalHours = data.reduce((sum, row) => sum + row.hours, 0)
  const billableHours = data
    .filter(row => row.isBillable)
    .reduce((sum, row) => sum + row.hours, 0)
  const totalValue = data.reduce((sum, row) => sum + row.value, 0)

  return { totalHours, billableHours, totalValue }
}

// === INVOICE REPORT ===

/**
 * Get invoice report data
 */
export async function getInvoiceReportData(
  filters: ReportFilters
): Promise<InvoiceReportRow[]> {
  const supabase = await createClient()

  let query = supabase
    .from('invoices')
    .select(`
      id,
      invoice_number,
      invoice_date,
      due_date,
      status,
      subtotal,
      gst_amount,
      qst_amount,
      total,
      client:clients!invoices_client_id_fkey(
        id,
        code,
        name
      ),
      project:projects!invoices_project_id_fkey(
        id,
        code,
        name
      )
    `)
    .neq('status', 'void')

  // Date range filter
  if (filters.startDate) {
    query = query.gte('invoice_date', filters.startDate)
  }
  if (filters.endDate) {
    query = query.lte('invoice_date', filters.endDate)
  }

  // Client filter
  if (filters.clientId) {
    query = query.eq('client_id', filters.clientId)
  }

  // Project filter
  if (filters.projectId) {
    query = query.eq('project_id', filters.projectId)
  }

  // Status filter
  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status)
  }

  query = query.order('invoice_date', { ascending: false })

  const { data, error } = await query

  if (error) {
    console.error('Error fetching invoice report:', error)
    return []
  }

  const today = new Date()

  const rows: InvoiceReportRow[] = (data ?? []).map(inv => {
    const client = Array.isArray(inv.client) ? inv.client[0] : inv.client
    const project = Array.isArray(inv.project) ? inv.project[0] : inv.project

    // Calculate days past due for sent invoices
    let daysPastDue: number | null = null
    if (inv.status === 'sent' && inv.due_date) {
      const dueDate = new Date(inv.due_date)
      const diff = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
      daysPastDue = diff > 0 ? diff : 0
    }

    return {
      invoiceId: inv.id,
      invoiceNumber: inv.invoice_number,
      clientId: client?.id ?? '',
      clientName: client?.name ?? 'Unknown',
      projectCode: project?.code ?? '',
      projectName: project?.name ?? '',
      invoiceDate: inv.invoice_date,
      dueDate: inv.due_date,
      status: inv.status,
      daysPastDue,
      subtotal: inv.subtotal ?? 0,
      gst: inv.gst_amount ?? 0,
      qst: inv.qst_amount ?? 0,
      total: inv.total ?? 0,
    }
  })

  return rows
}

/**
 * Get invoice aging summary (for sent invoices)
 */
export async function getInvoiceAgingSummary(
  filters: ReportFilters
): Promise<InvoiceAgingSummary> {
  const supabase = await createClient()

  // Get all sent invoices
  let query = supabase
    .from('invoices')
    .select('id, invoice_date, due_date, total')
    .eq('status', 'sent')

  if (filters.clientId) {
    query = query.eq('client_id', filters.clientId)
  }
  if (filters.projectId) {
    query = query.eq('project_id', filters.projectId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching invoice aging:', error)
    return { current: 0, days30to60: 0, days60to90: 0, over90: 0, total: 0 }
  }

  const today = new Date()
  const summary: InvoiceAgingSummary = {
    current: 0,
    days30to60: 0,
    days60to90: 0,
    over90: 0,
    total: 0,
  }

  for (const inv of data ?? []) {
    const total = inv.total ?? 0
    summary.total += total

    // Calculate days since invoice date (if no due date)
    const refDate = inv.due_date ? new Date(inv.due_date) : new Date(inv.invoice_date)
    const daysPast = Math.floor((today.getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24))

    if (daysPast <= 30) {
      summary.current += total
    } else if (daysPast <= 60) {
      summary.days30to60 += total
    } else if (daysPast <= 90) {
      summary.days60to90 += total
    } else {
      summary.over90 += total
    }
  }

  return summary
}

/**
 * Get invoice totals by status
 */
export async function getInvoiceTotalsByStatus(
  filters: ReportFilters
): Promise<{ draft: number; sent: number; paid: number }> {
  const data = await getInvoiceReportData(filters)

  const totals = { draft: 0, sent: 0, paid: 0 }

  for (const inv of data) {
    if (inv.status === 'draft') {
      totals.draft += inv.total
    } else if (inv.status === 'sent') {
      totals.sent += inv.total
    } else if (inv.status === 'paid') {
      totals.paid += inv.total
    }
  }

  return totals
}

// === PROFITABILITY REPORT ===

/**
 * Get project profitability report data
 */
export async function getProfitabilityReportData(
  filters: ReportFilters
): Promise<ProfitabilityReportRow[]> {
  const supabase = await createClient()

  // 1. Get projects
  let projectQuery = supabase
    .from('projects')
    .select(`
      id,
      code,
      name,
      billing_type,
      fixed_price,
      status,
      client:clients!projects_client_id_fkey(
        id,
        name
      )
    `)
    .is('deleted_at', null)

  if (filters.projectId) {
    projectQuery = projectQuery.eq('id', filters.projectId)
  }

  if (filters.clientId) {
    projectQuery = projectQuery.eq('client_id', filters.clientId)
  }

  const { data: projects, error: projectError } = await projectQuery

  if (projectError) {
    console.error('Error fetching projects for profitability:', projectError)
    return []
  }

  // 2. Get timesheet entries (labor cost)
  let timesheetQuery = supabase
    .from('timesheet_entries')
    .select(`
      project_id,
      hours,
      billing_role:project_billing_roles(rate),
      timesheet:timesheets!inner(week_start, status)
    `)
    .in('timesheet.status', ['approved', 'locked'])

  if (filters.startDate) {
    timesheetQuery = timesheetQuery.gte('timesheet.week_start', filters.startDate)
  }
  if (filters.endDate) {
    timesheetQuery = timesheetQuery.lte('timesheet.week_start', filters.endDate)
  }

  const { data: timesheetData, error: timesheetError } = await timesheetQuery

  if (timesheetError) {
    console.error('Error fetching timesheet data for profitability:', timesheetError)
  }

  // 3. Get expense entries (expense cost)
  let expenseQuery = supabase
    .from('expense_entries')
    .select(`
      project_id,
      total,
      is_billable,
      expense:expenses!inner(week_start, status)
    `)
    .eq('expense.status', 'approved')
    .eq('is_billable', true)

  if (filters.startDate) {
    expenseQuery = expenseQuery.gte('expense.week_start', filters.startDate)
  }
  if (filters.endDate) {
    expenseQuery = expenseQuery.lte('expense.week_start', filters.endDate)
  }

  const { data: expenseData, error: expenseError } = await expenseQuery

  if (expenseError) {
    console.error('Error fetching expense data for profitability:', expenseError)
  }

  // 4. Get invoices (revenue)
  let invoiceQuery = supabase
    .from('invoices')
    .select('project_id, total, status')
    .in('status', ['sent', 'paid'])

  if (filters.startDate) {
    invoiceQuery = invoiceQuery.gte('invoice_date', filters.startDate)
  }
  if (filters.endDate) {
    invoiceQuery = invoiceQuery.lte('invoice_date', filters.endDate)
  }

  const { data: invoiceData, error: invoiceError } = await invoiceQuery

  if (invoiceError) {
    console.error('Error fetching invoice data for profitability:', invoiceError)
  }

  // 5. Aggregate by project
  const projectMap = new Map<string, {
    hours: number
    laborCost: number
    expenseCost: number
    invoicedAmount: number
  }>()

  // Initialize map
  for (const p of projects ?? []) {
    projectMap.set(p.id, { hours: 0, laborCost: 0, expenseCost: 0, invoicedAmount: 0 })
  }

  // Aggregate timesheet hours + labor cost
  for (const entry of timesheetData ?? []) {
    const proj = projectMap.get(entry.project_id)
    if (!proj) continue

    const hoursArray = entry.hours as number[]
    const totalHours = hoursArray?.reduce((sum, h) => sum + (h || 0), 0) ?? 0

    // Extract rate from billing_role (handles both array and single object cases)
    const billingRole = entry.billing_role as { rate: number } | { rate: number }[] | null
    let rate = 0
    if (billingRole) {
      if (Array.isArray(billingRole)) {
        rate = billingRole[0]?.rate ?? 0
      } else {
        rate = billingRole.rate ?? 0
      }
    }

    proj.hours += totalHours
    proj.laborCost += totalHours * rate
  }

  // Aggregate expense cost
  for (const entry of expenseData ?? []) {
    const proj = projectMap.get(entry.project_id)
    if (!proj) continue
    proj.expenseCost += entry.total ?? 0
  }

  // Aggregate invoiced amount
  for (const inv of invoiceData ?? []) {
    if (!inv.project_id) continue
    const proj = projectMap.get(inv.project_id)
    if (!proj) continue
    proj.invoicedAmount += inv.total ?? 0
  }

  // 6. Build result rows
  const rows: ProfitabilityReportRow[] = []

  for (const p of projects ?? []) {
    const client = Array.isArray(p.client) ? p.client[0] : p.client
    const agg = projectMap.get(p.id) ?? { hours: 0, laborCost: 0, expenseCost: 0, invoicedAmount: 0 }

    const totalCost = agg.laborCost + agg.expenseCost
    const profitLoss = agg.invoicedAmount - totalCost
    const marginPercent = agg.invoicedAmount > 0
      ? (profitLoss / agg.invoicedAmount) * 100
      : null

    rows.push({
      projectId: p.id,
      projectCode: p.code,
      projectName: p.name,
      clientName: client?.name ?? '',
      billingType: p.billing_type ?? 'hourly',
      fixedPrice: p.fixed_price,
      totalHours: agg.hours,
      laborCost: agg.laborCost,
      expenseCost: agg.expenseCost,
      totalCost,
      invoicedAmount: agg.invoicedAmount,
      profitLoss,
      marginPercent,
      status: p.status,
    })
  }

  // Sort by project code
  rows.sort((a, b) => a.projectCode.localeCompare(b.projectCode))

  return rows
}

/**
 * Get profitability summary totals
 */
export async function getProfitabilitySummary(
  filters: ReportFilters
): Promise<{
  totalHours: number
  totalLaborCost: number
  totalExpenseCost: number
  totalInvoiced: number
  totalProfitLoss: number
}> {
  const data = await getProfitabilityReportData(filters)

  return {
    totalHours: data.reduce((sum, row) => sum + row.totalHours, 0),
    totalLaborCost: data.reduce((sum, row) => sum + row.laborCost, 0),
    totalExpenseCost: data.reduce((sum, row) => sum + row.expenseCost, 0),
    totalInvoiced: data.reduce((sum, row) => sum + row.invoicedAmount, 0),
    totalProfitLoss: data.reduce((sum, row) => sum + row.profitLoss, 0),
  }
}
