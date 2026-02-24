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
import { useTranslations } from 'next-intl'

interface ExpenseActionsProps {
  expense: Tables<'expenses'>
  isEditable: boolean
  hasEntries: boolean
}

export function ExpenseActions({ expense, isEditable, hasEntries }: ExpenseActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const t = useTranslations('expenses')

  const handleSubmit = async () => {
    startTransition(async () => {
      const result = await submitExpense(expense.id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(t('toast.submitted'))
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
        toast.success(t('actions.copied', { count: result.entriesCopied ?? 0 }))
        router.refresh()
      }
    })
  }

  if (!isEditable) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          {t('actions.not_editable', { status: expense.status ?? '' })}
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
        {t('actions.copy_previous')}
      </Button>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            size="sm"
            disabled={isPending || !hasEntries}
          >
            <Send className="mr-2 h-4 w-4" />
            {t('actions.submit_approval')}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('actions.submit_title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('actions.submit_desc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmit}>
              {t('actions.submit')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
