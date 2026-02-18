'use server'

import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/auth'
import { formatDateISO, getMonday } from '@/lib/date'

// === TYPE DEFINITIONS ===

export type DashboardStats = {
  openTimesheets: number
  hoursThisWeek: number
  pendingApprovals: number
  draftInvoices: number
  outstandingAmount: number
  activeProjects: number
}

export type ActivityItem = {
  id: string
  type: 'timesheet' | 'expense' | 'invoice'
  action: 'submitted' | 'approved' | 'rejected' | 'sent' | 'paid'
  entityLabel: string
  userId: string
  userName: string
  timestamp: string
  relativeTime: string
}

// === DASHBOARD STATS ===

/**
 * Get dashboard stats for the current user
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = await createClient()
  const profile = await getProfile()
  const userId = profile?.id

  const currentWeekStart = formatDateISO(getMonday(new Date()))

  // Run all queries in parallel
  const [
    openTimesheetsResult,
    hoursThisWeekResult,
    pendingApprovalsResult,
    draftInvoicesResult,
    outstandingResult,
    activeProjectsResult,
  ] = await Promise.all([
    // 1. Open timesheets (current user's draft timesheets)
    userId
      ? supabase
          .from('timesheets')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('status', 'draft')
      : Promise.resolve({ count: 0, error: null }),

    // 2. Hours this week (current user)
    userId
      ? supabase
          .from('timesheet_entries')
          .select(`
            hours,
            timesheet:timesheets!inner(week_start, user_id)
          `)
          .eq('timesheet.user_id', userId)
          .eq('timesheet.week_start', currentWeekStart)
      : Promise.resolve({ data: [], error: null }),

    // 3. Pending approvals (timesheets waiting for manager approval)
    // For simplicity, count all submitted timesheets if user has approval permission
    supabase
      .from('timesheets')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'submitted'),

    // 4. Draft invoices
    supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'draft'),

    // 5. Outstanding amount (sent invoices total)
    supabase
      .from('invoices')
      .select('total')
      .eq('status', 'sent'),

    // 6. Active projects
    supabase
      .from('projects')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
      .is('deleted_at', null),
  ])

  // Calculate hours this week
  let hoursThisWeek = 0
  if (hoursThisWeekResult.data) {
    for (const entry of hoursThisWeekResult.data) {
      const hoursArray = entry.hours as number[]
      if (hoursArray) {
        hoursThisWeek += hoursArray.reduce((sum, h) => sum + (h ?? 0), 0)
      }
    }
  }

  // Calculate outstanding amount
  let outstandingAmount = 0
  if (outstandingResult.data) {
    outstandingAmount = outstandingResult.data.reduce(
      (sum, inv) => sum + (inv.total ?? 0),
      0
    )
  }

  return {
    openTimesheets: openTimesheetsResult.count ?? 0,
    hoursThisWeek,
    pendingApprovals: pendingApprovalsResult.count ?? 0,
    draftInvoices: draftInvoicesResult.count ?? 0,
    outstandingAmount,
    activeProjects: activeProjectsResult.count ?? 0,
  }
}

// === RECENT ACTIVITY ===

/**
 * Get recent activity across timesheets, expenses, and invoices
 */
export async function getRecentActivity(limit: number = 10): Promise<ActivityItem[]> {
  const supabase = await createClient()

  const activities: ActivityItem[] = []

  // Fetch recent timesheet activity (submitted, approved)
  const { data: timesheetActivity } = await supabase
    .from('timesheets')
    .select(`
      id,
      week_start,
      status,
      submitted_at,
      approved_at,
      user:profiles!timesheets_user_id_fkey(id, first_name, last_name)
    `)
    .in('status', ['submitted', 'approved', 'rejected'])
    .order('updated_at', { ascending: false })
    .limit(limit)

  for (const ts of timesheetActivity ?? []) {
    const user = Array.isArray(ts.user) ? ts.user[0] : ts.user

    // Determine action and timestamp
    let action: ActivityItem['action'] = 'submitted'
    let timestamp = ts.submitted_at

    if (ts.status === 'approved' && ts.approved_at) {
      action = 'approved'
      timestamp = ts.approved_at
    } else if (ts.status === 'rejected') {
      action = 'rejected'
    }

    if (timestamp) {
      activities.push({
        id: `ts-${ts.id}`,
        type: 'timesheet',
        action,
        entityLabel: `Week of ${formatWeekLabel(ts.week_start)}`,
        userId: user?.id ?? '',
        userName: user ? `${user.first_name} ${user.last_name}` : 'Unknown',
        timestamp,
        relativeTime: getRelativeTime(timestamp),
      })
    }
  }

  // Fetch recent expense activity
  const { data: expenseActivity } = await supabase
    .from('expenses')
    .select(`
      id,
      week_start,
      status,
      submitted_at,
      approved_at,
      user:profiles!expenses_user_id_fkey(id, first_name, last_name)
    `)
    .in('status', ['submitted', 'approved', 'rejected'])
    .order('updated_at', { ascending: false })
    .limit(limit)

  for (const exp of expenseActivity ?? []) {
    const user = Array.isArray(exp.user) ? exp.user[0] : exp.user

    let action: ActivityItem['action'] = 'submitted'
    let timestamp = exp.submitted_at

    if (exp.status === 'approved' && exp.approved_at) {
      action = 'approved'
      timestamp = exp.approved_at
    } else if (exp.status === 'rejected') {
      action = 'rejected'
    }

    if (timestamp) {
      activities.push({
        id: `exp-${exp.id}`,
        type: 'expense',
        action,
        entityLabel: `Expenses for ${formatWeekLabel(exp.week_start)}`,
        userId: user?.id ?? '',
        userName: user ? `${user.first_name} ${user.last_name}` : 'Unknown',
        timestamp,
        relativeTime: getRelativeTime(timestamp),
      })
    }
  }

  // Fetch recent invoice activity (sent, paid)
  const { data: invoiceActivity } = await supabase
    .from('invoices')
    .select(`
      id,
      invoice_number,
      status,
      sent_at,
      paid_at,
      created_by:profiles!invoices_created_by_fkey(id, first_name, last_name)
    `)
    .in('status', ['sent', 'paid'])
    .order('updated_at', { ascending: false })
    .limit(limit)

  for (const inv of invoiceActivity ?? []) {
    const user = Array.isArray(inv.created_by) ? inv.created_by[0] : inv.created_by

    let action: ActivityItem['action'] = 'sent'
    let timestamp = inv.sent_at

    if (inv.status === 'paid' && inv.paid_at) {
      action = 'paid'
      timestamp = inv.paid_at
    }

    if (timestamp) {
      activities.push({
        id: `inv-${inv.id}`,
        type: 'invoice',
        action,
        entityLabel: inv.invoice_number,
        userId: user?.id ?? '',
        userName: user ? `${user.first_name} ${user.last_name}` : 'Unknown',
        timestamp,
        relativeTime: getRelativeTime(timestamp),
      })
    }
  }

  // Sort by timestamp descending and limit
  activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return activities.slice(0, limit)
}

// === HELPERS ===

function formatWeekLabel(weekStart: string): string {
  const date = new Date(weekStart)
  return date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
}

function getRelativeTime(timestamp: string): string {
  const now = new Date()
  const date = new Date(timestamp)
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffSec < 60) return 'just now'
  if (diffMin < 60) return `${diffMin} min ago`
  if (diffHr < 24) return `${diffHr} hr ago`
  if (diffDay === 1) return 'yesterday'
  if (diffDay < 7) return `${diffDay} days ago`

  return date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
}
