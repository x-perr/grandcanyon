'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Check, X, Clock, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { approveOtEntry, type OtApprovalEntry } from '@/app/(protected)/timesheets/actions'
import { toast } from 'sonner'

interface OtApprovalQueueProps {
  entries: OtApprovalEntry[]
}

export function OtApprovalQueue({ entries }: OtApprovalQueueProps) {
  const t = useTranslations('timesheets')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())

  // Unique key for each OT entry (entryId + dayIndex)
  const getKey = (entry: OtApprovalEntry) => `${entry.entryId}-${entry.dayIndex}`

  const handleApprove = async (entry: OtApprovalEntry) => {
    const key = getKey(entry)
    setProcessingIds((prev) => new Set(prev).add(key))

    try {
      const result = await approveOtEntry({
        timesheetEntryId: entry.entryId,
        dayIndex: entry.dayIndex,
        approved: true,
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(t('toast.ot_approved'))
        startTransition(() => {
          router.refresh()
        })
      }
    } catch {
      toast.error(t('toast.ot_approve_failed'))
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
  }

  const handleReject = async (entry: OtApprovalEntry) => {
    const key = getKey(entry)
    setProcessingIds((prev) => new Set(prev).add(key))

    try {
      const result = await approveOtEntry({
        timesheetEntryId: entry.entryId,
        dayIndex: entry.dayIndex,
        approved: false,
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(t('toast.ot_rejected'))
        startTransition(() => {
          router.refresh()
        })
      }
    } catch {
      toast.error(t('toast.ot_reject_failed'))
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
  }

  const handleBulkAction = async (approved: boolean) => {
    let successCount = 0
    for (const entry of entries) {
      try {
        const result = await approveOtEntry({
          timesheetEntryId: entry.entryId,
          dayIndex: entry.dayIndex,
          approved,
        })
        if (result.success) successCount++
      } catch {
        // Continue with next entry
      }
    }

    if (successCount > 0) {
      toast.success(
        approved
          ? t('toast.ot_bulk_approved', { count: successCount })
          : t('toast.ot_bulk_rejected', { count: successCount })
      )
      startTransition(() => {
        router.refresh()
      })
    }
  }

  if (entries.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Clock className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold">{t('ot.approvals.no_pending')}</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('ot.approvals.no_pending_message')}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Bulk Actions */}
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleBulkAction(false)}
          disabled={isPending}
          className="text-destructive hover:text-destructive"
        >
          <X className="mr-1 h-4 w-4" />
          {t('ot.approvals.reject_all')}
        </Button>
        <Button
          size="sm"
          onClick={() => handleBulkAction(true)}
          disabled={isPending}
        >
          <Check className="mr-1 h-4 w-4" />
          {t('ot.approvals.approve_all')}
        </Button>
      </div>

      {/* Approval Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('ot.approvals.employee')}</TableHead>
              <TableHead>{t('ot.approvals.week')}</TableHead>
              <TableHead>{t('ot.approvals.day')}</TableHead>
              <TableHead className="text-center">{t('ot.approvals.hours')}</TableHead>
              <TableHead>{t('ot.approvals.ot_type')}</TableHead>
              <TableHead>{t('ot.approvals.status')}</TableHead>
              <TableHead className="text-right">{t('ot.approvals.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => {
              const key = getKey(entry)
              const isProcessing = processingIds.has(key)

              return (
                <TableRow key={key}>
                  <TableCell>
                    <div>
                      <span className="font-medium">{entry.employeeName}</span>
                      <div className="text-xs text-muted-foreground">
                        <span className="font-mono">{entry.projectCode}</span>{' '}
                        {entry.projectName}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{entry.weekStart}</TableCell>
                  <TableCell>{t(`ot.approvals.day_names.${entry.dayIndex}`)}</TableCell>
                  <TableCell className="text-center font-mono">{entry.hours.toFixed(1)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {t(`ot.types.${entry.otType}`)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                    >
                      {t(`ot.status.${entry.otStatus}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        onClick={() => handleReject(entry)}
                        disabled={isProcessing}
                        title={t('ot.approvals.reject')}
                      >
                        {isProcessing ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
                        onClick={() => handleApprove(entry)}
                        disabled={isProcessing}
                        title={t('ot.approvals.approve')}
                      >
                        {isProcessing ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
