'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check, X, Clock, FileText, User, Receipt, ChevronDown, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/status-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatWeekRangeLocale, parseDateISO } from '@/lib/date'
import { formatCurrency } from '@/lib/validations/expense'
import type { getTimesheetById } from '@/app/(protected)/timesheets/actions'
import type { getExpensesByUserAndWeek } from '@/app/(protected)/expenses/actions'

type TimesheetDetail = Awaited<ReturnType<typeof getTimesheetById>>
type ExpenseDetail = Awaited<ReturnType<typeof getExpensesByUserAndWeek>>

export type ApprovalTarget = 'timesheet' | 'expenses' | 'both'
export type RejectionTarget = 'timesheet' | 'expenses' | 'both'

interface TimesheetDetailPanelProps {
  data: TimesheetDetail | null
  expenseData?: ExpenseDetail | null
  loading: boolean
  weekStart: string
  locale: 'en' | 'fr'
  onApprove: (id: string) => void
  onReject: (id: string) => void
  onApproveGranular?: (timesheetId: string | null, expenseId: string | null, target: ApprovalTarget) => void
  onRejectGranular?: (timesheetId: string | null, expenseId: string | null, target: RejectionTarget, reason?: string) => void
  canApprove: boolean
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DAY_LABELS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

export function TimesheetDetailPanel({
  data,
  expenseData,
  loading,
  weekStart,
  locale,
  onApprove,
  onReject,
  onApproveGranular,
  onRejectGranular,
  canApprove,
}: TimesheetDetailPanelProps) {
  const t = useTranslations('timesheets')
  const tExpenses = useTranslations('expenses')
  const tCommon = useTranslations('common')

  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [rejectTarget, setRejectTarget] = useState<RejectionTarget>('both')
  const [rejectReason, setRejectReason] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

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

      {/* Expenses Section */}
      {expenseData && expenseData.entries && expenseData.entries.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                {tExpenses('title')}
              </CardTitle>
              <StatusBadge status={expenseData.status ?? 'draft'} />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tExpenses('table.date')}</TableHead>
                    <TableHead>{tExpenses('table.type')}</TableHead>
                    <TableHead>{tExpenses('table.description')}</TableHead>
                    <TableHead className="text-right">{tExpenses('table.amount')}</TableHead>
                    <TableHead className="text-right">{tExpenses('table.taxes')}</TableHead>
                    <TableHead className="text-right">{tExpenses('table.total')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenseData.entries.map((entry) => {
                    const expenseType = Array.isArray(entry.expense_type)
                      ? entry.expense_type[0]
                      : entry.expense_type
                    const project = Array.isArray(entry.project)
                      ? entry.project[0]
                      : entry.project

                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="text-sm">
                          {entry.expense_date
                            ? new Date(entry.expense_date).toLocaleDateString(locale, {
                                month: 'short',
                                day: 'numeric',
                              })
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">{expenseType?.name ?? '-'}</div>
                          <div className="text-xs text-muted-foreground">{project?.code}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm max-w-[200px] truncate" title={entry.description ?? ''}>
                            {entry.description}
                          </div>
                          {entry.receipt_number && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <span>#{entry.receipt_number}</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatCurrency(entry.subtotal ?? 0)}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          <div>{tExpenses('table.gst')}: {formatCurrency(entry.gst_amount ?? 0)}</div>
                          <div>{tExpenses('table.qst')}: {formatCurrency(entry.qst_amount ?? 0)}</div>
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          {formatCurrency(entry.total ?? 0)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  {/* Expense Totals */}
                  <TableRow className="bg-muted/50 font-medium">
                    <TableCell colSpan={3} className="text-right">
                      {tExpenses('summary.total_expenses')}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(expenseData.totals?.subtotal ?? 0)}
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      <div>{tExpenses('table.gst')}: {formatCurrency(expenseData.totals?.gst ?? 0)}</div>
                      <div>{tExpenses('table.qst')}: {formatCurrency(expenseData.totals?.qst ?? 0)}</div>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(expenseData.totals?.total ?? 0)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Expenses Indicator */}
      {expenseData && (!expenseData.entries || expenseData.entries.length === 0) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              {tExpenses('title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center py-4">
              {tExpenses('grid.no_entries')}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Granular Approval Actions */}
      {canApprove && onApproveGranular && onRejectGranular && (
        <GranularApprovalSection
          data={data}
          expenseData={expenseData}
          t={t}
          tExpenses={tExpenses}
          tCommon={tCommon}
          locale={locale}
          onApproveGranular={onApproveGranular}
          onRejectGranular={onRejectGranular}
          showRejectDialog={showRejectDialog}
          setShowRejectDialog={setShowRejectDialog}
          rejectTarget={rejectTarget}
          setRejectTarget={setRejectTarget}
          rejectReason={rejectReason}
          setRejectReason={setRejectReason}
          isProcessing={isProcessing}
          setIsProcessing={setIsProcessing}
        />
      )}

      {/* Legacy Approval Actions (for direct manager approval) */}
      {canApprove && !onApproveGranular && data.status === 'submitted' && (
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

      {expenseData?.rejection_reason && (
        <div className="text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-md">
          <strong>{tExpenses('detail.rejection_reason')}:</strong> {expenseData.rejection_reason}
        </div>
      )}
    </div>
  )
}

// === GRANULAR APPROVAL SECTION ===

interface GranularApprovalSectionProps {
  data: TimesheetDetail
  expenseData?: ExpenseDetail | null
  t: ReturnType<typeof useTranslations<'timesheets'>>
  tExpenses: ReturnType<typeof useTranslations<'expenses'>>
  tCommon: ReturnType<typeof useTranslations<'common'>>
  locale: 'en' | 'fr'
  onApproveGranular: (timesheetId: string | null, expenseId: string | null, target: ApprovalTarget) => void
  onRejectGranular: (timesheetId: string | null, expenseId: string | null, target: RejectionTarget, reason?: string) => void
  showRejectDialog: boolean
  setShowRejectDialog: (show: boolean) => void
  rejectTarget: RejectionTarget
  setRejectTarget: (target: RejectionTarget) => void
  rejectReason: string
  setRejectReason: (reason: string) => void
  isProcessing: boolean
  setIsProcessing: (processing: boolean) => void
}

function GranularApprovalSection({
  data,
  expenseData,
  t,
  tExpenses,
  tCommon,
  locale,
  onApproveGranular,
  onRejectGranular,
  showRejectDialog,
  setShowRejectDialog,
  rejectTarget,
  setRejectTarget,
  rejectReason,
  setRejectReason,
  isProcessing,
  setIsProcessing,
}: GranularApprovalSectionProps) {
  if (!data) return null

  const timesheetStatus = data.status
  const expenseStatus = expenseData?.status
  const timesheetId = data.id
  const expenseId = expenseData?.id ?? null

  const canApproveTimesheet = timesheetStatus === 'submitted'
  const canApproveExpenses = expenseStatus === 'submitted'
  const canApproveBoth = canApproveTimesheet && canApproveExpenses

  const canRejectTimesheet = timesheetStatus === 'submitted' || timesheetStatus === 'approved'
  const canRejectExpenses = expenseStatus === 'submitted' || expenseStatus === 'approved'

  // No actions needed if nothing is pending
  if (!canApproveTimesheet && !canApproveExpenses && !canRejectTimesheet && !canRejectExpenses) {
    return null
  }

  const handleApprove = async (target: ApprovalTarget) => {
    setIsProcessing(true)
    try {
      onApproveGranular(timesheetId, expenseId, target)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRejectClick = (target: RejectionTarget) => {
    setRejectTarget(target)
    setRejectReason('')
    setShowRejectDialog(true)
  }

  const handleRejectConfirm = async () => {
    setIsProcessing(true)
    try {
      onRejectGranular(timesheetId, expenseId, rejectTarget, rejectReason)
      setShowRejectDialog(false)
      setRejectReason('')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('team.approval_actions')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status Summary */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
              <span>{t('detail.hours_label')}</span>
              <StatusBadge status={timesheetStatus ?? 'draft'} />
            </div>
            {expenseData && (
              <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                <span>{tExpenses('title')}</span>
                <StatusBadge status={expenseStatus ?? 'draft'} />
              </div>
            )}
          </div>

          {/* Approve Actions */}
          {(canApproveTimesheet || canApproveExpenses) && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">{t('team.approve_label')}</p>
              <div className="flex flex-wrap gap-2">
                {canApproveBoth && (
                  <Button
                    size="sm"
                    onClick={() => handleApprove('both')}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="mr-2 h-4 w-4" />
                    )}
                    {t('team.approve_both')}
                  </Button>
                )}
                {canApproveTimesheet && !canApproveBoth && (
                  <Button
                    size="sm"
                    onClick={() => handleApprove('timesheet')}
                    disabled={isProcessing}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    {t('team.approve_timesheet')}
                  </Button>
                )}
                {canApproveExpenses && !canApproveBoth && (
                  <Button
                    size="sm"
                    onClick={() => handleApprove('expenses')}
                    disabled={isProcessing}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    {t('team.approve_expenses')}
                  </Button>
                )}
                {canApproveBoth && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        {t('team.approve_selective')}
                        <ChevronDown className="ml-2 h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => handleApprove('timesheet')}>
                        {t('team.approve_timesheet_only')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleApprove('expenses')}>
                        {t('team.approve_expenses_only')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          )}

          {/* Reject Actions */}
          {(canRejectTimesheet || canRejectExpenses) && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">{t('team.reject_label')}</p>
              <div className="flex flex-wrap gap-2">
                {canRejectTimesheet && canRejectExpenses && expenseData && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleRejectClick('both')}
                    disabled={isProcessing}
                  >
                    <X className="mr-2 h-4 w-4" />
                    {t('team.reject_both')}
                  </Button>
                )}
                {canRejectTimesheet && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive border-destructive hover:bg-destructive/10"
                    onClick={() => handleRejectClick('timesheet')}
                    disabled={isProcessing}
                  >
                    <X className="mr-2 h-4 w-4" />
                    {t('team.reject_timesheet')}
                  </Button>
                )}
                {canRejectExpenses && expenseData && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive border-destructive hover:bg-destructive/10"
                    onClick={() => handleRejectClick('expenses')}
                    disabled={isProcessing}
                  >
                    <X className="mr-2 h-4 w-4" />
                    {t('team.reject_expenses')}
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rejection Reason Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {rejectTarget === 'both'
                ? t('team.reject_both_title')
                : rejectTarget === 'timesheet'
                ? t('team.reject_timesheet_title')
                : t('team.reject_expenses_title')}
            </DialogTitle>
            <DialogDescription>
              {t('team.reject_description')}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder={t('team.reject_reason_placeholder')}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRejectDialog(false)}
              disabled={isProcessing}
            >
              {tCommon('actions.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectConfirm}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('team.rejecting')}
                </>
              ) : (
                <>
                  <X className="mr-2 h-4 w-4" />
                  {t('team.confirm_reject')}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
