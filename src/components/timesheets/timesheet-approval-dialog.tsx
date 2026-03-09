'use client'

import { useState } from 'react'
import { Check, X, ChevronDown, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { useTranslations } from 'next-intl'
import type { getTimesheetById } from '@/app/(protected)/timesheets/actions'
import type { getExpensesByUserAndWeek } from '@/app/(protected)/expenses/actions'
import type { ApprovalTarget, RejectionTarget } from './timesheet-detail-panel'

type TimesheetDetail = Awaited<ReturnType<typeof getTimesheetById>>
type ExpenseDetail = Awaited<ReturnType<typeof getExpensesByUserAndWeek>>

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

export function GranularApprovalSection({
  data,
  expenseData,
  t,
  tExpenses,
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

  return (
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
  )
}
