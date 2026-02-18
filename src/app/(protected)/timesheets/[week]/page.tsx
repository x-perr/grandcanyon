import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { getOrCreateTimesheet, getTimesheetById, getUserProjects } from '../actions'
import { WeekPicker } from '@/components/timesheets/week-picker'
import { TimesheetGrid } from '@/components/timesheets/timesheet-grid'
import { TimesheetActions } from '@/components/timesheets/timesheet-actions'
import { parseDateISO, formatWeekRange, getMonday, formatDateISO } from '@/lib/date'
import { getProfile } from '@/lib/auth'

interface TimesheetEntryPageProps {
  params: Promise<{ week: string }>
  searchParams: Promise<{ user?: string }>
}

export default async function TimesheetEntryPage({ params, searchParams }: TimesheetEntryPageProps) {
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
    redirect(`/timesheets/${weekStart}`)
  }

  // Get or create the timesheet
  const result = await getOrCreateTimesheet(weekStart, impersonateUserId)

  if (result.error || !result.timesheet) {
    // If impersonation failed, show error
    if (impersonateUserId) {
      return (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/timesheets">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Link>
            </Button>
          </div>
          <div className="rounded-md border border-destructive bg-destructive/10 p-4">
            <p className="text-destructive">{result.error || 'Failed to load timesheet'}</p>
          </div>
        </div>
      )
    }
    notFound()
  }

  const timesheet = result.timesheet

  // Fetch timesheet with entries and user's projects in parallel
  const [fullTimesheet, projects, profile] = await Promise.all([
    getTimesheetById(timesheet.id),
    getUserProjects(impersonateUserId),
    getProfile(),
  ])

  if (!fullTimesheet) {
    notFound()
  }

  const isEditable = fullTimesheet.status === 'draft'
  const isImpersonating = impersonateUserId && impersonateUserId !== profile?.id
  const weekRange = formatWeekRange(monday)

  // Get user info for display
  const timesheetUser = Array.isArray(fullTimesheet.user) ? fullTimesheet.user[0] : fullTimesheet.user
  const userName = timesheetUser
    ? `${timesheetUser.first_name} ${timesheetUser.last_name}`
    : 'Unknown'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/timesheets">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Week of {weekRange}
            </h1>
            {isImpersonating && (
              <p className="text-sm text-orange-600">
                Entering time for: {userName}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {fullTimesheet.status && <StatusBadge status={fullTimesheet.status} />}
        </div>
      </div>

      {/* Impersonation Banner */}
      {isImpersonating && (
        <div className="rounded-md border border-orange-200 bg-orange-50 p-3">
          <p className="text-sm text-orange-800">
            You are entering time on behalf of <strong>{userName}</strong>.
            All entries will be attributed to their timesheet.
          </p>
        </div>
      )}

      {/* Rejection Reason */}
      {fullTimesheet.rejection_reason && (
        <div className="rounded-md border border-destructive bg-destructive/10 p-4">
          <p className="text-sm font-medium text-destructive">Rejection Reason:</p>
          <p className="text-sm text-destructive">{fullTimesheet.rejection_reason}</p>
        </div>
      )}

      {/* Week Navigation */}
      <WeekPicker weekStart={weekStart} />

      {/* Actions Bar */}
      <TimesheetActions
        timesheet={fullTimesheet}
        isEditable={isEditable}
        hasEntries={(fullTimesheet.entries?.length ?? 0) > 0}
      />

      {/* Timesheet Grid */}
      <TimesheetGrid
        timesheet={fullTimesheet}
        entries={fullTimesheet.entries ?? []}
        projects={projects}
        isEditable={isEditable}
      />
    </div>
  )
}
