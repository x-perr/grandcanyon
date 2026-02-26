'use client'

import { useTransition, useCallback, useMemo } from 'react'
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
import { useTranslations } from 'next-intl'

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
  const t = useTranslations('expenses')

  // Memoize derived calculations
  const totalPages = useMemo(() => Math.ceil(totalCount / pageSize), [totalCount, pageSize])
  const currentWeekStart = useMemo(() => formatDateISO(getCurrentWeekStart()), [])

  const goToPage = useCallback((page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(page))
    startTransition(() => {
      router.push(`/expenses?${params.toString()}`)
    })
  }, [searchParams, router])

  return (
    <div className="space-y-4">
      {expenses.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 animate-in fade-in duration-300">
            <Receipt className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">{t('list.no_reports')}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t('list.no_reports_desc')}
            </p>
            <Button asChild className="mt-4">
              <Link href={`/expenses/${currentWeekStart}`}>{t('enter_current_week')}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('list.week')}</TableHead>
                <TableHead className="text-center">{t('list.items')}</TableHead>
                <TableHead className="text-right">{t('list.total')}</TableHead>
                <TableHead className="hidden sm:table-cell">{t('list.status')}</TableHead>
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
                            <span className="ml-2 text-xs text-primary">{t('list.current_badge')}</span>
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
                          <span className="sr-only">{t('list.view')}</span>
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
            {t('pagination.showing', {
              start: (currentPage - 1) * pageSize + 1,
              end: Math.min(currentPage * pageSize, totalCount),
              total: totalCount,
            })}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1 || isPending}
            >
              {t('pagination.previous')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages || isPending}
            >
              {t('pagination.next')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
