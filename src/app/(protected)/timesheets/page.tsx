import { getTranslations } from 'next-intl/server'
import { getUserPermissions, hasPermission } from '@/lib/auth'
import { getTimesheets, getPendingApprovals } from './actions'
import { TimesheetList } from '@/components/timesheets/timesheet-list'
import { ApprovalQueue } from '@/components/timesheets/approval-queue'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatDateISO, getCurrentWeekStart } from '@/lib/date'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Plus, Users } from 'lucide-react'

interface TimesheetsPageProps {
  searchParams: Promise<{
    tab?: string
    page?: string
  }>
}

export default async function TimesheetsPage({ searchParams }: TimesheetsPageProps) {
  const params = await searchParams
  const tab = params.tab || 'my'
  const page = Number(params.page) || 1
  const pageSize = 25

  const [{ timesheets, count }, approvals, permissions, t] = await Promise.all([
    getTimesheets({
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }),
    getPendingApprovals(),
    getUserPermissions(),
    getTranslations('timesheets'),
  ])

  const canApprove = hasPermission(permissions, 'timesheets.approve')
  const canViewAll = hasPermission(permissions, 'timesheets.view_all') || hasPermission(permissions, 'admin.manage')
  const currentWeekStart = formatDateISO(getCurrentWeekStart())

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex gap-2">
          {canViewAll && (
            <Button variant="outline" asChild>
              <Link href={`/timesheets/team/${currentWeekStart}`}>
                <Users className="mr-2 h-4 w-4" />
                {t('team.title')}
              </Link>
            </Button>
          )}
          <Button asChild>
            <Link href={`/timesheets/${currentWeekStart}`}>
              <Plus className="mr-2 h-4 w-4" />
              {t('current_week')}
            </Link>
          </Button>
        </div>
      </div>

      <Tabs defaultValue={tab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="my">{t('my_timesheets')}</TabsTrigger>
          {canApprove && (
            <TabsTrigger value="approvals">
              {t('team_approvals')}
              {approvals.count > 0 && (
                <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                  {approvals.count}
                </span>
              )}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="my" className="space-y-4">
          <TimesheetList
            timesheets={timesheets}
            totalCount={count}
            currentPage={page}
            pageSize={pageSize}
          />
        </TabsContent>

        {canApprove && (
          <TabsContent value="approvals" className="space-y-4">
            <ApprovalQueue timesheets={approvals.timesheets} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
