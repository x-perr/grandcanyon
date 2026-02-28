'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/status-badge'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatCurrency } from '@/lib/tax'
import type { InvoiceReportRow, InvoiceAgingSummary } from '@/app/(protected)/reports/actions'
import { ReportExportButton } from './report-export-button'
import type { ColumnDefinition } from '@/lib/csv'
import { formatCurrencyForCSV, formatDateForCSV } from '@/lib/csv'
import { useTranslations, useLocale } from 'next-intl'

interface InvoiceReportProps {
  data: InvoiceReportRow[]
  aging: InvoiceAgingSummary
  totals: {
    draft: number
    sent: number
    paid: number
  }
}

const PAGE_SIZE_OPTIONS = [25, 50, 100]

export function InvoiceReport({ data, aging, totals }: InvoiceReportProps) {
  const t = useTranslations('reports.invoices')
  const tc = useTranslations('common')
  const locale = useLocale()

  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  const totalPages = useMemo(() => Math.ceil(data.length / pageSize), [data.length, pageSize])
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return data.slice(start, start + pageSize)
  }, [data, currentPage, pageSize])

  const handlePageSizeChange = (value: string) => {
    setPageSize(Number(value))
    setCurrentPage(1) // Reset to first page
  }

  const csvColumns: ColumnDefinition<InvoiceReportRow>[] = [
    { key: 'invoiceNumber', header: 'Invoice #' },
    { key: 'clientName', header: 'Client' },
    { key: 'projectCode', header: 'Project Code' },
    { key: 'projectName', header: 'Project Name' },
    { key: 'invoiceDate', header: 'Invoice Date', format: (v) => formatDateForCSV(v as string) },
    { key: 'dueDate', header: 'Due Date', format: (v) => formatDateForCSV(v as string) },
    { key: 'status', header: 'Status' },
    { key: 'daysPastDue', header: 'Days Past Due', format: (v) => v !== null ? String(v) : '' },
    { key: 'subtotal', header: 'Subtotal', format: (v) => formatCurrencyForCSV(v as number) },
    { key: 'gst', header: 'GST', format: (v) => formatCurrencyForCSV(v as number) },
    { key: 'qst', header: 'QST', format: (v) => formatCurrencyForCSV(v as number) },
    { key: 'total', header: 'Total', format: (v) => formatCurrencyForCSV(v as number) },
  ]

  const totalAll = totals.draft + totals.sent + totals.paid

  return (
    <div className="space-y-4">
      {/* Status Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {tc('status.draft')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">
              {formatCurrency(totals.draft)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('summary.sent_outstanding')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {formatCurrency(totals.sent)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {tc('status.paid')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(totals.paid)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {tc('labels.total')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalAll)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Aging Summary */}
      {aging.total > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('aging.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <p className="text-sm text-muted-foreground">{t('aging.current')}</p>
                <p className="text-lg font-semibold text-green-600">
                  {formatCurrency(aging.current)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('aging.days_31_60')}</p>
                <p className="text-lg font-semibold text-yellow-600">
                  {formatCurrency(aging.days30to60)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('aging.days_61_90')}</p>
                <p className="text-lg font-semibold text-orange-600">
                  {formatCurrency(aging.days60to90)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('aging.over_90')}</p>
                <p className="text-lg font-semibold text-red-600">
                  {formatCurrency(aging.over90)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Export Button */}
      <div className="flex justify-end">
        <ReportExportButton
          data={data}
          columns={csvColumns}
          filename="invoice-report"
        />
      </div>

      {/* Data Table */}
      {data.length === 0 ? (
        <Card>
          <CardContent className="py-10">
            <p className="text-center text-muted-foreground">
              {t('no_data')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('columns.invoice')}</TableHead>
                  <TableHead>{t('columns.client')}</TableHead>
                  <TableHead className="hidden md:table-cell">{t('columns.project')}</TableHead>
                  <TableHead>{t('columns.date')}</TableHead>
                  <TableHead>{tc('labels.status')}</TableHead>
                  <TableHead className="hidden sm:table-cell">{t('columns.days_past_due')}</TableHead>
                  <TableHead className="text-right">{tc('labels.total')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.map((row) => (
                  <TableRow key={row.invoiceId}>
                    <TableCell>
                      <Link
                        href={`/invoices/${row.invoiceId}`}
                        className="font-medium hover:underline"
                      >
                        {row.invoiceNumber}
                      </Link>
                    </TableCell>
                    <TableCell>{row.clientName}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="font-mono text-xs text-muted-foreground">
                        {row.projectCode}
                      </span>
                    </TableCell>
                    <TableCell>
                      {formatDate(row.invoiceDate, locale)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={row.status as 'draft' | 'sent' | 'paid' | 'void'} />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {row.daysPastDue !== null ? (
                        <span className={getAgingColor(row.daysPastDue)}>
                          {t('columns.days_count', { count: row.daysPastDue })}
                        </span>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(row.total)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={6} className="font-semibold">
                    {t('summary.total_invoices', { count: data.length })}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(data.reduce((sum, row) => sum + row.total, 0))}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{tc('pagination.rows_per_page')}</span>
                <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
                  <SelectTrigger className="h-8 w-[70px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <SelectItem key={size} value={String(size)}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {tc('pagination.page_of', { current: currentPage, total: totalPages })}
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function formatDate(dateStr: string, locale: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString(locale === 'fr' ? 'fr-CA' : 'en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function getAgingColor(days: number): string {
  if (days <= 0) return 'text-green-600'
  if (days <= 30) return 'text-yellow-600'
  if (days <= 60) return 'text-orange-600'
  return 'text-red-600'
}
