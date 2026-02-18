'use client'

import { useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Receipt, ExternalLink } from 'lucide-react'
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
import { Card, CardContent } from '@/components/ui/card'
import { formatWeekRange, formatDateISO, getCurrentWeekStart, parseDateISO } from '@/lib/date'
import { formatCurrency } from '@/lib/validations/expense'
import type { ExpenseWithUser } from '@/app/(protected)/expenses/actions'

interface ExpenseListProps {
  expenses: ExpenseWithUser[]
  totalCount: number
  currentPage: number
  pageSize: number
}

export function ExpenseList({
  expenses,
  totalCount,
  currentPage,
  pageSize,
}: ExpenseListProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const totalPages = Math.ceil(totalCount / pageSize)
  const currentWeekStart = formatDateISO(getCurrentWeekStart())

  const goToPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(page))
    startTransition(() => {
      router.push(`/expenses?${params.toString()}`)
    })
  }

  return (
    <div className="space-y-4">
      {expenses.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Receipt className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">No expense reports yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Start tracking your expenses by creating a report for the current week
            </p>
            <Button asChild className="mt-4">
              <Link href={`/expenses/${currentWeekStart}`}>Enter Current Week</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Week</TableHead>
                <TableHead className="text-center">Items</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="hidden sm:table-cell">Status</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((expense) => {
                const weekStart = parseDateISO(expense.week_start)
                const weekRange = formatWeekRange(weekStart)
                const isCurrentWeek = expense.week_start === currentWeekStart

                return (
                  <TableRow
                    key={expense.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/expenses/${expense.week_start}`)}
                  >
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {weekRange}
                          {isCurrentWeek && (
                            <span className="ml-2 text-xs text-primary">(Current)</span>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground sm:hidden">
                          {expense.status && <StatusBadge status={expense.status} />}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {expense.entry_count ?? 0}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(expense.total_amount ?? 0)}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {expense.status && <StatusBadge status={expense.status} />}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/expenses/${expense.week_start}`}>
                          <ExternalLink className="h-4 w-4" />
                          <span className="sr-only">View</span>
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * pageSize + 1}-
            {Math.min(currentPage * pageSize, totalCount)} of {totalCount}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1 || isPending}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages || isPending}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
