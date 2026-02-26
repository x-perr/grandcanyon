'use client'

import { useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import { Clock, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent } from '@/components/ui/card'
import { formatWeekRangeLocale, formatDateISO, getCurrentWeekStart, parseDateISO } from '@/lib/date'
import { usePagination } from '@/hooks'
import type { TimesheetWithUser } from '@/app/(protected)/timesheets/actions'

interface TimesheetListProps {
  timesheets: TimesheetWithUser[]
  totalCount: number
  currentPage: number
  pageSize: number
}

export function TimesheetList({
  timesheets,
  totalCount,
  currentPage,
  pageSize,
}: TimesheetListProps) {
  const t = useTranslations('timesheets')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const locale = useLocale() as 'en' | 'fr'

  // Use custom hook for pagination
  const {
    totalPages,
    goToPage,
    isPending,
    hasPrevious,
    hasNext,
    startIndex,
    endIndex,
  } = usePagination({
    totalCount,
    pageSize,
    currentPage,
    basePath: '/timesheets',
  })

  const currentWeekStart = useMemo(() => formatDateISO(getCurrentWeekStart()), [])

  const formatHours = useCallback((hours: number) => {
    return hours.toFixed(1)
  }, [])

  return (
    <div className="space-y-4">
      {timesheets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 animate-in fade-in duration-300">
            <Clock className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">{t('no_timesheets')}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t('no_timesheets_message')}
            </p>
            <Button asChild className="mt-4">
              <Link href={`/timesheets/${currentWeekStart}`}>{t('enter_current_week')}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('table.week')}</TableHead>
                <TableHead className="text-right">{t('table.hours')}</TableHead>
                <TableHead className="hidden sm:table-cell">{t('table.status')}</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {timesheets.map((timesheet) => {
                const weekStart = parseDateISO(timesheet.week_start)
                const weekRange = formatWeekRangeLocale(weekStart, locale)
                const isCurrentWeek = timesheet.week_start === currentWeekStart

                return (
                  <TableRow
                    key={timesheet.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/timesheets/${timesheet.week_start}`)}
                  >
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {weekRange}
                          {isCurrentWeek && (
                            <span className="ml-2 text-xs text-primary">{t('current_week_badge')}</span>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground sm:hidden">
                          {timesheet.status && <StatusBadge status={timesheet.status} />}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatHours(timesheet.total_hours ?? 0)}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {timesheet.status && <StatusBadge status={timesheet.status} />}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/timesheets/${timesheet.week_start}`}>
                          <ExternalLink className="h-4 w-4" />
                          <span className="sr-only">{tCommon('actions.view')}</span>
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {tCommon('pagination.showing', {
              start: startIndex,
              end: endIndex,
              total: totalCount,
            })}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(currentPage - 1)}
              disabled={!hasPrevious || isPending}
            >
              {tCommon('actions.previous')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(currentPage + 1)}
              disabled={!hasNext || isPending}
            >
              {tCommon('actions.next')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
