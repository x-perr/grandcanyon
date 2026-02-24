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
import type { ProfitabilityReportRow } from '@/app/(protected)/reports/actions'
import { ReportExportButton } from './report-export-button'
import type { ColumnDefinition } from '@/lib/csv'
import { formatCurrencyForCSV, formatHoursForCSV, formatPercentForCSV } from '@/lib/csv'
import { useTranslations } from 'next-intl'

interface ProfitabilityReportProps {
  data: ProfitabilityReportRow[]
  summary: {
    totalHours: number
    totalLaborCost: number
    totalExpenseCost: number
    totalInvoiced: number
    totalProfitLoss: number
  }
}

export function ProfitabilityReport({ data, summary }: ProfitabilityReportProps) {
  const t = useTranslations('reports.profitability')
  const tc = useTranslations('common')

  const csvColumns: ColumnDefinition<ProfitabilityReportRow>[] = [
    { key: 'projectCode', header: 'Project Code' },
    { key: 'projectName', header: 'Project Name' },
    { key: 'clientName', header: 'Client' },
    { key: 'billingType', header: 'Billing Type' },
    { key: 'fixedPrice', header: 'Fixed Price', format: (v) => v !== null ? formatCurrencyForCSV(v as number) : '' },
    { key: 'totalHours', header: 'Hours', format: (v) => formatHoursForCSV(v as number) },
    { key: 'laborCost', header: 'Labor Cost', format: (v) => formatCurrencyForCSV(v as number) },
    { key: 'expenseCost', header: 'Expense Cost', format: (v) => formatCurrencyForCSV(v as number) },
    { key: 'totalCost', header: 'Total Cost', format: (v) => formatCurrencyForCSV(v as number) },
    { key: 'invoicedAmount', header: 'Invoiced', format: (v) => formatCurrencyForCSV(v as number) },
    { key: 'profitLoss', header: 'Profit/Loss', format: (v) => formatCurrencyForCSV(v as number) },
    { key: 'marginPercent', header: 'Margin %', format: (v) => v !== null ? formatPercentForCSV(v as number) : '' },
    { key: 'status', header: 'Status' },
  ]

  const overallMargin = summary.totalInvoiced > 0
    ? ((summary.totalProfitLoss / summary.totalInvoiced) * 100).toFixed(1)
    : '0.0'

  const totalCost = summary.totalLaborCost + summary.totalExpenseCost
  const profitableProjects = data.filter(p => p.profitLoss > 0).length
  const lossProjects = data.filter(p => p.profitLoss < 0).length

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('summary.total_hours')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalHours.toFixed(1)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('summary.total_cost')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(totalCost)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('columns.labor_cost')}: {formatCurrency(summary.totalLaborCost)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('summary.total_invoiced')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(summary.totalInvoiced)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('summary.profit_loss')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${summary.totalProfitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(summary.totalProfitLoss)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {overallMargin}% {t('columns.margin')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('summary.projects')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-green-600">{t('summary.profitable_count', { count: profitableProjects })}</span>
              {lossProjects > 0 && (
                <span className="text-red-600 ml-2">{t('summary.loss_count', { count: lossProjects })}</span>
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Export Button */}
      <div className="flex justify-end">
        <ReportExportButton
          data={data}
          columns={csvColumns}
          filename="profitability-report"
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
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('columns.project')}</TableHead>
                <TableHead className="hidden md:table-cell">{t('columns.client')}</TableHead>
                <TableHead className="hidden lg:table-cell">{t('columns.type')}</TableHead>
                <TableHead className="text-right">{t('columns.hours')}</TableHead>
                <TableHead className="text-right hidden sm:table-cell">{t('columns.cost')}</TableHead>
                <TableHead className="text-right">{t('columns.invoiced')}</TableHead>
                <TableHead className="text-right">{t('columns.pl')}</TableHead>
                <TableHead className="text-right hidden sm:table-cell">{t('columns.margin')}</TableHead>
                <TableHead className="hidden lg:table-cell">{tc('labels.status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.projectId}>
                  <TableCell>
                    <Link
                      href={`/projects/${row.projectId}`}
                      className="font-medium hover:underline"
                    >
                      <span className="font-mono text-xs text-muted-foreground">
                        {row.projectCode}
                      </span>
                      <span className="ml-2">{row.projectName}</span>
                    </Link>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{row.clientName}</TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <span className="capitalize">{row.billingType}</span>
                    {row.billingType === 'fixed' && row.fixedPrice && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({formatCurrency(row.fixedPrice)})
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{row.totalHours.toFixed(1)}</TableCell>
                  <TableCell className="text-right hidden sm:table-cell">
                    {formatCurrency(row.totalCost)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(row.invoicedAmount)}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={row.profitLoss >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {formatCurrency(row.profitLoss)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right hidden sm:table-cell">
                    {row.marginPercent !== null ? (
                      <span className={row.marginPercent >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {row.marginPercent.toFixed(1)}%
                      </span>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <StatusBadge status={row.status as 'draft' | 'active' | 'on_hold' | 'completed' | 'cancelled'} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3} className="font-semibold hidden lg:table-cell">
                  {t('summary.total_projects', { count: data.length })}
                </TableCell>
                <TableCell colSpan={2} className="font-semibold lg:hidden">
                  {tc('labels.total')}
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {summary.totalHours.toFixed(1)}
                </TableCell>
                <TableCell className="text-right font-semibold hidden sm:table-cell">
                  {formatCurrency(totalCost)}
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {formatCurrency(summary.totalInvoiced)}
                </TableCell>
                <TableCell className="text-right font-semibold">
                  <span className={summary.totalProfitLoss >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {formatCurrency(summary.totalProfitLoss)}
                  </span>
                </TableCell>
                <TableCell className="text-right font-semibold hidden sm:table-cell">
                  {overallMargin}%
                </TableCell>
                <TableCell className="hidden lg:table-cell" />
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}
    </div>
  )
}
