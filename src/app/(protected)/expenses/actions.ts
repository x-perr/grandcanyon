'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getUserPermissions, hasPermission, getProfile } from '@/lib/auth'
import { formatDateISO, getMonday, getSunday, getPreviousWeekStart } from '@/lib/date'
import { expenseEntrySchema, calculateExpenseTotals } from '@/lib/validations/expense'
import type { Enums, Tables } from '@/types/database'

type ExpenseStatus = Enums<'expense_status'>

// === TYPE DEFINITIONS ===

export type ExpenseWithUser = Tables<'expenses'> & {
  user: {
    id: string
    first_name: string
    last_name: string
    email: string
  } | null
  total_amount?: number
  entry_count?: number
}

export type ExpenseEntryWithRelations = Tables<'expense_entries'> & {
  expense_type: {
    id: string
    code: string
    name: string
    default_rate: number | null
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
}

export type ExpenseType = {
  id: string
  code: string
  name: string
  default_rate: number | null
  is_active: boolean
}

export type ProjectForExpense = {
  id: string
  code: string
  name: string
  tasks: { id: string; code: string; name: string }[]
}

// === QUERY FUNCTIONS ===

/**
 * Get list of expenses for a user (paginated)
 */
export async function getExpenses(options?: {
  userId?: string
  status?: ExpenseStatus
  limit?: number
  offset?: number
}): Promise<{ expenses: ExpenseWithUser[]; count: number }> {
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
    return { expenses: [], count: 0 }
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

// === MUTATION FUNCTIONS ===

/**
 * Save an expense entry (create or update)
 */
export async function saveExpenseEntry(
  expenseId: string,
  entry: {
    id?: string
    expense_type_id: string
    project_id: string
    task_id?: string | null
    expense_date: string
    description: string
    receipt_number?: string | null
    quantity: number
    unit_price: number
    is_billable?: boolean
  }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Verify expense exists and is editable
  const { data: expense, error: expError } = await supabase
    .from('expenses')
    .select('id, status, user_id')
    .eq('id', expenseId)
    .single()

  if (expError || !expense) {
    return { error: 'Expense report not found' }
  }

  if (expense.status !== 'draft') {
    return { error: 'Expense report is not editable' }
  }

  // Verify ownership or impersonation permission
  if (expense.user_id !== user?.id) {
    const permissions = await getUserPermissions()
    if (!hasPermission(permissions, 'expenses.impersonate')) {
      return { error: 'Not authorized' }
    }
  }

  // Validate entry
  const validation = expenseEntrySchema.safeParse(entry)
  if (!validation.success) {
    return { error: validation.error.issues[0]?.message ?? 'Validation failed' }
  }

  // Calculate totals
  const totals = calculateExpenseTotals(entry.quantity, entry.unit_price)

  const entryData = {
    expense_id: expenseId,
    expense_type_id: entry.expense_type_id,
    project_id: entry.project_id,
    task_id: entry.task_id || null,
    expense_date: entry.expense_date,
    description: entry.description,
    receipt_number: entry.receipt_number || null,
    quantity: entry.quantity,
    unit_price: entry.unit_price,
    subtotal: totals.subtotal,
    gst_amount: totals.gst_amount,
    qst_amount: totals.qst_amount,
    total: totals.total,
    is_billable: entry.is_billable ?? false,
  }

  if (entry.id) {
    // Update existing
    const { data, error } = await supabase
      .from('expense_entries')
      .update(entryData)
      .eq('id', entry.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating expense entry:', error)
      return { error: 'Failed to update entry' }
    }

    revalidatePath('/expenses')
    return { entry: data }
  } else {
    // Create new
    const { data, error } = await supabase.from('expense_entries').insert(entryData).select().single()

    if (error) {
      console.error('Error creating expense entry:', error)
      return { error: 'Failed to create entry' }
    }

    revalidatePath('/expenses')
    return { entry: data }
  }
}

/**
 * Delete an expense entry
 */
export async function deleteExpenseEntry(entryId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Get entry with expense info
  const { data: entry, error: entryError } = await supabase
    .from('expense_entries')
    .select('id, expense:expenses!expense_entries_expense_id_fkey(id, status, user_id)')
    .eq('id', entryId)
    .single()

  if (entryError || !entry) {
    return { error: 'Entry not found' }
  }

  const expense = Array.isArray(entry.expense) ? entry.expense[0] : entry.expense

  if (!expense || expense.status !== 'draft') {
    return { error: 'Cannot delete from non-draft expense report' }
  }

  // Verify ownership or impersonation permission
  if (expense.user_id !== user?.id) {
    const permissions = await getUserPermissions()
    if (!hasPermission(permissions, 'expenses.impersonate')) {
      return { error: 'Not authorized' }
    }
  }

  const { error } = await supabase.from('expense_entries').delete().eq('id', entryId)

  if (error) {
    console.error('Error deleting expense entry:', error)
    return { error: 'Failed to delete entry' }
  }

  revalidatePath('/expenses')
  return { success: true }
}

/**
 * Submit an expense report for approval
 */
export async function submitExpense(expenseId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Get expense
  const { data: expense, error: expError } = await supabase
    .from('expenses')
    .select('id, status, user_id')
    .eq('id', expenseId)
    .single()

  if (expError || !expense) {
    return { error: 'Expense report not found' }
  }

  // Verify ownership
  if (expense.user_id !== user?.id) {
    return { error: 'Can only submit your own expense report' }
  }

  // Verify status
  if (expense.status !== 'draft') {
    return { error: 'Expense report already submitted' }
  }

  // Verify has entries
  const { count } = await supabase
    .from('expense_entries')
    .select('*', { count: 'exact', head: true })
    .eq('expense_id', expenseId)

  if (!count || count === 0) {
    return { error: 'Cannot submit empty expense report' }
  }

  // Update status
  const { error } = await supabase
    .from('expenses')
    .update({
      status: 'submitted',
      submitted_at: new Date().toISOString(),
    })
    .eq('id', expenseId)

  if (error) {
    console.error('Error submitting expense:', error)
    return { error: 'Failed to submit expense report' }
  }

  revalidatePath('/expenses')
  return { success: true }
}

/**
 * Approve an expense report (manager only)
 */
export async function approveExpense(expenseId: string) {
  const supabase = await createClient()
  const profile = await getProfile()

  if (!profile) {
    return { error: 'Not authenticated' }
  }

  // Get expense with owner's manager
  const { data: expense, error: expError } = await supabase
    .from('expenses')
    .select(
      `
      id,
      status,
      user_id,
      owner:profiles!expenses_user_id_fkey(manager_id)
    `
    )
    .eq('id', expenseId)
    .single()

  if (expError || !expense) {
    return { error: 'Expense report not found' }
  }

  const owner = Array.isArray(expense.owner) ? expense.owner[0] : expense.owner

  // Verify user is owner's manager
  if (owner?.manager_id !== profile.id) {
    return { error: 'Only direct manager can approve' }
  }

  // Verify status
  if (expense.status !== 'submitted') {
    return { error: 'Expense report not pending approval' }
  }

  // Approve
  const { error } = await supabase
    .from('expenses')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: profile.id,
    })
    .eq('id', expenseId)

  if (error) {
    console.error('Error approving expense:', error)
    return { error: 'Failed to approve expense report' }
  }

  revalidatePath('/expenses')
  return { success: true }
}

/**
 * Reject an expense report (manager only)
 */
export async function rejectExpense(expenseId: string, reason?: string) {
  const supabase = await createClient()
  const profile = await getProfile()

  if (!profile) {
    return { error: 'Not authenticated' }
  }

  // Get expense with owner's manager
  const { data: expense, error: expError } = await supabase
    .from('expenses')
    .select(
      `
      id,
      status,
      user_id,
      owner:profiles!expenses_user_id_fkey(manager_id)
    `
    )
    .eq('id', expenseId)
    .single()

  if (expError || !expense) {
    return { error: 'Expense report not found' }
  }

  const owner = Array.isArray(expense.owner) ? expense.owner[0] : expense.owner

  // Verify user is owner's manager
  if (owner?.manager_id !== profile.id) {
    return { error: 'Only direct manager can reject' }
  }

  // Verify status (can reject submitted or approved)
  if (!['submitted', 'approved'].includes(expense.status ?? '')) {
    return { error: 'Cannot reject this expense report' }
  }

  // Reset to draft
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
    console.error('Error rejecting expense:', error)
    return { error: 'Failed to reject expense report' }
  }

  revalidatePath('/expenses')
  return { success: true }
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

/**
 * Copy entries from previous week
 */
export async function copyPreviousWeek(expenseId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Get current expense
  const { data: current, error: expError } = await supabase
    .from('expenses')
    .select('id, user_id, week_start, status')
    .eq('id', expenseId)
    .single()

  if (expError || !current) {
    return { error: 'Expense report not found' }
  }

  if (current.status !== 'draft') {
    return { error: 'Can only copy to draft expense reports' }
  }

  // Verify ownership or impersonation
  if (current.user_id !== user?.id) {
    const permissions = await getUserPermissions()
    if (!hasPermission(permissions, 'expenses.impersonate')) {
      return { error: 'Not authorized' }
    }
  }

  // Get previous week's expense
  const prevWeekStart = getPreviousWeekStart(new Date(current.week_start))
  const prevWeekISO = formatDateISO(prevWeekStart)

  const { data: previous } = await supabase
    .from('expenses')
    .select(
      `
      id,
      entries:expense_entries(
        expense_type_id,
        project_id,
        task_id,
        description,
        quantity,
        unit_price,
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

  // Delete existing entries in current expense
  await supabase.from('expense_entries').delete().eq('expense_id', expenseId)

  // Copy entries (with recalculated totals, date set to first day of current week)
  const newEntries = previous.entries.map((entry) => {
    const totals = calculateExpenseTotals(entry.quantity ?? 1, entry.unit_price ?? 0)
    return {
      expense_id: expenseId,
      expense_type_id: entry.expense_type_id,
      project_id: entry.project_id,
      task_id: entry.task_id,
      expense_date: current.week_start, // Use first day of current week
      description: entry.description,
      quantity: entry.quantity,
      unit_price: entry.unit_price,
      subtotal: totals.subtotal,
      gst_amount: totals.gst_amount,
      qst_amount: totals.qst_amount,
      total: totals.total,
      is_billable: entry.is_billable,
    }
  })

  const { error } = await supabase.from('expense_entries').insert(newEntries)

  if (error) {
    console.error('Error copying expense entries:', error)
    return { error: 'Failed to copy entries' }
  }

  revalidatePath('/expenses')
  return { success: true, entriesCopied: newEntries.length }
}
