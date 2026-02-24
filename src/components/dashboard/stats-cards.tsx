'use client'

import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Clock, FileText, DollarSign } from 'lucide-react'
import { formatCurrency } from '@/lib/tax'
import type { DashboardStats } from '@/app/(protected)/dashboard/actions'

interface StatsCardsProps {
  stats: DashboardStats
}

export function StatsCards({ stats }: StatsCardsProps) {
  const t = useTranslations('dashboard.cards')

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t('open_timesheets')}</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.openTimesheets}</div>
          <p className="text-xs text-muted-foreground">
            {t('awaiting_submission')}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t('hours_this_week')}</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.hoursThisWeek.toFixed(1)}</div>
          <p className="text-xs text-muted-foreground">
            {stats.pendingApprovals > 0 ? (
              <span className="text-yellow-600">{t('pending_approvals', { count: stats.pendingApprovals })}</span>
            ) : (
              t('all_caught_up')
            )}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t('draft_invoices')}</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.draftInvoices}</div>
          <p className="text-xs text-muted-foreground">
            {t('ready_to_send')}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t('outstanding')}</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(stats.outstandingAmount)}</div>
          <p className="text-xs text-muted-foreground">
            {t('active_projects', { count: stats.activeProjects })}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
