'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
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
        toast.success('Timesheet submitted for approval')
        setShowSubmitDialog(false)
        startTransition(() => {
          router.refresh()
        })
      }
    } catch {
      toast.error('Failed to submit timesheet')
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
        toast.success(`Copied ${result.entriesCopied} entries from previous week`)
        startTransition(() => {
          router.refresh()
        })
      }
    } catch {
      toast.error('Failed to copy entries')
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
          Copy Last Week
        </Button>

        <Button
          size="sm"
          onClick={() => setShowSubmitDialog(true)}
          disabled={!hasEntries || isPending}
        >
          <Send className="mr-2 h-4 w-4" />
          Submit for Approval
        </Button>
      </div>

      {/* Submit Confirmation Dialog */}
      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Timesheet</DialogTitle>
            <DialogDescription>
              Are you sure you want to submit this timesheet for approval? You won&apos;t be able to
              make changes after submission.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSubmitDialog(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Submit
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
