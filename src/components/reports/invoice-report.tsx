'use client'

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
import { StatusBadge } from '@/components/ui/status-badge'
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

export function InvoiceReport({ data, aging, totals }: InvoiceReportProps) {
  const t = useTranslations('reports.invoices')
  const tc = useTranslations('common')
  const locale = useLocale()

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
              {data.map((row) => (
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
