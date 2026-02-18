'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Clock, FileText, FolderKanban, DollarSign } from 'lucide-react'
import { formatCurrency } from '@/lib/tax'
import type { DashboardStats } from '@/app/(protected)/dashboard/actions'

interface StatsCardsProps {
  stats: DashboardStats
}

export function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Open Timesheets</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.openTimesheets}</div>
          <p className="text-xs text-muted-foreground">
            Awaiting submission
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Hours This Week</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.hoursThisWeek.toFixed(1)}</div>
          <p className="text-xs text-muted-foreground">
            {stats.pendingApprovals > 0 ? (
              <span className="text-yellow-600">{stats.pendingApprovals} pending approvals</span>
            ) : (
              'All caught up'
            )}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Draft Invoices</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.draftInvoices}</div>
          <p className="text-xs text-muted-foreground">
            Ready to send
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(stats.outstandingAmount)}</div>
          <p className="text-xs text-muted-foreground">
            {stats.activeProjects} active projects
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
