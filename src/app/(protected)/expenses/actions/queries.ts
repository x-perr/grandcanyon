'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserPermissions, hasPermission, getProfile } from '@/lib/auth'
import { formatDateISO, getMonday, getSunday } from '@/lib/date'
import type { ExpenseWithUser, ExpenseType, ProjectForExpense } from './types'

/**
 * Get list of expenses for a user (paginated)
 */
export async function getExpenses(options?: {
  userId?: string
  status?: import('./types').ExpenseStatus
  limit?: number
  offset?: number
}): Promise<{ expenses: ExpenseWithUser[]; count: number; error?: string }> {
  const supabase = await createClient()
  const { userId, status, limit = 25, offset = 0 } = options ?? {}

  // Get current user if no userId specified
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const targetUserId = userId ?? user?.id

  if (!targetUserId) {
    return { expenses: [], count: 0 }
  }

  let query = supabase
    .from('expenses')
    .select(
      `
      *,
      user:profiles!expenses_user_id_fkey(id, first_name, last_name, email)
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
    console.error('Error fetching expenses:', error)
    return { expenses: [], count: 0, error: 'Failed to load expenses' }
  }

  // Calculate totals for each expense
  const expenseIds = (data ?? []).map((e) => e.id)

  if (expenseIds.length > 0) {
    const { data: entries } = await supabase
      .from('expense_entries')
      .select('expense_id, total')
      .in('expense_id', expenseIds)

    const totalsByExpense = new Map<string, { total: number; count: number }>()
    entries?.forEach((entry) => {
      const current = totalsByExpense.get(entry.expense_id) ?? { total: 0, count: 0 }
      totalsByExpense.set(entry.expense_id, {
        total: current.total + (entry.total ?? 0),
        count: current.count + 1,
      })
    })

    const expenses = (data ?? []).map((e) => {
      const stats = totalsByExpense.get(e.id) ?? { total: 0, count: 0 }
      return {
        ...e,
        user: Array.isArray(e.user) ? e.user[0] ?? null : e.user,
        total_amount: stats.total,
        entry_count: stats.count,
      }
    }) as ExpenseWithUser[]

    return { expenses, count: count ?? 0 }
  }

  const expenses = (data ?? []).map((e) => ({
    ...e,
    user: Array.isArray(e.user) ? e.user[0] ?? null : e.user,
    total_amount: 0,
    entry_count: 0,
  })) as ExpenseWithUser[]

  return { expenses, count: count ?? 0 }
}

/**
 * Get or create an expense report for a specific week
 */
export async function getOrCreateExpense(weekStart: string, userId?: string) {
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
    if (!hasPermission(permissions, 'expenses.impersonate')) {
      return { error: 'Not authorized to enter expenses for others' }
    }
  }

  // Ensure weekStart is a Monday
  const monday = getMonday(new Date(weekStart))
  const weekStartISO = formatDateISO(monday)
  const weekEndISO = formatDateISO(getSunday(monday))

  // Try to get existing expense
  const { data: existing } = await supabase
    .from('expenses')
    .select('*')
    .eq('user_id', targetUserId)
    .eq('week_start', weekStartISO)
    .single()

  if (existing) {
    return { expense: existing }
  }

  // Create new expense report
  const { data: expense, error } = await supabase
    .from('expenses')
    .insert({
      user_id: targetUserId,
      week_start: weekStartISO,
      week_end: weekEndISO,
      status: 'draft',
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating expense:', error)
    return { error: 'Failed to create expense report' }
  }

  return { expense }
}

/**
 * Get an expense by ID with all entries
 */
export async function getExpenseById(expenseId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('expenses')
    .select(
      `
      *,
      user:profiles!expenses_user_id_fkey(id, first_name, last_name, email, manager_id),
      entries:expense_entries(
        *,
        expense_type:expense_types!expense_entries_expense_type_id_fkey(id, code, name, default_rate),
        project:projects!expense_entries_project_id_fkey(id, code, name),
        task:project_tasks!expense_entries_task_id_fkey(id, code, name)
      )
    `
    )
    .eq('id', expenseId)
    .single()

  if (error) {
    console.error('Error fetching expense:', error)
    return null
  }

  return data
}

/**
 * Get pending expense approvals for a manager
 */
export async function getPendingExpenseApprovals(): Promise<{ expenses: ExpenseWithUser[]; count: number }> {
  const supabase = await createClient()
  const profile = await getProfile()

  if (!profile) {
    return { expenses: [], count: 0 }
  }

  // Get expenses submitted by direct reports
  const { data, error } = await supabase
    .from('expenses')
    .select(
      `
      *,
      user:profiles!expenses_user_id_fkey(id, first_name, last_name, email, manager_id)
    `,
      { count: 'exact' }
    )
    .eq('status', 'submitted')

  if (error) {
    console.error('Error fetching pending expense approvals:', error)
    return { expenses: [], count: 0 }
  }

  // Filter to only direct reports (where manager_id matches current user)
  const directReportExpenses = (data ?? []).filter((e) => {
    const user = Array.isArray(e.user) ? e.user[0] : e.user
    return user?.manager_id === profile.id
  })

  // Calculate totals
  const expenseIds = directReportExpenses.map((e) => e.id)

  if (expenseIds.length > 0) {
    const { data: entries } = await supabase
      .from('expense_entries')
      .select('expense_id, total')
      .in('expense_id', expenseIds)

    const totalsByExpense = new Map<string, { total: number; count: number }>()
    entries?.forEach((entry) => {
      const current = totalsByExpense.get(entry.expense_id) ?? { total: 0, count: 0 }
      totalsByExpense.set(entry.expense_id, {
        total: current.total + (entry.total ?? 0),
        count: current.count + 1,
      })
    })

    const expenses = directReportExpenses.map((e) => {
      const stats = totalsByExpense.get(e.id) ?? { total: 0, count: 0 }
      return {
        ...e,
        user: Array.isArray(e.user) ? e.user[0] ?? null : e.user,
        total_amount: stats.total,
        entry_count: stats.count,
      }
    }) as ExpenseWithUser[]

    return { expenses, count: expenses.length }
  }

  const expenses = directReportExpenses.map((e) => ({
    ...e,
    user: Array.isArray(e.user) ? e.user[0] ?? null : e.user,
    total_amount: 0,
    entry_count: 0,
  })) as ExpenseWithUser[]

  return { expenses, count: expenses.length }
}

/**
 * Get all active expense types
 */
export async function getExpenseTypes(): Promise<ExpenseType[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('expense_types')
    .select('id, code, name, default_rate, is_active')
    .eq('is_active', true)
    .order('name')

  if (error) {
    console.error('Error fetching expense types:', error)
    return []
  }

  return data ?? []
}

/**
 * Get projects the user can log expenses to
 */
export async function getUserProjectsForExpenses(userId?: string): Promise<ProjectForExpense[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const targetUserId = userId ?? user?.id

  if (!targetUserId) {
    return []
  }

  // Get projects where user is a team member or project manager
  const { data: projects, error } = await supabase
    .from('projects')
    .select(
      `
      id,
      code,
      name,
      tasks:project_tasks(id, code, name)
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
        tasks:project_tasks(id, code, name)
      )
    `
    )
    .eq('user_id', targetUserId)
    .eq('is_active', true)

  // Combine and deduplicate
  const projectMap = new Map<string, ProjectForExpense>()

  projects?.forEach((p) => {
    projectMap.set(p.id, {
      id: p.id,
      code: p.code,
      name: p.name,
      tasks: p.tasks ?? [],
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
      })
    }
  })

  return Array.from(projectMap.values()).sort((a, b) => a.code.localeCompare(b.code))
}

/**
 * Get expenses for a specific user and week (for team view)
 * Returns expense entries with totals
 */
export async function getExpensesByUserAndWeek(userId: string, weekStart: string) {
  const supabase = await createClient()
  const permissions = await getUserPermissions()

  // Check permission to view others' expenses
  const { data: { user } } = await supabase.auth.getUser()
  if (userId !== user?.id) {
    if (!hasPermission(permissions, 'expenses.view_all') && !hasPermission(permissions, 'admin.manage')) {
      return null
    }
  }

  // Normalize to Monday
  const monday = getMonday(new Date(weekStart))
  const weekStartISO = formatDateISO(monday)

  // Get expense report for this user/week
  const { data: expense, error } = await supabase
    .from('expenses')
    .select(
      `
      id,
      status,
      week_start,
      week_end,
      submitted_at,
      approved_at,
      rejection_reason,
      entries:expense_entries(
        id,
        expense_date,
        description,
        quantity,
        unit_price,
        subtotal,
        gst_amount,
        qst_amount,
        total,
        receipt_number,
        is_billable,
        expense_type:expense_types!expense_entries_expense_type_id_fkey(id, code, name),
        project:projects!expense_entries_project_id_fkey(id, code, name)
      )
    `
    )
    .eq('user_id', userId)
    .eq('week_start', weekStartISO)
    .single()

  if (error || !expense) {
    return null
  }

  // Calculate totals
  const totals = {
    subtotal: 0,
    gst: 0,
    qst: 0,
    total: 0,
  }

  expense.entries?.forEach((entry) => {
    totals.subtotal += entry.subtotal ?? 0
    totals.gst += entry.gst_amount ?? 0
    totals.qst += entry.qst_amount ?? 0
    totals.total += entry.total ?? 0
  })

  return {
    ...expense,
    totals,
  }
}
