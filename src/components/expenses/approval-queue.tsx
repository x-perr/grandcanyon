'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Check, X, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent } from '@/components/ui/card'
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
import { Textarea } from '@/components/ui/textarea'
import { formatWeekRange, parseDateISO } from '@/lib/date'
import { formatCurrency } from '@/lib/validations/expense'
import { approveExpense, rejectExpense } from '@/app/(protected)/expenses/actions'
import { toast } from 'sonner'
import { useState } from 'react'
import type { ExpenseWithUser } from '@/app/(protected)/expenses/actions'
import { useTranslations } from 'next-intl'

interface ExpenseApprovalQueueProps {
  expenses: ExpenseWithUser[]
}

export function ExpenseApprovalQueue({ expenses }: ExpenseApprovalQueueProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [rejectReason, setRejectReason] = useState('')
  const t = useTranslations('expenses')

  const handleApprove = async (expenseId: string) => {
    startTransition(async () => {
      const result = await approveExpense(expenseId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(t('approval.approved'))
        router.refresh()
      }
    })
  }

  const handleReject = async (expenseId: string) => {
    startTransition(async () => {
      const result = await rejectExpense(expenseId, rejectReason)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(t('approval.rejected'))
        setRejectReason('')
        router.refresh()
      }
    })
  }

  if (expenses.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Check className="h-12 w-12 text-green-500/50" />
          <h3 className="mt-4 text-lg font-semibold">{t('approval.all_caught_up')}</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('approval.no_pending')}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('approval.employee')}</TableHead>
            <TableHead>{t('approval.week')}</TableHead>
            <TableHead className="text-center">{t('approval.items')}</TableHead>
            <TableHead className="text-right">{t('approval.total')}</TableHead>
            <TableHead className="text-right">{t('approval.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {expenses.map((expense) => {
            const weekStart = parseDateISO(expense.week_start)
            const weekRange = formatWeekRange(weekStart)
            const user = expense.user

            return (
              <TableRow key={expense.id}>
                <TableCell>
                  <div>
                    <div className="font-medium">
                      {user ? `${user.first_name} ${user.last_name}` : t('approval.unknown')}
                    </div>
                    <div className="text-sm text-muted-foreground">{user?.email}</div>
                  </div>
                </TableCell>
                <TableCell>{weekRange}</TableCell>
                <TableCell className="text-center">{expense.entry_count ?? 0}</TableCell>
                <TableCell className="text-right font-mono">
                  {formatCurrency(expense.total_amount ?? 0)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/expenses/${expense.week_start}/review?id=${expense.id}`}>
                        <ExternalLink className="h-4 w-4" />
                        <span className="sr-only">{t('approval.review')}</span>
                      </Link>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      className="text-green-600 hover:bg-green-50 hover:text-green-700"
                      onClick={() => handleApprove(expense.id)}
                      disabled={isPending}
                    >
                      <Check className="h-4 w-4" />
                      <span className="sr-only">{t('approval.approve')}</span>
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:bg-red-50 hover:text-red-700"
                          disabled={isPending}
                        >
                          <X className="h-4 w-4" />
                          <span className="sr-only">{t('approval.reject')}</span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t('approval.reject_title')}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {t('approval.reject_desc', { name: user?.first_name ?? '' })}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <Textarea
                          placeholder={t('approval.reject_placeholder')}
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                        />
                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={() => setRejectReason('')}>
                            {t('actions.cancel')}
                          </AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-red-600 hover:bg-red-700"
                            onClick={() => handleReject(expense.id)}
                          >
                            {t('approval.reject')}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
