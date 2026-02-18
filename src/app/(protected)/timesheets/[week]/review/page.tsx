import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getOrCreateTimesheet, getTimesheetById, type TimesheetEntryWithRelations } from '../../actions'
import { parseDateISO, formatWeekRange, getMonday, formatDateISO, getWeekDayLabels, sumHours } from '@/lib/date'
import { getProfile, getUserPermissions, hasPermission } from '@/lib/auth'
import { ReviewActions } from '@/components/timesheets/review-actions'

interface ReviewPageProps {
  params: Promise<{ week: string }>
  searchParams: Promise<{ user?: string }>
}

export default async function ReviewPage({ params, searchParams }: ReviewPageProps) {
  const { week } = await params
  const { user: userId } = await searchParams

  if (!userId) {
    redirect('/timesheets?tab=approvals')
  }

  // Validate week format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) {
    notFound()
  }

  // Ensure the date is a Monday
  const inputDate = parseDateISO(week)
  const monday = getMonday(inputDate)
  const weekStart = formatDateISO(monday)

  if (week !== weekStart) {
    redirect(`/timesheets/${weekStart}/review?user=${userId}`)
  }

  // Check permissions
  const [permissions, profile] = await Promise.all([
    getUserPermissions(),
    getProfile(),
  ])

  if (!hasPermission(permissions, 'timesheets.approve')) {
    redirect('/timesheets')
  }

  // Get the timesheet
  const result = await getOrCreateTimesheet(weekStart, userId)

  if (result.error || !result.timesheet) {
    notFound()
  }

  const fullTimesheet = await getTimesheetById(result.timesheet.id)

  if (!fullTimesheet) {
    notFound()
  }

  // Verify the current user is the manager
  const timesheetUser = Array.isArray(fullTimesheet.user) ? fullTimesheet.user[0] : fullTimesheet.user
  if (timesheetUser?.manager_id !== profile?.id) {
    redirect('/timesheets?tab=approvals')
  }

  const weekRange = formatWeekRange(monday)
  const dayLabels = getWeekDayLabels()
  const entries = fullTimesheet.entries ?? []

  // Calculate totals
  const dayTotals = Array.from({ length: 7 }, (_, dayIndex: number) => {
    return entries.reduce((sum: number, entry: TimesheetEntryWithRelations) => sum + (entry.hours?.[dayIndex] ?? 0), 0)
  })
  const weekTotal = dayTotals.reduce((sum: number, d: number) => sum + d, 0)

  const userName = timesheetUser
    ? `${timesheetUser.first_name} ${timesheetUser.last_name}`
    : 'Unknown'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/timesheets?tab=approvals">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Approvals
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Review Timesheet</h1>
            <p className="text-muted-foreground">{userName} - Week of {weekRange}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {fullTimesheet.status && <StatusBadge status={fullTimesheet.status} />}
        </div>
      </div>

      {/* Read-only Grid */}
      <Card>
        <CardHeader>
          <CardTitle>Time Entries</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Column Headers */}
          <div className="flex items-center gap-2 border-b pb-2">
            <div className="w-[250px] flex-shrink-0">
              <span className="text-sm font-medium">Project / Task</span>
            </div>
            <div className="flex flex-1 items-center gap-1">
              {dayLabels.map((label, index) => (
                <div key={index} className="w-[60px] text-center">
                  <span className="text-sm font-medium">{label}</span>
                </div>
              ))}
            </div>
            <div className="w-[70px] flex-shrink-0 text-center">
              <span className="text-sm font-medium">Total</span>
            </div>
          </div>

          {/* Entry Rows */}
          {entries.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No entries in this timesheet
            </div>
          ) : (
            entries.map((entry: TimesheetEntryWithRelations) => {
              const project = Array.isArray(entry.project) ? entry.project[0] : entry.project
              const task = Array.isArray(entry.task) ? entry.task[0] : entry.task
              const billingRole = Array.isArray(entry.billing_role) ? entry.billing_role[0] : entry.billing_role
              const rowTotal = sumHours(entry.hours ?? [])

              return (
                <div key={entry.id} className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3">
                  <div className="w-[250px] flex-shrink-0">
                    <div className="font-medium">
                      <span className="font-mono text-xs">{project?.code}</span>
                      <span className="ml-1">{project?.name}</span>
                    </div>
                    {task && (
                      <div className="text-sm text-muted-foreground">
                        <span className="font-mono text-xs">{task.code}</span>
                        <span className="ml-1">{task.name}</span>
                      </div>
                    )}
                    {billingRole && (
                      <div className="text-xs text-muted-foreground">
                        {billingRole.name} @ ${billingRole.rate}/hr
                      </div>
                    )}
                    {entry.description && (
                      <div className="mt-1 text-xs text-muted-foreground italic">
                        {entry.description}
                      </div>
                    )}
                    {!entry.is_billable && (
                      <span className="mt-1 inline-block rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                        Non-billable
                      </span>
                    )}
                  </div>
                  <div className="flex flex-1 items-center gap-1">
                    {(entry.hours ?? [0, 0, 0, 0, 0, 0, 0]).map((h: number, index: number) => (
                      <div key={index} className="w-[60px] text-center">
                        <span className={`font-mono text-sm ${h > 0 ? 'font-medium' : 'text-muted-foreground'}`}>
                          {h > 0 ? h.toFixed(1) : '-'}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="w-[70px] flex-shrink-0 text-center">
                    <span className="font-mono font-medium">{rowTotal.toFixed(1)}</span>
                  </div>
                </div>
              )
            })
          )}

          {/* Day Totals */}
          {entries.length > 0 && (
            <div className="flex items-center gap-2 border-t pt-3">
              <div className="w-[250px] flex-shrink-0">
                <span className="font-semibold">Day Totals</span>
              </div>
              <div className="flex flex-1 items-center gap-1">
                {dayTotals.map((total, index) => (
                  <div key={index} className="w-[60px] text-center">
                    <span className={`font-mono text-sm font-medium ${total > 12 ? 'text-orange-600' : ''}`}>
                      {total > 0 ? total.toFixed(1) : '-'}
                    </span>
                  </div>
                ))}
              </div>
              <div className="w-[70px] flex-shrink-0 text-center">
                <span className="font-mono text-lg font-bold">{weekTotal.toFixed(1)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{weekTotal.toFixed(1)}</div>
            <p className="text-sm text-muted-foreground">Total Hours</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{entries.length}</div>
            <p className="text-sm text-muted-foreground">Entries</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {entries.filter((e: TimesheetEntryWithRelations) => e.is_billable !== false).length}
            </div>
            <p className="text-sm text-muted-foreground">Billable Entries</p>
          </CardContent>
        </Card>
      </div>

      {/* Approval Actions */}
      {fullTimesheet.status === 'submitted' && (
        <ReviewActions
          timesheetId={fullTimesheet.id}
          employeeName={userName}
        />
      )}
    </div>
  )
}
