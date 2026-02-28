'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getUserPermissions, hasPermission, getProfile } from '@/lib/auth'
import { formatDateISO, getMonday, getSunday, getPreviousWeekStart, formatWeekRangeLocale } from '@/lib/date'
import { logAudit } from '@/lib/audit'
import { sendTimesheetReminder } from '@/lib/email'
import { timesheetEntrySchema } from '@/lib/validations/timesheet'
import type { Enums, Tables } from '@/types/database'

type TimesheetStatus = Enums<'timesheet_status'>

// === TYPE DEFINITIONS ===

export type TimesheetWithUser = Tables<'timesheets'> & {
  user: {
    id: string
    first_name: string
    last_name: string
    email: string
  } | null
  total_hours?: number
}

export type TimesheetEntryWithRelations = Tables<'timesheet_entries'> & {
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

export type ProjectForTimesheet = {
  id: string
  code: string
  name: string
  tasks: { id: string; code: string; name: string }[]
  billing_roles: { id: string; name: string; rate: number }[]
}

// === QUERY FUNCTIONS ===

/**
 * Get list of timesheets for a user (paginated)
 */
export async function getTimesheets(options?: {
  userId?: string
  status?: TimesheetStatus
  limit?: number
  offset?: number
}): Promise<{ timesheets: TimesheetWithUser[]; count: number }> {
  const supabase = await createClient()
  const { userId, status, limit = 25, offset = 0 } = options ?? {}

  // Get current user if no userId specified
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const targetUserId = userId ?? user?.id

  if (!targetUserId) {
    return { timesheets: [], count: 0 }
  }

  // Security check: if querying another user's timesheets, verify permission
  if (userId && userId !== user?.id) {
    const permissions = await getUserPermissions()
    if (!hasPermission(permissions, 'timesheets.view_all') && !hasPermission(permissions, 'admin.manage')) {
      return { timesheets: [], count: 0 }
    }
  }

  let query = supabase
    .from('timesheets')
    .select(
      `
      *,
      user:profiles!timesheets_user_id_fkey(id, first_name, last_name, email)
    `,
      { count: 'exact' }
    )
    .eq('user_id', targetUserId)

  if (status) {
    query = query.eq('status', status)
  }

  query = query.order('week_start', { ascending: false }).range(offset, offset + limit - 1)

  const { data, count, error } = await query

  if (error) {
    console.error('Error fetching timesheets:', error)
    return { timesheets: [], count: 0 }
  }

  // Calculate total hours for each timesheet
  const timesheetIds = (data ?? []).map((ts) => ts.id)

  if (timesheetIds.length > 0) {
    const { data: entries } = await supabase
      .from('timesheet_entries')
      .select('timesheet_id, hours')
      .in('timesheet_id', timesheetIds)

    const hoursByTimesheet = new Map<string, number>()
    entries?.forEach((entry) => {
      const total = entry.hours?.reduce((sum: number, h: number | null) => sum + (h ?? 0), 0) ?? 0
      hoursByTimesheet.set(entry.timesheet_id, (hoursByTimesheet.get(entry.timesheet_id) ?? 0) + total)
    })

    const timesheets = (data ?? []).map((ts) => ({
      ...ts,
      user: Array.isArray(ts.user) ? ts.user[0] ?? null : ts.user,
      total_hours: hoursByTimesheet.get(ts.id) ?? 0,
    })) as TimesheetWithUser[]

    return { timesheets, count: count ?? 0 }
  }

  const timesheets = (data ?? []).map((ts) => ({
    ...ts,
    user: Array.isArray(ts.user) ? ts.user[0] ?? null : ts.user,
    total_hours: 0,
  })) as TimesheetWithUser[]

  return { timesheets, count: count ?? 0 }
}

/**
 * Get or create a timesheet for a specific week
 */
export async function getOrCreateTimesheet(weekStart: string, userId?: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const targetUserId = userId ?? user?.id

  if (!targetUserId) {
    return { error: 'Not authenticated' }
  }

  // Check impersonation permission if entering for others
  if (userId && userId !== user?.id) {
    const permissions = await getUserPermissions()
    if (!hasPermission(permissions, 'timesheets.impersonate')) {
      return { error: 'Not authorized to enter time for others' }
    }
  }

  // Ensure weekStart is a Monday
  const monday = getMonday(new Date(weekStart))
  const weekStartISO = formatDateISO(monday)
  const weekEndISO = formatDateISO(getSunday(monday))

  // Try to get existing timesheet
  const { data: existing } = await supabase
    .from('timesheets')
    .select('*')
    .eq('user_id', targetUserId)
    .eq('week_start', weekStartISO)
    .single()

  if (existing) {
    return { timesheet: existing }
  }

  // Create new timesheet
  const { data: timesheet, error } = await supabase
    .from('timesheets')
    .insert({
      user_id: targetUserId,
      week_start: weekStartISO,
      week_end: weekEndISO,
      status: 'draft',
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating timesheet:', error)
    return { error: 'Failed to create timesheet' }
  }

  return { timesheet }
}

/**
 * Get a timesheet by ID with all entries
 */
export async function getTimesheetById(timesheetId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('timesheets')
    .select(
      `
      *,
      user:profiles!timesheets_user_id_fkey(id, first_name, last_name, email, manager_id),
      entries:timesheet_entries(
        *,
        project:projects!timesheet_entries_project_id_fkey(id, code, name),
        task:project_tasks!timesheet_entries_task_id_fkey(id, code, name),
        billing_role:project_billing_roles!timesheet_entries_billing_role_id_fkey(id, name, rate)
      )
    `
    )
    .eq('id', timesheetId)
    .single()

  if (error) {
    console.error('Error fetching timesheet:', error)
    return null
  }

  return data
}

/**
 * Get pending approvals for a manager
 */
export async function getPendingApprovals(): Promise<{ timesheets: TimesheetWithUser[]; count: number }> {
  const supabase = await createClient()
  const profile = await getProfile()

  if (!profile) {
    return { timesheets: [], count: 0 }
  }

  // Get timesheets submitted by direct reports
  const { data, count: _count, error } = await supabase
    .from('timesheets')
    .select(
      `
      *,
      user:profiles!timesheets_user_id_fkey(id, first_name, last_name, email, manager_id)
    `,
      { count: 'exact' }
    )
    .eq('status', 'submitted')

  if (error) {
    console.error('Error fetching pending approvals:', error)
    return { timesheets: [], count: 0 }
  }

  // Filter to only direct reports (where manager_id matches current user)
  const directReportTimesheets = (data ?? []).filter((ts) => {
    const user = Array.isArray(ts.user) ? ts.user[0] : ts.user
    return user?.manager_id === profile.id
  })

  // Calculate total hours
  const timesheetIds = directReportTimesheets.map((ts) => ts.id)

  if (timesheetIds.length > 0) {
    const { data: entries } = await supabase
      .from('timesheet_entries')
      .select('timesheet_id, hours')
      .in('timesheet_id', timesheetIds)

    const hoursByTimesheet = new Map<string, number>()
    entries?.forEach((entry) => {
      const total = entry.hours?.reduce((sum: number, h: number | null) => sum + (h ?? 0), 0) ?? 0
      hoursByTimesheet.set(entry.timesheet_id, (hoursByTimesheet.get(entry.timesheet_id) ?? 0) + total)
    })

    const timesheets = directReportTimesheets.map((ts) => ({
      ...ts,
      user: Array.isArray(ts.user) ? ts.user[0] ?? null : ts.user,
      total_hours: hoursByTimesheet.get(ts.id) ?? 0,
    })) as TimesheetWithUser[]

    return { timesheets, count: timesheets.length }
  }

  const timesheets = directReportTimesheets.map((ts) => ({
    ...ts,
    user: Array.isArray(ts.user) ? ts.user[0] ?? null : ts.user,
    total_hours: 0,
  })) as TimesheetWithUser[]

  return { timesheets, count: timesheets.length }
}

/**
 * Get projects the user can log time to
 */
export async function getUserProjects(userId?: string): Promise<ProjectForTimesheet[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const targetUserId = userId ?? user?.id

  if (!targetUserId) {
    return []
  }

  // Get projects where user is a team member or project is global
  const { data: projects, error } = await supabase
    .from('projects')
    .select(
      `
      id,
      code,
      name,
      tasks:project_tasks(id, code, name),
      billing_roles:project_billing_roles!project_billing_roles_project_id_fkey(id, name, rate)
    `
    )
    .or(`is_global.eq.true,project_manager_id.eq.${targetUserId}`)
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('code')

  if (error) {
    console.error('Error fetching user projects:', error)
    return []
  }

  // Also get projects where user is a member
  const { data: memberProjects } = await supabase
    .from('project_members')
    .select(
      `
      project:projects!project_members_project_id_fkey(
        id,
        code,
        name,
        status,
        deleted_at,
        tasks:project_tasks(id, code, name),
        billing_roles:project_billing_roles!project_billing_roles_project_id_fkey(id, name, rate)
      )
    `
    )
    .eq('user_id', targetUserId)
    .eq('is_active', true)

  // Combine and deduplicate
  const projectMap = new Map<string, ProjectForTimesheet>()

  projects?.forEach((p) => {
    projectMap.set(p.id, {
      id: p.id,
      code: p.code,
      name: p.name,
      tasks: p.tasks ?? [],
      billing_roles: p.billing_roles ?? [],
    })
  })

  memberProjects?.forEach((mp) => {
    const project = Array.isArray(mp.project) ? mp.project[0] : mp.project
    if (project && project.status === 'active' && !project.deleted_at) {
      projectMap.set(project.id, {
        id: project.id,
        code: project.code,
        name: project.name,
        tasks: project.tasks ?? [],
        billing_roles: project.billing_roles ?? [],
      })
    }
  })

  return Array.from(projectMap.values()).sort((a, b) => a.code.localeCompare(b.code))
}

// === MUTATION FUNCTIONS ===

/**
 * Save a timesheet entry (create or update)
 */
export async function saveTimesheetEntry(
  timesheetId: string,
  entry: {
    id?: string
    project_id: string
    task_id?: string | null
    billing_role_id?: string | null
    description?: string | null
    hours: number[]
    is_billable?: boolean
  }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Verify timesheet exists and is editable
  const { data: timesheet, error: tsError } = await supabase
    .from('timesheets')
    .select('id, status, user_id')
    .eq('id', timesheetId)
    .single()

  if (tsError || !timesheet) {
    return { error: 'Timesheet not found' }
  }

  if (timesheet.status !== 'draft') {
    return { error: 'Timesheet is not editable' }
  }

  // Verify ownership or impersonation permission
  if (timesheet.user_id !== user?.id) {
    const permissions = await getUserPermissions()
    if (!hasPermission(permissions, 'timesheets.impersonate')) {
      return { error: 'Not authorized' }
    }
  }

  // Validate entry
  const validation = timesheetEntrySchema.safeParse(entry)
  if (!validation.success) {
    return { error: validation.error.issues[0]?.message ?? 'Validation failed' }
  }

  const entryData = {
    timesheet_id: timesheetId,
    project_id: entry.project_id,
    task_id: entry.task_id || null,
    billing_role_id: entry.billing_role_id || null,
    description: entry.description || null,
    hours: entry.hours,
    is_billable: entry.is_billable ?? true,
  }

  if (entry.id) {
    // Update existing
    const { data, error } = await supabase
      .from('timesheet_entries')
      .update(entryData)
      .eq('id', entry.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating entry:', error)
      return { error: 'Failed to update entry' }
    }

    revalidatePath('/timesheets')
    return { entry: data }
  } else {
    // Create new
    const { data, error } = await supabase.from('timesheet_entries').insert(entryData).select().single()

    if (error) {
      console.error('Error creating entry:', error)
      return { error: 'Failed to create entry' }
    }

    revalidatePath('/timesheets')
    return { entry: data }
  }
}

/**
 * Delete a timesheet entry
 */
export async function deleteTimesheetEntry(entryId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Get entry with timesheet info
  const { data: entry, error: entryError } = await supabase
    .from('timesheet_entries')
    .select('id, timesheet:timesheets!timesheet_entries_timesheet_id_fkey(id, status, user_id)')
    .eq('id', entryId)
    .single()

  if (entryError || !entry) {
    return { error: 'Entry not found' }
  }

  const timesheet = Array.isArray(entry.timesheet) ? entry.timesheet[0] : entry.timesheet

  if (!timesheet || timesheet.status !== 'draft') {
    return { error: 'Cannot delete from non-draft timesheet' }
  }

  // Verify ownership or impersonation permission
  if (timesheet.user_id !== user?.id) {
    const permissions = await getUserPermissions()
    if (!hasPermission(permissions, 'timesheets.impersonate')) {
      return { error: 'Not authorized' }
    }
  }

  const { error } = await supabase.from('timesheet_entries').delete().eq('id', entryId)

  if (error) {
    console.error('Error deleting entry:', error)
    return { error: 'Failed to delete entry' }
  }

  revalidatePath('/timesheets')
  return { success: true }
}

/**
 * Submit a timesheet for approval
 */
export async function submitTimesheet(timesheetId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Get timesheet
  const { data: timesheet, error: tsError } = await supabase
    .from('timesheets')
    .select('id, status, user_id')
    .eq('id', timesheetId)
    .single()

  if (tsError || !timesheet) {
    return { error: 'Timesheet not found' }
  }

  // Verify ownership
  if (timesheet.user_id !== user?.id) {
    return { error: 'Can only submit your own timesheet' }
  }

  // Verify status
  if (timesheet.status !== 'draft') {
    return { error: 'Timesheet already submitted' }
  }

  // Verify has entries
  const { count } = await supabase
    .from('timesheet_entries')
    .select('*', { count: 'exact', head: true })
    .eq('timesheet_id', timesheetId)

  if (!count || count === 0) {
    return { error: 'Cannot submit empty timesheet' }
  }

  // Update status
  const { error } = await supabase
    .from('timesheets')
    .update({
      status: 'submitted',
      submitted_at: new Date().toISOString(),
    })
    .eq('id', timesheetId)

  if (error) {
    console.error('Error submitting timesheet:', error)
    return { error: 'Failed to submit timesheet' }
  }

  revalidatePath('/timesheets')
  return { success: true }
}

/**
 * Approve a timesheet (manager only)
 */
export async function approveTimesheet(timesheetId: string) {
  const supabase = await createClient()
  const profile = await getProfile()

  if (!profile) {
    return { error: 'Not authenticated' }
  }

  // Get timesheet with owner's manager
  const { data: timesheet, error: tsError } = await supabase
    .from('timesheets')
    .select(
      `
      id,
      status,
      user_id,
      owner:profiles!timesheets_user_id_fkey(manager_id)
    `
    )
    .eq('id', timesheetId)
    .single()

  if (tsError || !timesheet) {
    return { error: 'Timesheet not found' }
  }

  const owner = Array.isArray(timesheet.owner) ? timesheet.owner[0] : timesheet.owner

  // Verify user is owner's manager
  if (owner?.manager_id !== profile.id) {
    return { error: 'Only direct manager can approve' }
  }

  // Verify status
  if (timesheet.status !== 'submitted') {
    return { error: 'Timesheet not pending approval' }
  }

  // Approve
  const { error } = await supabase
    .from('timesheets')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: profile.id,
    })
    .eq('id', timesheetId)

  if (error) {
    console.error('Error approving timesheet:', error)
    return { error: 'Failed to approve timesheet' }
  }

  // Audit log
  await logAudit({
    action: 'approve',
    entityType: 'timesheet',
    entityId: timesheetId,
    oldValues: { status: 'submitted' },
    newValues: { status: 'approved', approved_by: profile.id },
  })

  revalidatePath('/timesheets')
  return { success: true }
}

/**
 * Reject a timesheet (manager only)
 */
export async function rejectTimesheet(timesheetId: string, reason?: string) {
  const supabase = await createClient()
  const profile = await getProfile()

  if (!profile) {
    return { error: 'Not authenticated' }
  }

  // Get timesheet with owner's manager
  const { data: timesheet, error: tsError } = await supabase
    .from('timesheets')
    .select(
      `
      id,
      status,
      user_id,
      owner:profiles!timesheets_user_id_fkey(manager_id)
    `
    )
    .eq('id', timesheetId)
    .single()

  if (tsError || !timesheet) {
    return { error: 'Timesheet not found' }
  }

  const owner = Array.isArray(timesheet.owner) ? timesheet.owner[0] : timesheet.owner

  // Verify user is owner's manager
  if (owner?.manager_id !== profile.id) {
    return { error: 'Only direct manager can reject' }
  }

  // Verify status (can reject submitted or approved)
  if (!['submitted', 'approved'].includes(timesheet.status ?? '')) {
    return { error: 'Cannot reject this timesheet' }
  }

  // Reset to draft
  const { error } = await supabase
    .from('timesheets')
    .update({
      status: 'draft',
      submitted_at: null,
      approved_at: null,
      approved_by: null,
      rejection_reason: reason || null,
    })
    .eq('id', timesheetId)

  if (error) {
    console.error('Error rejecting timesheet:', error)
    return { error: 'Failed to reject timesheet' }
  }

  // Audit log
  await logAudit({
    action: 'reject',
    entityType: 'timesheet',
    entityId: timesheetId,
    oldValues: { status: timesheet.status },
    newValues: { status: 'draft', rejection_reason: reason || null },
  })

  revalidatePath('/timesheets')
  return { success: true }
}

/**
 * Copy entries from previous week
 */
export async function copyPreviousWeek(timesheetId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Get current timesheet
  const { data: current, error: tsError } = await supabase
    .from('timesheets')
    .select('id, user_id, week_start, status')
    .eq('id', timesheetId)
    .single()

  if (tsError || !current) {
    return { error: 'Timesheet not found' }
  }

  if (current.status !== 'draft') {
    return { error: 'Can only copy to draft timesheets' }
  }

  // Verify ownership or impersonation
  if (current.user_id !== user?.id) {
    const permissions = await getUserPermissions()
    if (!hasPermission(permissions, 'timesheets.impersonate')) {
      return { error: 'Not authorized' }
    }
  }

  // Get previous week's timesheet
  const prevWeekStart = getPreviousWeekStart(new Date(current.week_start))
  const prevWeekISO = formatDateISO(prevWeekStart)

  const { data: previous } = await supabase
    .from('timesheets')
    .select(
      `
      id,
      entries:timesheet_entries(
        project_id,
        task_id,
        billing_role_id,
        description,
        is_billable
      )
    `
    )
    .eq('user_id', current.user_id)
    .eq('week_start', prevWeekISO)
    .single()

  if (!previous || !previous.entries || previous.entries.length === 0) {
    return { error: 'No entries to copy from previous week' }
  }

  // Delete existing entries in current timesheet
  await supabase.from('timesheet_entries').delete().eq('timesheet_id', timesheetId)

  // Copy entries (without hours - user fills those in)
  const newEntries = previous.entries.map((entry) => ({
    timesheet_id: timesheetId,
    project_id: entry.project_id,
    task_id: entry.task_id,
    billing_role_id: entry.billing_role_id,
    description: entry.description,
    is_billable: entry.is_billable,
    hours: [0, 0, 0, 0, 0, 0, 0], // Empty hours
  }))

  const { error } = await supabase.from('timesheet_entries').insert(newEntries)

  if (error) {
    console.error('Error copying entries:', error)
    return { error: 'Failed to copy entries' }
  }

  revalidatePath('/timesheets')
  return { success: true, entriesCopied: newEntries.length }
}

// === TEAM TIMESHEETS (ADMIN VIEW) ===

export type TeamTimesheetRow = {
  userId: string
  firstName: string
  lastName: string
  email: string
  timesheetId: string | null
  status: 'not_started' | 'draft' | 'submitted' | 'approved' | 'rejected' | 'locked'
  totalHours: number
  submittedAt: string | null
  approvedAt: string | null
}

export type TeamTimesheetSummary = {
  total: number
  notStarted: number
  draft: number
  submitted: number
  approved: number
  totalHours: number
}

/**
 * Get all team members with their timesheet status for a specific week
 * Requires timesheets.view_all permission (admin)
 */
export async function getTeamTimesheetsByWeek(
  weekStart: string
): Promise<{ rows: TeamTimesheetRow[]; summary: TeamTimesheetSummary }> {
  const supabase = await createClient()
  const permissions = await getUserPermissions()

  // Check permission
  if (!hasPermission(permissions, 'timesheets.view_all') && !hasPermission(permissions, 'admin.manage')) {
    return {
      rows: [],
      summary: { total: 0, notStarted: 0, draft: 0, submitted: 0, approved: 0, totalHours: 0 },
    }
  }

  // Normalize to Monday
  const monday = getMonday(new Date(weekStart))
  const weekStartISO = formatDateISO(monday)

  // Get all active users
  const { data: users, error: usersError } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('last_name')
    .order('first_name')

  if (usersError || !users) {
    console.error('Error fetching users:', usersError)
    return {
      rows: [],
      summary: { total: 0, notStarted: 0, draft: 0, submitted: 0, approved: 0, totalHours: 0 },
    }
  }

  // Get all timesheets for this week
  const { data: timesheets, error: tsError } = await supabase
    .from('timesheets')
    .select('id, user_id, status, submitted_at, approved_at')
    .eq('week_start', weekStartISO)

  if (tsError) {
    console.error('Error fetching timesheets:', tsError)
  }

  // Get hours for each timesheet
  const timesheetIds = (timesheets ?? []).map((ts) => ts.id)
  let hoursByTimesheet = new Map<string, number>()

  if (timesheetIds.length > 0) {
    const { data: entries } = await supabase
      .from('timesheet_entries')
      .select('timesheet_id, hours')
      .in('timesheet_id', timesheetIds)

    entries?.forEach((entry) => {
      const total = entry.hours?.reduce((sum: number, h: number | null) => sum + (h ?? 0), 0) ?? 0
      hoursByTimesheet.set(entry.timesheet_id, (hoursByTimesheet.get(entry.timesheet_id) ?? 0) + total)
    })
  }

  // Build lookup map
  const timesheetByUser = new Map(timesheets?.map((ts) => [ts.user_id, ts]) ?? [])

  // Build rows
  const rows: TeamTimesheetRow[] = users.map((user) => {
    const ts = timesheetByUser.get(user.id)
    const hours = ts ? hoursByTimesheet.get(ts.id) ?? 0 : 0

    return {
      userId: user.id,
      firstName: user.first_name ?? '',
      lastName: user.last_name ?? '',
      email: user.email ?? '',
      timesheetId: ts?.id ?? null,
      status: ts?.status ?? 'not_started',
      totalHours: hours,
      submittedAt: ts?.submitted_at ?? null,
      approvedAt: ts?.approved_at ?? null,
    }
  })

  // Calculate summary
  const summary: TeamTimesheetSummary = {
    total: rows.length,
    notStarted: rows.filter((r) => r.status === 'not_started').length,
    draft: rows.filter((r) => r.status === 'draft').length,
    submitted: rows.filter((r) => r.status === 'submitted').length,
    approved: rows.filter((r) => r.status === 'approved' || r.status === 'locked').length,
    totalHours: rows.reduce((sum, r) => sum + r.totalHours, 0),
  }

  return { rows, summary }
}

/**
 * Bulk approve multiple timesheets
 */
export async function bulkApproveTimesheets(timesheetIds: string[]) {
  const supabase = await createClient()
  const profile = await getProfile()

  if (!profile) {
    return { error: 'Not authenticated' }
  }

  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'timesheets.approve') && !hasPermission(permissions, 'admin.manage')) {
    return { error: 'Not authorized to approve timesheets' }
  }

  // Get all submitted timesheets
  const { data: timesheets, error: fetchError } = await supabase
    .from('timesheets')
    .select('id, status, user_id')
    .in('id', timesheetIds)
    .eq('status', 'submitted')

  if (fetchError || !timesheets || timesheets.length === 0) {
    return { error: 'No submitted timesheets found' }
  }

  // Approve all
  const { error: updateError } = await supabase
    .from('timesheets')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: profile.id,
    })
    .in('id', timesheets.map((ts) => ts.id))

  if (updateError) {
    console.error('Error bulk approving:', updateError)
    return { error: 'Failed to approve timesheets' }
  }

  // Audit log for each timesheet
  for (const ts of timesheets) {
    await logAudit({
      action: 'approve',
      entityType: 'timesheet',
      entityId: ts.id,
      oldValues: { status: 'submitted' },
      newValues: { status: 'approved', approved_by: profile.id, bulk: true },
    })
  }

  revalidatePath('/timesheets')
  return { success: true, approvedCount: timesheets.length }
}

// === COMBINED SUBMISSION (PHASE 3) ===

/**
 * Submit both timesheet and expenses for a week in one action
 * Creates expense report if it doesn't exist but has no entries
 */
export async function submitWeek(weekStart: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Normalize to Monday
  const monday = getMonday(new Date(weekStart))
  const weekStartISO = formatDateISO(monday)

  // Get timesheet for this week
  const { data: timesheet } = await supabase
    .from('timesheets')
    .select('id, status, user_id')
    .eq('user_id', user.id)
    .eq('week_start', weekStartISO)
    .single()

  // Get expense report for this week
  const { data: expense } = await supabase
    .from('expenses')
    .select('id, status, user_id')
    .eq('user_id', user.id)
    .eq('week_start', weekStartISO)
    .single()

  const results: {
    timesheetSubmitted: boolean
    expenseSubmitted: boolean
    timesheetError?: string
    expenseError?: string
  } = {
    timesheetSubmitted: false,
    expenseSubmitted: false,
  }

  // Submit timesheet if exists and is draft
  if (timesheet) {
    if (timesheet.status === 'draft') {
      // Check has entries
      const { count: entryCount } = await supabase
        .from('timesheet_entries')
        .select('*', { count: 'exact', head: true })
        .eq('timesheet_id', timesheet.id)

      if (entryCount && entryCount > 0) {
        const { error: tsError } = await supabase
          .from('timesheets')
          .update({
            status: 'submitted',
            submitted_at: new Date().toISOString(),
          })
          .eq('id', timesheet.id)

        if (tsError) {
          results.timesheetError = 'Failed to submit timesheet'
        } else {
          results.timesheetSubmitted = true
        }
      } else {
        results.timesheetError = 'No timesheet entries to submit'
      }
    } else if (timesheet.status === 'submitted' || timesheet.status === 'approved') {
      results.timesheetError = 'Timesheet already submitted'
    }
  } else {
    results.timesheetError = 'No timesheet for this week'
  }

  // Submit expense if exists and is draft
  if (expense) {
    if (expense.status === 'draft') {
      // Check has entries
      const { count: expEntryCount } = await supabase
        .from('expense_entries')
        .select('*', { count: 'exact', head: true })
        .eq('expense_id', expense.id)

      if (expEntryCount && expEntryCount > 0) {
        const { error: expError } = await supabase
          .from('expenses')
          .update({
            status: 'submitted',
            submitted_at: new Date().toISOString(),
          })
          .eq('id', expense.id)

        if (expError) {
          results.expenseError = 'Failed to submit expenses'
        } else {
          results.expenseSubmitted = true
        }
      } else {
        // No expense entries - this is OK, not an error
        results.expenseError = 'No expense entries'
      }
    } else if (expense.status === 'submitted' || expense.status === 'approved') {
      results.expenseError = 'Expenses already submitted'
    }
  }
  // No expense report is OK - not everyone has expenses

  revalidatePath('/timesheets')
  revalidatePath('/expenses')

  // Return success if at least timesheet was submitted
  if (results.timesheetSubmitted) {
    return { success: true, ...results }
  }

  return { error: results.timesheetError || 'Nothing to submit', ...results }
}

// === GRANULAR APPROVAL FOR TEAM VIEW (PHASE 3) ===

/**
 * Admin approve timesheet only (granular approval)
 */
export async function approveTimesheetOnly(timesheetId: string) {
  const supabase = await createClient()
  const profile = await getProfile()

  if (!profile) {
    return { error: 'Not authenticated' }
  }

  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'timesheets.approve') && !hasPermission(permissions, 'admin.manage')) {
    return { error: 'Not authorized to approve timesheets' }
  }

  // Get timesheet
  const { data: timesheet, error: tsError } = await supabase
    .from('timesheets')
    .select('id, status')
    .eq('id', timesheetId)
    .single()

  if (tsError || !timesheet) {
    return { error: 'Timesheet not found' }
  }

  if (timesheet.status !== 'submitted') {
    return { error: 'Timesheet not pending approval' }
  }

  const { error } = await supabase
    .from('timesheets')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: profile.id,
    })
    .eq('id', timesheetId)

  if (error) {
    console.error('Error approving timesheet:', error)
    return { error: 'Failed to approve timesheet' }
  }

  // Audit log
  await logAudit({
    action: 'approve',
    entityType: 'timesheet',
    entityId: timesheetId,
    oldValues: { status: 'submitted' },
    newValues: { status: 'approved', approved_by: profile.id },
  })

  revalidatePath('/timesheets')
  return { success: true }
}

/**
 * Admin reject timesheet only (granular rejection)
 */
export async function rejectTimesheetOnly(timesheetId: string, reason?: string) {
  const supabase = await createClient()
  const profile = await getProfile()

  if (!profile) {
    return { error: 'Not authenticated' }
  }

  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'timesheets.approve') && !hasPermission(permissions, 'admin.manage')) {
    return { error: 'Not authorized to reject timesheets' }
  }

  // Get timesheet
  const { data: timesheet, error: tsError } = await supabase
    .from('timesheets')
    .select('id, status')
    .eq('id', timesheetId)
    .single()

  if (tsError || !timesheet) {
    return { error: 'Timesheet not found' }
  }

  if (!['submitted', 'approved'].includes(timesheet.status ?? '')) {
    return { error: 'Cannot reject this timesheet' }
  }

  const previousStatus = timesheet.status

  const { error } = await supabase
    .from('timesheets')
    .update({
      status: 'draft',
      submitted_at: null,
      approved_at: null,
      approved_by: null,
      rejection_reason: reason || null,
    })
    .eq('id', timesheetId)

  if (error) {
    console.error('Error rejecting timesheet:', error)
    return { error: 'Failed to reject timesheet' }
  }

  // Audit log
  await logAudit({
    action: 'reject',
    entityType: 'timesheet',
    entityId: timesheetId,
    oldValues: { status: previousStatus },
    newValues: { status: 'draft', rejection_reason: reason || null },
  })

  revalidatePath('/timesheets')
  return { success: true }
}

/**
 * Admin approve expenses only (granular approval)
 */
export async function approveExpensesOnly(expenseId: string) {
  const supabase = await createClient()
  const profile = await getProfile()

  if (!profile) {
    return { error: 'Not authenticated' }
  }

  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'expenses.approve') && !hasPermission(permissions, 'admin.manage')) {
    return { error: 'Not authorized to approve expenses' }
  }

  // Get expense
  const { data: expense, error: expError } = await supabase
    .from('expenses')
    .select('id, status')
    .eq('id', expenseId)
    .single()

  if (expError || !expense) {
    return { error: 'Expense report not found' }
  }

  if (expense.status !== 'submitted') {
    return { error: 'Expense report not pending approval' }
  }

  const { error } = await supabase
    .from('expenses')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: profile.id,
    })
    .eq('id', expenseId)

  if (error) {
    console.error('Error approving expenses:', error)
    return { error: 'Failed to approve expenses' }
  }

  // Audit log
  await logAudit({
    action: 'approve',
    entityType: 'expense',
    entityId: expenseId,
    oldValues: { status: 'submitted' },
    newValues: { status: 'approved', approved_by: profile.id },
  })

  revalidatePath('/expenses')
  revalidatePath('/timesheets')
  return { success: true }
}

/**
 * Admin reject expenses only (granular rejection)
 */
export async function rejectExpensesOnly(expenseId: string, reason?: string) {
  const supabase = await createClient()
  const profile = await getProfile()

  if (!profile) {
    return { error: 'Not authenticated' }
  }

  const permissions = await getUserPermissions()
  if (!hasPermission(permissions, 'expenses.approve') && !hasPermission(permissions, 'admin.manage')) {
    return { error: 'Not authorized to reject expenses' }
  }

  // Get expense
  const { data: expense, error: expError } = await supabase
    .from('expenses')
    .select('id, status')
    .eq('id', expenseId)
    .single()

  if (expError || !expense) {
    return { error: 'Expense report not found' }
  }

  if (!['submitted', 'approved'].includes(expense.status ?? '')) {
    return { error: 'Cannot reject this expense report' }
  }

  const previousStatus = expense.status

  const { error } = await supabase
    .from('expenses')
    .update({
      status: 'draft',
      submitted_at: null,
      approved_at: null,
      approved_by: null,
      rejection_reason: reason || null,
    })
    .eq('id', expenseId)

  if (error) {
    console.error('Error rejecting expenses:', error)
    return { error: 'Failed to reject expenses' }
  }

  // Audit log
  await logAudit({
    action: 'reject',
    entityType: 'expense',
    entityId: expenseId,
    oldValues: { status: previousStatus },
    newValues: { status: 'draft', rejection_reason: reason || null },
  })

  revalidatePath('/expenses')
  revalidatePath('/timesheets')
  return { success: true }
}

/**
 * Approve both timesheet and expenses together
 */
export async function approveBoth(timesheetId: string, expenseId: string | null) {
  const results: {
    timesheetApproved: boolean
    expenseApproved: boolean
    timesheetError?: string
    expenseError?: string
  } = {
    timesheetApproved: false,
    expenseApproved: false,
  }

  // Approve timesheet
  const tsResult = await approveTimesheetOnly(timesheetId)
  if (tsResult.error) {
    results.timesheetError = tsResult.error
  } else {
    results.timesheetApproved = true
  }

  // Approve expenses if exists
  if (expenseId) {
    const expResult = await approveExpensesOnly(expenseId)
    if (expResult.error) {
      results.expenseError = expResult.error
    } else {
      results.expenseApproved = true
    }
  }

  if (results.timesheetApproved || results.expenseApproved) {
    return { success: true, ...results }
  }

  return { error: results.timesheetError || 'Nothing to approve', ...results }
}

/**
 * Reject both timesheet and expenses together
 */
export async function rejectBoth(timesheetId: string, expenseId: string | null, reason?: string) {
  const results: {
    timesheetRejected: boolean
    expenseRejected: boolean
    timesheetError?: string
    expenseError?: string
  } = {
    timesheetRejected: false,
    expenseRejected: false,
  }

  // Reject timesheet
  const tsResult = await rejectTimesheetOnly(timesheetId, reason)
  if (tsResult.error) {
    results.timesheetError = tsResult.error
  } else {
    results.timesheetRejected = true
  }

  // Reject expenses if exists
  if (expenseId) {
    const expResult = await rejectExpensesOnly(expenseId, reason)
    if (expResult.error) {
      results.expenseError = expResult.error
    } else {
      results.expenseRejected = true
    }
  }

  if (results.timesheetRejected || results.expenseRejected) {
    return { success: true, ...results }
  }

  return { error: results.timesheetError || 'Nothing to reject', ...results }
}

// === EMAIL REMINDERS (PHASE 4) ===

export type ReminderResult = {
  userId: string
  email: string
  name: string
  success: boolean
  error?: string
}

/**
 * Send email reminders to users who haven't submitted their timesheet for a week.
 * Requires admin.manage or timesheets.view_all permission.
 */
export async function sendTimesheetReminders(
  weekStart: string,
  userIds: string[]
): Promise<{ success: boolean; results: ReminderResult[]; error?: string }> {
  const supabase = await createClient()
  const permissions = await getUserPermissions()

  // Check permission
  if (!hasPermission(permissions, 'timesheets.view_all') && !hasPermission(permissions, 'admin.manage')) {
    return { success: false, results: [], error: 'Not authorized to send reminders' }
  }

  if (userIds.length === 0) {
    return { success: false, results: [], error: 'No users selected' }
  }

  // Normalize week start
  const monday = getMonday(new Date(weekStart))
  const weekStartISO = formatDateISO(monday)

  // Get user details
  const { data: users, error: usersError } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email')
    .in('id', userIds)
    .eq('is_active', true)

  if (usersError || !users || users.length === 0) {
    return { success: false, results: [], error: 'Failed to fetch user details' }
  }

  // Calculate due date (typically Friday of the week)
  const dueDate = new Date(monday)
  dueDate.setDate(dueDate.getDate() + 4) // Friday
  const dueDateStr = dueDate.toLocaleDateString('fr-CA', { dateStyle: 'long' })

  // Format week range for display
  const weekRange = formatWeekRangeLocale(monday, 'fr')

  const results: ReminderResult[] = []

  // Send reminders
  for (const user of users) {
    if (!user.email) {
      results.push({
        userId: user.id,
        email: '',
        name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
        success: false,
        error: 'No email address',
      })
      continue
    }

    const result = await sendTimesheetReminder({
      to: user.email,
      employeeName: `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Équipier',
      weekRange,
      dueDate: dueDateStr,
    })

    results.push({
      userId: user.id,
      email: user.email,
      name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
      success: result.success,
      error: result.error,
    })

    // Audit log for each reminder sent
    if (result.success) {
      await logAudit({
        action: 'send',
        entityType: 'timesheet',
        entityId: null,
        newValues: {
          reminder_type: 'missing_timesheet',
          user_id: user.id,
          week_start: weekStartISO,
          email: user.email,
        },
      })
    }
  }

  const successCount = results.filter((r) => r.success).length
  return {
    success: successCount > 0,
    results,
  }
}
