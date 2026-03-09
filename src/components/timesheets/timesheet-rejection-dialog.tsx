'use client'

import { X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { useTranslations } from 'next-intl'
import type { RejectionTarget } from './timesheet-detail-panel'

interface TimesheetRejectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  rejectTarget: RejectionTarget
  rejectReason: string
  onRejectReasonChange: (reason: string) => void
  onConfirm: () => void
  isProcessing: boolean
  t: ReturnType<typeof useTranslations<'timesheets'>>
  tCommon: ReturnType<typeof useTranslations<'common'>>
}

export function TimesheetRejectionDialog({
  open,
  onOpenChange,
  rejectTarget,
  rejectReason,
  onRejectReasonChange,
  onConfirm,
  isProcessing,
  t,
  tCommon,
}: TimesheetRejectionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
          onChange={(e) => onRejectReasonChange(e.target.value)}
          rows={3}
        />
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
          >
            {tCommon('actions.cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
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
  )
}
