'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getUserPermissions, hasPermission, getProfile } from '@/lib/auth'
import { formatDateISO, getMonday, getPreviousWeekStart } from '@/lib/date'
import { expenseEntrySchema, calculateExpenseTotals } from '@/lib/validations/expense'

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
