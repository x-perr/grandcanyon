import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { getOrCreateExpense, getExpenseById, getUserProjectsForExpenses, getExpenseTypes } from '../actions'
import { WeekPicker } from '@/components/timesheets/week-picker'
import { ExpenseGrid } from '@/components/expenses/expense-grid'
import { ExpenseActions } from '@/components/expenses/expense-actions'
import { parseDateISO, formatWeekRange, getMonday, formatDateISO } from '@/lib/date'
import { getProfile } from '@/lib/auth'
import { getTranslations } from 'next-intl/server'

interface ExpenseEntryPageProps {
  params: Promise<{ week: string }>
  searchParams: Promise<{ user?: string }>
}

export default async function ExpenseEntryPage({ params, searchParams }: ExpenseEntryPageProps) {
  const { week } = await params
  const { user: impersonateUserId } = await searchParams

  // Validate week format (YYYY-MM-DD)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) {
    notFound()
  }

  // Ensure the date is a Monday
  const inputDate = parseDateISO(week)
  const monday = getMonday(inputDate)
  const weekStart = formatDateISO(monday)

  // Redirect if not a Monday
  if (week !== weekStart) {
    redirect(`/expenses/${weekStart}`)
  }

  // Get translations
  const t = await getTranslations('expenses')

  // Get or create the expense report
  const result = await getOrCreateExpense(weekStart, impersonateUserId)

  if (result.error || !result.expense) {
    // If impersonation failed, show error
    if (impersonateUserId) {
      return (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/expenses">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t('back')}
              </Link>
            </Button>
          </div>
          <div className="rounded-md border border-destructive bg-destructive/10 p-4">
            <p className="text-destructive">{result.error || t('detail.failed_load')}</p>
          </div>
        </div>
      )
    }
    notFound()
  }

  const expense = result.expense

  // Fetch expense with entries, projects, and expense types in parallel
  const [fullExpense, projects, expenseTypes, profile] = await Promise.all([
    getExpenseById(expense.id),
    getUserProjectsForExpenses(impersonateUserId),
    getExpenseTypes(),
    getProfile(),
  ])

  if (!fullExpense) {
    notFound()
  }

  const isEditable = fullExpense.status === 'draft'
  const isImpersonating = impersonateUserId && impersonateUserId !== profile?.id
  const weekRange = formatWeekRange(monday)

  // Get user info for display
  const expenseUser = Array.isArray(fullExpense.user) ? fullExpense.user[0] : fullExpense.user
  const userName = expenseUser
    ? `${expenseUser.first_name} ${expenseUser.last_name}`
    : 'Unknown'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/expenses">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('back')}
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {t('detail.title', { weekRange })}
            </h1>
            {isImpersonating && (
              <p className="text-sm text-orange-600">
                {t('detail.entering_for', { name: userName })}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {fullExpense.status && <StatusBadge status={fullExpense.status} />}
        </div>
      </div>

      {/* Impersonation Banner */}
      {isImpersonating && (
        <div className="rounded-md border border-orange-200 bg-orange-50 p-3">
          <p className="text-sm text-orange-800">
            {t('detail.impersonation_banner', { name: userName })}
          </p>
        </div>
      )}

      {/* Rejection Reason */}
      {fullExpense.rejection_reason && (
        <div className="rounded-md border border-destructive bg-destructive/10 p-4">
          <p className="text-sm font-medium text-destructive">{t('detail.rejection_reason')}</p>
          <p className="text-sm text-destructive">{fullExpense.rejection_reason}</p>
        </div>
      )}

      {/* Week Navigation */}
      <WeekPicker weekStart={weekStart} basePath="/expenses" />

      {/* Actions Bar */}
      <ExpenseActions
        expense={fullExpense}
        isEditable={isEditable}
        hasEntries={(fullExpense.entries?.length ?? 0) > 0}
      />

      {/* Expense Grid */}
      <ExpenseGrid
        expense={fullExpense}
        entries={fullExpense.entries ?? []}
        projects={projects}
        expenseTypes={expenseTypes}
        weekStart={weekStart}
        isEditable={isEditable}
      />
    </div>
  )
}
