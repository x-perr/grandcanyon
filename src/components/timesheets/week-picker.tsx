'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  formatDateISO,
  formatWeekRange,
  getCurrentWeekStart,
  getNextWeekStart,
  getPreviousWeekStart,
  isCurrentWeek,
  parseDateISO,
} from '@/lib/date'

interface WeekPickerProps {
  weekStart: string
  basePath?: string // Default: '/timesheets'
}

export function WeekPicker({ weekStart, basePath = '/timesheets' }: WeekPickerProps) {
  const t = useTranslations('timesheets')
  const router = useRouter()
  const currentDate = parseDateISO(weekStart)
  const weekRange = formatWeekRange(currentDate)
  const isCurrent = isCurrentWeek(currentDate)

  const goToPreviousWeek = () => {
    const prevWeek = getPreviousWeekStart(currentDate)
    router.push(`${basePath}/${formatDateISO(prevWeek)}`)
  }

  const goToNextWeek = () => {
    const nextWeek = getNextWeekStart(currentDate)
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

      <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-4 py-2">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{weekRange}</span>
      </div>

      <Button variant="outline" size="sm" onClick={goToNextWeek}>
        <span className="hidden sm:inline">{t('week_picker.next')}</span>
        <ChevronRight className="h-4 w-4" />
      </Button>

      {!isCurrent && (
        <Button variant="secondary" size="sm" onClick={goToCurrentWeek}>
          {t('current_week')}
        </Button>
      )}
    </div>
  )
}
