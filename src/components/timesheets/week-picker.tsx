'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ChevronLeft, ChevronRight, Calendar, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  formatDateISO,
  formatWeekRange,
  getCurrentWeekStart,
  getNextWeekStart,
  getPreviousWeekStart,
  isCurrentWeek,
  isFutureWeek,
  parseDateISO,
} from '@/lib/date'

interface WeekPickerProps {
  weekStart: string
  basePath?: string // Default: '/timesheets'
  isLocked?: boolean // True when the week is not editable (past limit or future)
  lockReason?: string // Translated reason shown to the user
}

export function WeekPicker({ weekStart, basePath = '/timesheets', isLocked, lockReason }: WeekPickerProps) {
  const t = useTranslations('timesheets')
  const router = useRouter()
  const currentDate = parseDateISO(weekStart)
  const weekRange = formatWeekRange(currentDate)
  const isCurrent = isCurrentWeek(currentDate)
  const isFuture = isFutureWeek(currentDate)

  const goToPreviousWeek = () => {
    const prevWeek = getPreviousWeekStart(currentDate)
    router.push(`${basePath}/${formatDateISO(prevWeek)}`)
  }

  const goToNextWeek = () => {
    const nextWeek = getNextWeekStart(currentDate)
    // Block navigation to future weeks
    if (isFutureWeek(nextWeek)) return
    router.push(`${basePath}/${formatDateISO(nextWeek)}`)
  }

  const goToCurrentWeek = () => {
    const current = getCurrentWeekStart()
    router.push(`${basePath}/${formatDateISO(current)}`)
  }

  return (
    <div className="flex items-center justify-center gap-2">
      <Button variant="outline" size="sm" onClick={goToPreviousWeek}>
        <ChevronLeft className="h-4 w-4" />
        <span className="hidden sm:inline">{t('week_picker.previous')}</span>
      </Button>

      <div
        className={`flex items-center gap-2 rounded-md border px-4 py-2 ${
          isLocked ? 'border-muted bg-muted/30' : 'bg-muted/50'
        }`}
        title={isLocked ? lockReason : undefined}
      >
        {isLocked ? (
          <Lock className="h-4 w-4 text-muted-foreground" />
        ) : (
          <Calendar className="h-4 w-4 text-muted-foreground" />
        )}
        <span className={`font-medium ${isLocked ? 'text-muted-foreground' : ''}`}>{weekRange}</span>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={goToNextWeek}
        disabled={isCurrent || isFuture}
        title={isCurrent || isFuture ? t('errors.future_week') : undefined}
      >
        <span className="hidden sm:inline">{t('week_picker.next')}</span>
        <ChevronRight className="h-4 w-4" />
      </Button>

      {!isCurrent && !isFuture && (
        <Button variant="secondary" size="sm" onClick={goToCurrentWeek}>
          {t('current_week')}
        </Button>
      )}
    </div>
  )
}
