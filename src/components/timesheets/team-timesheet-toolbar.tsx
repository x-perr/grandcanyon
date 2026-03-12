import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Check,
  Download,
  Mail,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { useTranslations } from 'next-intl'

interface TeamTimesheetToolbarProps {
  weekRange: string
  isPending: boolean
  isNextWeekDisabled: boolean
  isCurrentWeekSelected: boolean
  isFutureWeekSelected: boolean
  canApprove: boolean
  selectedCount: number
  missingCount: number
  isSendingReminders: boolean
  onNavigateWeek: (direction: 'prev' | 'next') => void
  onGoToToday: () => void
  onExportCSV: () => void
  onSendReminders: () => void
  onBulkApprove: () => void
  t: ReturnType<typeof useTranslations<'timesheets'>>
}

export function TeamTimesheetToolbar({
  weekRange,
  isPending,
  isNextWeekDisabled,
  isCurrentWeekSelected,
  isFutureWeekSelected,
  canApprove,
  selectedCount,
  missingCount,
  isSendingReminders,
  onNavigateWeek,
  onGoToToday,
  onExportCSV,
  onSendReminders,
  onBulkApprove,
  t,
}: TeamTimesheetToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => onNavigateWeek('prev')}
          disabled={isPending}
          aria-label={t('team.previous_week')}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{weekRange}</span>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => onNavigateWeek('next')}
          disabled={isPending || isNextWeekDisabled}
          aria-label={t('team.next_week')}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        {!isCurrentWeekSelected && !isFutureWeekSelected && (
          <Button variant="ghost" size="sm" onClick={onGoToToday} disabled={isPending}>
            {t('team.today')}
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={onExportCSV}>
          <Download className="mr-2 h-4 w-4" />
          {t('team.export')}
        </Button>
        {canApprove && missingCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={onSendReminders}
            disabled={isSendingReminders}
            className="text-amber-600 border-amber-300 hover:bg-amber-50"
          >
            {isSendingReminders ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Mail className="mr-2 h-4 w-4" />
            )}
            {t('team.send_reminders', { count: missingCount })}
          </Button>
        )}
      </div>

      {/* Bulk Actions */}
      {canApprove && selectedCount > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {t('team.selected', { count: selectedCount })}
          </span>
          <Button size="sm" onClick={onBulkApprove} disabled={isPending}>
            <Check className="mr-2 h-4 w-4" />
            {t('team.approve_selected')}
          </Button>
        </div>
      )}
    </div>
  )
}
