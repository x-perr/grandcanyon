import { Clock, Users, CheckCircle, AlertCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import type { TeamTimesheetSummary } from '@/app/(protected)/timesheets/actions'
import type { useTranslations } from 'next-intl'

interface TeamTimesheetSummaryCardsProps {
  summary: TeamTimesheetSummary
  t: ReturnType<typeof useTranslations<'timesheets'>>
}

export function TeamTimesheetSummaryCards({ summary, t }: TeamTimesheetSummaryCardsProps) {
  const formatHours = (hours: number) => hours.toFixed(1)

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Users className="h-8 w-8 text-muted-foreground" />
            <div>
              <div className="text-2xl font-bold">{summary.total}</div>
              <p className="text-xs text-muted-foreground">{t('team.total_employees')}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Clock className="h-8 w-8 text-blue-500" />
            <div>
              <div className="text-2xl font-bold">{formatHours(summary.totalHours)}</div>
              <p className="text-xs text-muted-foreground">{t('team.total_hours')}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <AlertCircle className="h-8 w-8 text-amber-500" />
            <div>
              <div className="text-2xl font-bold">{summary.submitted}</div>
              <p className="text-xs text-muted-foreground">{t('team.pending_approval')}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <CheckCircle className="h-8 w-8 text-green-500" />
            <div>
              <div className="text-2xl font-bold">{summary.approved}</div>
              <p className="text-xs text-muted-foreground">{t('team.approved')}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
