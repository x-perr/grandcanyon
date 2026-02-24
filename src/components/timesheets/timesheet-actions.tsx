'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Send, Copy, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { submitTimesheet, copyPreviousWeek } from '@/app/(protected)/timesheets/actions'
import { toast } from 'sonner'
import type { Tables } from '@/types/database'

interface TimesheetActionsProps {
  timesheet: Tables<'timesheets'>
  isEditable: boolean
  hasEntries: boolean
}

export function TimesheetActions({ timesheet, isEditable, hasEntries }: TimesheetActionsProps) {
  const t = useTranslations('timesheets')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showSubmitDialog, setShowSubmitDialog] = useState(false)
  const [isCopying, setIsCopying] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      const result = await submitTimesheet(timesheet.id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(t('toast.submitted'))
        setShowSubmitDialog(false)
        startTransition(() => {
          router.refresh()
        })
      }
    } catch {
      toast.error(t('toast.submit_failed'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCopyPreviousWeek = async () => {
    setIsCopying(true)
    try {
      const result = await copyPreviousWeek(timesheet.id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(t('toast.copied', { count: result.entriesCopied ?? 0 }))
        startTransition(() => {
          router.refresh()
        })
      }
    } catch {
      toast.error(t('toast.copy_failed'))
    } finally {
      setIsCopying(false)
    }
  }

  if (!isEditable) {
    return null
  }

  return (
    <>
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopyPreviousWeek}
          disabled={isCopying || isPending}
        >
          {isCopying ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Copy className="mr-2 h-4 w-4" />
          )}
          {t('actions.copy_last_week')}
        </Button>

        <Button
          size="sm"
          onClick={() => setShowSubmitDialog(true)}
          disabled={!hasEntries || isPending}
        >
          <Send className="mr-2 h-4 w-4" />
          {t('actions.submit_for_approval')}
        </Button>
      </div>

      {/* Submit Confirmation Dialog */}
      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('actions.submit_title')}</DialogTitle>
            <DialogDescription>
              {t('actions.submit_message')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSubmitDialog(false)}
              disabled={isSubmitting}
            >
              {tCommon('actions.cancel')}
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('actions.submitting')}
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  {t('actions.submit')}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
