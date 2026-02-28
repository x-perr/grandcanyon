import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { Users } from 'lucide-react'
import { getUserPermissions, hasPermission } from '@/lib/auth'
import { getTeamTimesheetsByWeek } from '../actions'
import { formatDateISO, getMonday, getCurrentWeekStart } from '@/lib/date'
import { TeamTimesheetTable } from '@/components/timesheets/team-timesheet-table'

interface TeamTimesheetsPageProps {
  searchParams: Promise<{
    week?: string
  }>
}

export default async function TeamTimesheetsPage({ searchParams }: TeamTimesheetsPageProps) {
  const params = await searchParams
  const permissions = await getUserPermissions()

  // Check permission
  if (!hasPermission(permissions, 'timesheets.view_all') && !hasPermission(permissions, 'admin.manage')) {
    redirect('/timesheets')
  }

  // Determine week to show (default to current week)
  const weekParam = params.week
  const weekStart = weekParam
    ? formatDateISO(getMonday(new Date(weekParam)))
    : formatDateISO(getCurrentWeekStart())

  const { rows, summary } = await getTeamTimesheetsByWeek(weekStart)
  const t = await getTranslations('timesheets')

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Users className="h-6 w-6 text-muted-foreground" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('team.title')}</h1>
          <p className="text-muted-foreground">{t('team.subtitle')}</p>
        </div>
      </div>

      <TeamTimesheetTable
        rows={rows}
        summary={summary}
        weekStart={weekStart}
        canApprove={hasPermission(permissions, 'timesheets.approve') || hasPermission(permissions, 'admin.manage')}
      />
    </div>
  )
}
