'use client'

import { useState, useCallback, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Check,
  X,
  Eye,
  Clock,
  Users,
  CheckCircle,
  AlertCircle,
  Download,
  Mail,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  formatDateISO,
  getMonday,
  formatWeekRangeLocale,
  parseDateISO,
  addDays,
} from '@/lib/date'
import { generateCSV, downloadCSV, formatHoursForCSV, formatDateForCSV } from '@/lib/csv'
import type { TeamTimesheetRow, TeamTimesheetSummary } from '@/app/(protected)/timesheets/actions'
import {
  bulkApproveTimesheets,
  approveTimesheet,
  rejectTimesheet,
  getTimesheetById,
  approveTimesheetOnly,
  rejectTimesheetOnly,
  approveExpensesOnly,
  rejectExpensesOnly,
  approveBoth,
  rejectBoth,
  sendTimesheetReminders,
} from '@/app/(protected)/timesheets/actions'
import { getExpensesByUserAndWeek } from '@/app/(protected)/expenses/actions'
import { TimesheetDetailPanel, type ApprovalTarget, type RejectionTarget } from './timesheet-detail-panel'

interface TeamTimesheetTableProps {
  rows: TeamTimesheetRow[]
  summary: TeamTimesheetSummary
  weekStart: string
  canApprove: boolean
}

type TimesheetDetail = Awaited<ReturnType<typeof getTimesheetById>>
type ExpenseDetail = Awaited<ReturnType<typeof getExpensesByUserAndWeek>>

export function TeamTimesheetTable({
  rows,
  summary,
  weekStart,
  canApprove,
}: TeamTimesheetTableProps) {
  const router = useRouter()
  const t = useTranslations('timesheets')
  const tCommon = useTranslations('common')
  const locale = useLocale() as 'en' | 'fr'
  const [isPending, startTransition] = useTransition()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailData, setDetailData] = useState<TimesheetDetail | null>(null)
  const [expenseData, setExpenseData] = useState<ExpenseDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [isSendingReminders, setIsSendingReminders] = useState(false)

  // Calculate week range
  const weekDate = useMemo(() => parseDateISO(weekStart), [weekStart])
  const weekRange = useMemo(() => formatWeekRangeLocale(weekDate, locale), [weekDate, locale])

  // Navigation
  const navigateWeek = useCallback((direction: 'prev' | 'next') => {
    const current = parseDateISO(weekStart)
    const offset = direction === 'prev' ? -7 : 7
    const newWeek = formatDateISO(addDays(current, offset))
    startTransition(() => {
      router.push(`/timesheets/team?week=${newWeek}`)
    })
  }, [weekStart, router])

  const goToToday = useCallback(() => {
    const today = formatDateISO(getMonday(new Date()))
    startTransition(() => {
      router.push(`/timesheets/team?week=${today}`)
    })
  }, [router])

  // Selection
  const submittedRows = useMemo(
    () => rows.filter((r) => r.status === 'submitted' && r.timesheetId),
    [rows]
  )

  const toggleSelect = useCallback((timesheetId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(timesheetId)) {
        next.delete(timesheetId)
      } else {
        next.add(timesheetId)
      }
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === submittedRows.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(submittedRows.map((r) => r.timesheetId!)))
    }
  }, [selectedIds.size, submittedRows])

  // Actions
  const handleBulkApprove = useCallback(async () => {
    if (selectedIds.size === 0) return

    const result = await bulkApproveTimesheets(Array.from(selectedIds))
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(t('team.bulk_approved', { count: result.approvedCount ?? 0 }))
      setSelectedIds(new Set())
      router.refresh()
    }
  }, [selectedIds, t, router])

  const handleApprove = useCallback(async (timesheetId: string) => {
    const result = await approveTimesheet(timesheetId)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(t('toast.approved'))
      router.refresh()
    }
  }, [t, router])

  const handleReject = useCallback(async (timesheetId: string) => {
    const reason = prompt(t('team.reject_reason'))
    if (reason === null) return // Cancelled

    const result = await rejectTimesheet(timesheetId, reason || undefined)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(t('toast.rejected'))
      router.refresh()
    }
  }, [t, router])

  // Granular approval handlers for Phase 3
  const handleApproveGranular = useCallback(async (
    timesheetId: string | null,
    expenseId: string | null,
    target: ApprovalTarget
  ) => {
    let result: { success?: boolean; error?: string }

    if (target === 'both' && timesheetId && expenseId) {
      result = await approveBoth(timesheetId, expenseId)
    } else if (target === 'timesheet' && timesheetId) {
      result = await approveTimesheetOnly(timesheetId)
    } else if (target === 'expenses' && expenseId) {
      result = await approveExpensesOnly(expenseId)
    } else {
      toast.error(t('team.nothing_to_approve'))
      return
    }

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(t('toast.approved'))
      // Refresh data in detail panel
      if (detailData?.id) {
        const userId = (Array.isArray(detailData.user) ? detailData.user[0] : detailData.user)?.id
        if (userId) {
          const [newTimesheet, newExpenses] = await Promise.all([
            getTimesheetById(detailData.id),
            getExpensesByUserAndWeek(userId, weekStart),
          ])
          setDetailData(newTimesheet)
          setExpenseData(newExpenses)
        }
      }
      router.refresh()
    }
  }, [t, router, detailData, weekStart])

  const handleRejectGranular = useCallback(async (
    timesheetId: string | null,
    expenseId: string | null,
    target: RejectionTarget,
    reason?: string
  ) => {
    let result: { success?: boolean; error?: string }

    if (target === 'both' && timesheetId) {
      result = await rejectBoth(timesheetId, expenseId, reason)
    } else if (target === 'timesheet' && timesheetId) {
      result = await rejectTimesheetOnly(timesheetId, reason)
    } else if (target === 'expenses' && expenseId) {
      result = await rejectExpensesOnly(expenseId, reason)
    } else {
      toast.error(t('team.nothing_to_reject'))
      return
    }

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(t('toast.rejected'))
      // Refresh data in detail panel
      if (detailData?.id) {
        const userId = (Array.isArray(detailData.user) ? detailData.user[0] : detailData.user)?.id
        if (userId) {
          const [newTimesheet, newExpenses] = await Promise.all([
            getTimesheetById(detailData.id),
            getExpensesByUserAndWeek(userId, weekStart),
          ])
          setDetailData(newTimesheet)
          setExpenseData(newExpenses)
        }
      }
      router.refresh()
    }
  }, [t, router, detailData, weekStart])

  const handleViewDetail = useCallback(async (row: TeamTimesheetRow) => {
    if (!row.timesheetId) {
      toast.error(t('team.no_timesheet'))
      return
    }

    setDetailLoading(true)
    setDetailOpen(true)
    setExpenseData(null)

    // Fetch timesheet and expenses in parallel
    const [timesheetData, expenses] = await Promise.all([
      getTimesheetById(row.timesheetId),
      getExpensesByUserAndWeek(row.userId, weekStart),
    ])

    setDetailData(timesheetData)
    setExpenseData(expenses)
    setDetailLoading(false)
  }, [t, weekStart])

  // CSV Export
  const handleExportCSV = useCallback(() => {
    const csv = generateCSV(rows, [
      { key: 'lastName', header: t('team.csv.last_name') },
      { key: 'firstName', header: t('team.csv.first_name') },
      { key: 'email', header: t('team.csv.email') },
      { key: 'status', header: t('team.csv.status'), format: (v) => tCommon(`status.${v}`) },
      { key: 'totalHours', header: t('team.csv.hours'), format: (v) => formatHoursForCSV(v as number) },
      { key: 'submittedAt', header: t('team.csv.submitted_at'), format: (v) => formatDateForCSV(v as string | null) },
      { key: 'approvedAt', header: t('team.csv.approved_at'), format: (v) => formatDateForCSV(v as string | null) },
    ])

    const filename = `timesheets-${weekStart}.csv`
    downloadCSV(csv, filename)
    toast.success(t('team.csv.exported'))
  }, [rows, weekStart, t, tCommon])

  // Missing timesheets (not started or draft)
  const missingRows = useMemo(
    () => rows.filter((r) => r.status === 'not_started' || r.status === 'draft'),
    [rows]
  )

  // Send reminders
  const handleSendReminders = useCallback(async () => {
    if (missingRows.length === 0) return

    const confirmed = window.confirm(
      t('team.reminders.confirm', { count: missingRows.length })
    )
    if (!confirmed) return

    setIsSendingReminders(true)
    try {
      const userIds = missingRows.map((r) => r.userId)
      const result = await sendTimesheetReminders(weekStart, userIds)

      if (result.error) {
        toast.error(result.error)
      } else {
        const successCount = result.results.filter((r) => r.success).length
        const failCount = result.results.filter((r) => !r.success).length

        if (successCount > 0) {
          toast.success(t('team.reminders.sent', { count: successCount }))
        }
        if (failCount > 0) {
          toast.error(t('team.reminders.failed', { count: failCount }))
        }
      }
    } finally {
      setIsSendingReminders(false)
    }
  }, [missingRows, weekStart, t])

  const formatHours = (hours: number) => hours.toFixed(1)

  return (
    <div className="space-y-4">
      {/* Week Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigateWeek('prev')}
            disabled={isPending}
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
            onClick={() => navigateWeek('next')}
            disabled={isPending}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={goToToday} disabled={isPending}>
            {t('team.today')}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="mr-2 h-4 w-4" />
            {t('team.export')}
          </Button>
          {canApprove && missingRows.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSendReminders}
              disabled={isSendingReminders}
              className="text-amber-600 border-amber-300 hover:bg-amber-50"
            >
              {isSendingReminders ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Mail className="mr-2 h-4 w-4" />
              )}
              {t('team.send_reminders', { count: missingRows.length })}
            </Button>
          )}
        </div>

        {/* Bulk Actions */}
        {canApprove && selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {t('team.selected', { count: selectedIds.size })}
            </span>
            <Button size="sm" onClick={handleBulkApprove} disabled={isPending}>
              <Check className="mr-2 h-4 w-4" />
              {t('team.approve_selected')}
            </Button>
          </div>
        )}
      </div>

      {/* Summary Cards */}
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

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {canApprove && submittedRows.length > 0 && (
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={selectedIds.size === submittedRows.length && submittedRows.length > 0}
                    onCheckedChange={toggleSelectAll}
                    aria-label={t('team.select_all')}
                  />
                </TableHead>
              )}
              <TableHead>{t('team.employee')}</TableHead>
              <TableHead>{tCommon('labels.status')}</TableHead>
              <TableHead className="text-right">{t('table.hours')}</TableHead>
              <TableHead className="hidden md:table-cell">{t('team.submitted')}</TableHead>
              <TableHead className="w-[120px]">{tCommon('labels.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  {t('team.no_employees')}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.userId}>
                  {canApprove && submittedRows.length > 0 && (
                    <TableCell>
                      {row.status === 'submitted' && row.timesheetId && (
                        <Checkbox
                          checked={selectedIds.has(row.timesheetId)}
                          onCheckedChange={() => toggleSelect(row.timesheetId!)}
                          aria-label={t('team.select_employee', {
                            name: `${row.firstName} ${row.lastName}`,
                          })}
                        />
                      )}
                    </TableCell>
                  )}
                  <TableCell>
                    <div>
                      <div className="font-medium">
                        {row.firstName} {row.lastName}
                      </div>
                      <div className="text-sm text-muted-foreground">{row.email}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={row.status} />
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatHours(row.totalHours)}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {row.submittedAt
                      ? new Date(row.submittedAt).toLocaleDateString(locale, {
                          month: 'short',
                          day: 'numeric',
                        })
                      : '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {row.timesheetId && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleViewDetail(row)}
                          title={tCommon('actions.view')}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                      {canApprove && row.status === 'submitted' && row.timesheetId && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleApprove(row.timesheetId!)}
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            title={t('actions.approve')}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleReject(row.timesheetId!)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            title={t('actions.reject')}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Detail Panel (Sheet) */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{t('team.detail_title')}</SheetTitle>
          </SheetHeader>
          <TimesheetDetailPanel
            data={detailData}
            expenseData={expenseData}
            loading={detailLoading}
            weekStart={weekStart}
            locale={locale}
            onApprove={handleApprove}
            onReject={handleReject}
            onApproveGranular={handleApproveGranular}
            onRejectGranular={handleRejectGranular}
            canApprove={canApprove}
          />
        </SheetContent>
      </Sheet>
    </div>
  )
}
