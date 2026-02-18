'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Send, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { submitExpense, copyPreviousWeek } from '@/app/(protected)/expenses/actions'
import { toast } from 'sonner'
import type { Tables } from '@/types/database'

interface ExpenseActionsProps {
  expense: Tables<'expenses'>
  isEditable: boolean
  hasEntries: boolean
}

export function ExpenseActions({ expense, isEditable, hasEntries }: ExpenseActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleSubmit = async () => {
    startTransition(async () => {
      const result = await submitExpense(expense.id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Expense report submitted for approval')
        router.refresh()
      }
    })
  }

  const handleCopyPrevious = async () => {
    startTransition(async () => {
      const result = await copyPreviousWeek(expense.id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`Copied ${result.entriesCopied} entries from previous week`)
        router.refresh()
      }
    })
  }

  if (!isEditable) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          This expense report is {expense.status} and cannot be edited.
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleCopyPrevious}
        disabled={isPending}
      >
        <Copy className="mr-2 h-4 w-4" />
        Copy Previous Week
      </Button>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            size="sm"
            disabled={isPending || !hasEntries}
          >
            <Send className="mr-2 h-4 w-4" />
            Submit for Approval
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit Expense Report</AlertDialogTitle>
            <AlertDialogDescription>
              This will submit your expense report for manager approval.
              You won&apos;t be able to make changes until it&apos;s approved or rejected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmit}>
              Submit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
