import { getTranslations } from 'next-intl/server'
import { getUserPermissions, hasPermission } from '@/lib/auth'
import { getTeamTimesheetsByWeek } from '../../actions'
import { formatDateISO, getCurrentWeekStart, getMonday } from '@/lib/date'
import { TeamTimesheetList } from '@/components/timesheets/team-timesheet-list'
import { WeekPicker } from '@/components/timesheets/week-picker'
import { Card, CardContent } from '@/components/ui/card'
import { redirect } from 'next/navigation'
import { Users, Clock, CheckCircle, AlertCircle, FileEdit } from 'lucide-react'

interface TeamTimesheetsPageProps {
  params: Promise<{
    week: string
  }>
}

export default async function TeamTimesheetsPage({ params }: TeamTimesheetsPageProps) {
  const { week } = await params
  const [permissions, t] = await Promise.all([
    getUserPermissions(),
    getTranslations('timesheets.team'),
  ])

  // Check permission
  if (!hasPermission(permissions, 'timesheets.view_all') && !hasPermission(permissions, 'admin.manage')) {
    redirect('/timesheets')
  }

  // Normalize week to Monday
  const monday = getMonday(new Date(week))
  const weekStartISO = formatDateISO(monday)

  // Get team data
  const { rows, summary } = await getTeamTimesheetsByWeek(weekStartISO)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
        <WeekPicker weekStart={weekStartISO} basePath="/timesheets/team" />
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('summary.total')}</p>
                <p className="text-2xl font-bold">{summary.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-300">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('summary.submitted')}</p>
                <p className="text-2xl font-bold">{summary.submitted}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300">
                <CheckCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('summary.approved')}</p>
                <p className="text-2xl font-bold">{summary.approved}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <FileEdit className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('summary.draft')}</p>
                <p className="text-2xl font-bold">{summary.draft}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-300">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('summary.total_hours')}</p>
                <p className="text-2xl font-bold">{summary.totalHours.toFixed(1)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Team List */}
      <TeamTimesheetList rows={rows} weekStart={weekStartISO} />
    </div>
  )
}
