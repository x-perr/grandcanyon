'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Check, X, Eye, Users } from 'lucide-react'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { formatWeekRange, parseDateISO } from '@/lib/date'
import { approveTimesheet, rejectTimesheet } from '@/app/(protected)/timesheets/actions'
import type { TimesheetWithUser } from '@/app/(protected)/timesheets/actions'
import { toast } from 'sonner'

interface ApprovalQueueProps {
  timesheets: TimesheetWithUser[]
}

export function ApprovalQueue({ timesheets }: ApprovalQueueProps) {
  const t = useTranslations('timesheets')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [rejectDialog, setRejectDialog] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [processingId, setProcessingId] = useState<string | null>(null)

  const handleApprove = async (timesheetId: string) => {
    setProcessingId(timesheetId)
    try {
      const result = await approveTimesheet(timesheetId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(t('toast.approved'))
        startTransition(() => {
          router.refresh()
        })
      }
    } catch {
      toast.error(t('toast.approve_failed'))
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = async () => {
    if (!rejectDialog) return
    setProcessingId(rejectDialog)
    try {
      const result = await rejectTimesheet(rejectDialog, rejectReason || undefined)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(t('toast.rejected'))
        setRejectDialog(null)
        setRejectReason('')
        startTransition(() => {
          router.refresh()
        })
      }
    } catch {
      toast.error(t('toast.reject_failed'))
    } finally {
      setProcessingId(null)
    }
  }

  const formatHours = (hours: number) => {
    return hours.toFixed(1)
  }

  const timesheetToReject = timesheets.find((ts) => ts.id === rejectDialog)
  const rejectUserName = timesheetToReject?.user
    ? `${timesheetToReject.user.first_name} ${timesheetToReject.user.last_name}`
    : ''

  if (timesheets.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Users className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold">{t('approval.no_pending')}</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('approval.no_pending_message')}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('table.employee')}</TableHead>
              <TableHead>{t('table.week')}</TableHead>
              <TableHead className="text-right">{t('table.hours')}</TableHead>
              <TableHead className="hidden sm:table-cell">{t('table.status')}</TableHead>
              <TableHead className="text-right">{t('table.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {timesheets.map((timesheet) => {
              const weekStart = parseDateISO(timesheet.week_start)
              const weekRange = formatWeekRange(weekStart)
              const employeeName = timesheet.user
                ? `${timesheet.user.first_name} ${timesheet.user.last_name}`
                : 'Unknown'
              const isProcessing = processingId === timesheet.id

              return (
                <TableRow key={timesheet.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{employeeName}</div>
                      <div className="text-sm text-muted-foreground">{timesheet.user?.email}</div>
                    </div>
                  </TableCell>
                  <TableCell>{weekRange}</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatHours(timesheet.total_hours ?? 0)}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {timesheet.status && <StatusBadge status={timesheet.status} />}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/timesheets/${timesheet.week_start}/review?user=${timesheet.user_id}`)}
                        disabled={isProcessing}
                      >
                        <Eye className="h-4 w-4" />
                        <span className="sr-only">{t('approval.review')}</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-green-600 hover:bg-green-50 hover:text-green-700"
                        onClick={() => handleApprove(timesheet.id)}
                        disabled={isProcessing || isPending}
                      >
                        <Check className="h-4 w-4" />
                        <span className="sr-only">{t('approval.approve')}</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() => setRejectDialog(timesheet.id)}
                        disabled={isProcessing || isPending}
                      >
                        <X className="h-4 w-4" />
                        <span className="sr-only">{t('approval.reject')}</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Reject Dialog */}
      <Dialog open={!!rejectDialog} onOpenChange={() => setRejectDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('approval.reject_title')}</DialogTitle>
            <DialogDescription>
              {t('approval.reject_message', { name: rejectUserName })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">{t('approval.rejection_reason')}</Label>
              <Textarea
                id="reason"
                placeholder={t('approval.rejection_reason_placeholder')}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectDialog(null)
                setRejectReason('')
              }}
              disabled={!!processingId}
            >
              {tCommon('actions.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!!processingId}
            >
              {processingId ? t('approval.rejecting') : t('approval.reject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
