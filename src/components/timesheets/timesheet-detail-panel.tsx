'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Check, X, Clock, FileText, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/status-badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatWeekRangeLocale, parseDateISO } from '@/lib/date'
import type { getTimesheetById } from '@/app/(protected)/timesheets/actions'

type TimesheetDetail = Awaited<ReturnType<typeof getTimesheetById>>

interface TimesheetDetailPanelProps {
  data: TimesheetDetail | null
  loading: boolean
  weekStart: string
  locale: 'en' | 'fr'
  onApprove: (id: string) => void
  onReject: (id: string) => void
  canApprove: boolean
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DAY_LABELS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

export function TimesheetDetailPanel({
  data,
  loading,
  weekStart,
  locale,
  onApprove,
  onReject,
  canApprove,
}: TimesheetDetailPanelProps) {
  const t = useTranslations('timesheets')

  const dayLabels = locale === 'fr' ? DAY_LABELS_FR : DAY_LABELS

  // Calculate totals
  const { entries, dailyTotals, grandTotal } = useMemo(() => {
    if (!data?.entries) {
      return { entries: [] as NonNullable<typeof data>['entries'], dailyTotals: [0, 0, 0, 0, 0, 0, 0], grandTotal: 0 }
    }

    const dailyTotals = [0, 0, 0, 0, 0, 0, 0]
    let grandTotal = 0

    data.entries.forEach((entry: { hours?: (number | null)[] | null }) => {
      const hours = entry.hours ?? [0, 0, 0, 0, 0, 0, 0]
      hours.forEach((h: number | null, i: number) => {
        const val = h ?? 0
        dailyTotals[i] += val
        grandTotal += val
      })
    })

    return { entries: data.entries, dailyTotals, grandTotal }
  }, [data])

  const user = useMemo(() => {
    if (!data?.user) return null
    return Array.isArray(data.user) ? data.user[0] : data.user
  }, [data])

  const weekRange = useMemo(
    () => formatWeekRangeLocale(parseDateISO(weekStart), locale),
    [weekStart, locale]
  )

  if (loading) {
    return (
      <div className="space-y-4 pt-6">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <FileText className="h-12 w-12 mb-4" />
        <p>{t('team.no_data')}</p>
      </div>
    )
  }

  const formatHours = (h: number | null) => {
    if (!h || h === 0) return '-'
    return h.toFixed(1)
  }

  return (
    <div className="space-y-6 pt-6">
      {/* Employee Info */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <User className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">
                {user?.first_name} {user?.last_name}
              </h3>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
            <StatusBadge status={data.status ?? 'draft'} />
          </div>
          <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
            <span>{weekRange}</span>
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {grandTotal.toFixed(1)}h {t('detail.total')}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Hours by Project */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('detail.hours_by_project')}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[150px]">{t('detail.project')}</TableHead>
                  {dayLabels.map((day, i) => (
                    <TableHead key={i} className="w-[50px] text-center">
                      {day}
                    </TableHead>
                  ))}
                  <TableHead className="w-[60px] text-right">{t('detail.total')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-4 text-muted-foreground">
                      {t('detail.no_entries')}
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {entries.map((entry: typeof entries[number]) => {
                      const hours = entry.hours ?? [0, 0, 0, 0, 0, 0, 0]
                      const rowTotal = hours.reduce((s: number, h: number | null) => s + (h ?? 0), 0)
                      const project = Array.isArray(entry.project)
                        ? entry.project[0]
                        : entry.project

                      return (
                        <TableRow key={entry.id}>
                          <TableCell>
                            <div className="font-medium">{project?.code ?? '-'}</div>
                            <div className="text-xs text-muted-foreground">
                              {entry.description || project?.name}
                            </div>
                          </TableCell>
                          {hours.map((h: number | null, i: number) => (
                            <TableCell key={i} className="text-center font-mono text-sm">
                              {formatHours(h)}
                            </TableCell>
                          ))}
                          <TableCell className="text-right font-mono font-medium">
                            {rowTotal.toFixed(1)}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    {/* Totals Row */}
                    <TableRow className="bg-muted/50 font-medium">
                      <TableCell>{t('detail.daily_total')}</TableCell>
                      {dailyTotals.map((total, i) => (
                        <TableCell key={i} className="text-center font-mono">
                          {formatHours(total)}
                        </TableCell>
                      ))}
                      <TableCell className="text-right font-mono">{grandTotal.toFixed(1)}</TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Approval Actions */}
      {canApprove && data.status === 'submitted' && (
        <div className="flex gap-2">
          <Button onClick={() => onApprove(data.id)} className="flex-1">
            <Check className="mr-2 h-4 w-4" />
            {t('actions.approve')}
          </Button>
          <Button variant="destructive" onClick={() => onReject(data.id)} className="flex-1">
            <X className="mr-2 h-4 w-4" />
            {t('actions.reject')}
          </Button>
        </div>
      )}

      {/* Status Info */}
      {data.status === 'approved' && data.approved_at && (
        <div className="text-sm text-muted-foreground bg-green-50 dark:bg-green-900/20 p-3 rounded-md">
          {t('detail.approved_on', {
            date: new Date(data.approved_at).toLocaleDateString(locale, {
              dateStyle: 'medium',
            }),
          })}
        </div>
      )}

      {data.rejection_reason && (
        <div className="text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-md">
          <strong>{t('detail.rejection_reason')}:</strong> {data.rejection_reason}
        </div>
      )}
    </div>
  )
}
